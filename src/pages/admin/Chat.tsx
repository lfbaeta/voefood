import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageCircle, Search, Phone, Mic, FileText, MapPin, User, Download, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWaConversations, useWaMessages, useWaInstances, markConversationRead, type WaContact, type WaConversation, type WaMessage } from '@/hooks/useWhatsApp';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { ChatInput } from '@/components/chat/ChatInput';
import { NewChatDialog } from '@/components/chat/NewChatDialog';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useSlug, useBasePath } from '@/hooks/useSlug';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConvWithContact = WaConversation & { contact: WaContact | null };

function timeShort(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const diff = (today.getTime() - d.getTime()) / 86_400_000;
  if (diff < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function contactInitials(c: WaContact | null) {
  const name = c?.name || c?.phone_e164 || '?';
  return name.replace(/\D/g, '').slice(-2) || name.slice(0, 2).toUpperCase();
}

function contactLabel(c: WaContact | null) {
  if (!c) return '—';
  if (c.name) return c.name;
  return c.phone_e164 ? `+${c.phone_e164}` : '—';
}

function useWaMediaSignedUrl(rawUrl: string | null | undefined) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSigned(null);
    if (!rawUrl) return;
    // Extract storage object path if the URL points to the wa-media bucket
    const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/wa-media\/([^?]+)/);
    if (!match) { setSigned(rawUrl); return; }
    const path = decodeURIComponent(match[1]);
    supabase.storage.from('wa-media').createSignedUrl(path, 60 * 30).then(({ data }) => {
      if (!cancelled) setSigned(data?.signedUrl ?? null);
    });
    return () => { cancelled = true; };
  }, [rawUrl]);
  return signed;
}

function MessageContent({ m }: { m: WaMessage }) {
  const url = useWaMediaSignedUrl(m.media_url);
  if (m.content_type === 'image' && url) {
    return (
      <div className="space-y-1">
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={m.media_filename ?? 'image'} className="rounded-md max-h-72 max-w-full object-cover" />
        </a>
        {m.text && <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>}
      </div>
    );
  }
  if (m.content_type === 'video' && url) {
    return (
      <div className="space-y-1">
        <video src={url} controls className="rounded-md max-h-72 max-w-full" />
        {m.text && <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>}
      </div>
    );
  }
  if (m.content_type === 'audio' && url) {
    return <audio src={url} controls className="h-9" />;
  }
  if (m.content_type === 'document' && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm underline">
        <FileText className="h-4 w-4" />
        <span className="truncate max-w-[200px]">{m.media_filename || 'Documento'}</span>
        <Download className="h-3 w-3" />
      </a>
    );
  }
  if (m.text) return <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>;

  const ic = m.content_type === 'audio' ? <Mic className="h-4 w-4" />
    : m.content_type === 'location' ? <MapPin className="h-4 w-4" />
    : m.content_type === 'contact' ? <User className="h-4 w-4" />
    : <FileText className="h-4 w-4" />;
  return (
    <div className="flex items-center gap-2 text-sm italic text-muted-foreground">
      {ic}<span>Mensagem</span>
    </div>
  );
}

export default function Chat() {
  const { restaurantId } = useEffectiveRestaurantId();
  const slug = useSlug();
  const basePath = useBasePath(slug);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: conversations = [], isLoading } = useWaConversations();
  const { data: instances = [] } = useWaInstances();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  // Sync ?c=<id> with selected conversation
  useEffect(() => {
    const c = searchParams.get('c');
    if (c && c !== selectedId) setSelectedId(c);
  }, [searchParams]);

  const hasConnected = instances.some((i) => i.status === 'connected');
  const hasAnyInstance = instances.length > 0;

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const n = c.contact?.name?.toLowerCase() ?? '';
      const p = c.contact?.phone_e164 ?? '';
      return n.includes(q) || p.includes(q);
    });
  }, [search, conversations]);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) as ConvWithContact | undefined,
    [conversations, selectedId],
  );

  const { messages, loading: loadingMsgs } = useWaMessages(selectedId);
  const linkedPhone = (selected?.contact as any)?.linked_customer_phone ?? selected?.contact?.phone_e164 ?? null;
  const { data: customerOrders = [] } = useCustomerOrders(restaurantId ?? undefined, linkedPhone);

  useEffect(() => {
    if (selectedId && selected?.unread_count && selected.unread_count > 0) {
      markConversationRead(selectedId);
    }
  }, [selectedId, selected?.unread_count]);

  const selectedInstance = useMemo(
    () => instances.find((i) => i.id === selected?.instance_id),
    [instances, selected?.instance_id],
  );
  const inputDisabled = !selectedInstance || selectedInstance.status !== 'connected';
  const inputDisabledReason = !selectedInstance
    ? 'Instância não encontrada.'
    : selectedInstance.status !== 'connected'
      ? 'Instância desconectada. Conecte na aba Conexões para responder.'
      : undefined;

  return (
    <AdminLayout title="Chat WhatsApp">
      <div className="h-[calc(100vh-7rem)] flex flex-col">
        {hasAnyInstance && !hasConnected && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
              <span>Nenhuma instância conectada. Você pode visualizar conversas, mas não enviar mensagens.</span>
              <Button asChild size="sm" variant="outline">
                <Link to={`${basePath}/admin/whatsapp`}>Ir para Conexões</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!hasAnyInstance && (
          <Alert className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
              <span>Nenhuma instância de WhatsApp configurada para este restaurante.</span>
              <Button asChild size="sm" variant="outline">
                <Link to={`${basePath}/admin/whatsapp`}>Ir para Conexões</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="flex-1 flex overflow-hidden">
          {/* Sidebar conversations */}
          <aside className={cn(
            'w-full sm:w-80 border-r border-border flex flex-col',
            selectedId && 'hidden sm:flex',
          )}>
            <div className="p-3 border-b border-border space-y-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar contato..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => setNewChatOpen(true)}
                disabled={!hasConnected}
              >
                <Plus className="h-4 w-4 mr-1" /> Nova conversa
              </Button>
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  Nenhuma conversa ainda.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          'w-full text-left p-3 hover:bg-muted/50 transition-colors flex gap-3',
                          selectedId === c.id && 'bg-muted',
                        )}
                      >
                        <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0">
                          {contactInitials(c.contact)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="font-medium text-sm truncate">{contactLabel(c.contact)}</p>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {timeShort(c.last_message_at)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground truncate">
                              {c.last_message_preview || '—'}
                            </p>
                            {c.unread_count > 0 && (
                              <Badge className="bg-primary text-primary-foreground h-5 px-1.5 text-[10px] rounded-full shrink-0">
                                {c.unread_count}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </aside>

          {/* Thread */}
          <section className={cn(
            'flex-1 flex-col bg-muted/20',
            selectedId ? 'flex' : 'hidden sm:flex',
          )}>
            {selected ? (
              <>
                <header className="flex items-center gap-3 p-3 border-b border-border bg-background">
                  <button
                    className="sm:hidden text-sm text-muted-foreground"
                    onClick={() => setSelectedId(null)}
                  >
                    ← Voltar
                  </button>
                  <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">
                    {contactInitials(selected.contact)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{contactLabel(selected.contact)}</p>
                    {selected.contact?.phone_e164 && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />+{selected.contact.phone_e164}
                      </p>
                    )}
                  </div>
                </header>

                {customerOrders.length > 0 && (
                  <Collapsible open={ordersOpen} onOpenChange={setOrdersOpen}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs border-b border-border bg-muted/30 hover:bg-muted/60 transition-colors">
                        <span className="flex items-center gap-1.5">
                          <Receipt className="h-3.5 w-3.5" />
                          {customerOrders.length} pedido{customerOrders.length === 1 ? '' : 's'} deste cliente
                        </span>
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', ordersOpen && 'rotate-180')} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="max-h-40 overflow-y-auto divide-y divide-border bg-muted/10">
                        {customerOrders.map((o) => (
                          <li key={o.id}>
                            <Link
                              to={`${basePath}/admin/orders`}
                              className="flex items-center justify-between px-3 py-1.5 text-xs hover:bg-muted/50"
                            >
                              <span className="font-medium">
                                #{o.id} <span className="text-muted-foreground">· {o.status}</span>
                              </span>
                              <span className="font-semibold">
                                {Number(o.total_amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                <ScrollArea className="flex-1 p-4">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                      Sem mensagens nesta conversa.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {messages.map((m) => (
                        <li
                          key={m.id}
                          className={cn(
                            'flex',
                            m.from_me ? 'justify-end' : 'justify-start',
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[80%] sm:max-w-[60%] rounded-2xl px-3 py-2 shadow-sm',
                              m.from_me
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-card border border-border rounded-bl-sm',
                            )}
                          >
                            <MessageContent m={m} />
                            <div
                              className={cn(
                                'text-[10px] mt-1 text-right opacity-70',
                                m.from_me ? 'text-primary-foreground' : 'text-muted-foreground',
                              )}
                            >
                              {timeShort(m.sent_at ?? m.created_at)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>

                <footer className="p-3 border-t border-border bg-background">
                  {restaurantId && (
                    <ChatInput
                      conversationId={selected.id}
                      restaurantId={restaurantId}
                      disabled={inputDisabled}
                      disabledReason={inputDisabledReason}
                    />
                  )}
                </footer>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <MessageCircle className="h-12 w-12 mx-auto opacity-50" />
                  <p className="text-sm">Selecione uma conversa para ver as mensagens</p>
                </div>
              </div>
            )}
          </section>
        </Card>
      </div>
      {restaurantId && (
        <NewChatDialog
          open={newChatOpen}
          onOpenChange={setNewChatOpen}
          restaurantId={restaurantId}
          instances={instances}
          onCreated={(id) => setSelectedId(id)}
        />
      )}
    </AdminLayout>
  );
}