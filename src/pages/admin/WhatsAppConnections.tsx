import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, QrCode, Power, RefreshCw, Smartphone, Star, MessageCircle, Plus, Trash2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { QrCodeImage } from '@/components/whatsapp/QrCodeImage';
import { getFunctionErrorMessage } from '@/lib/functionErrors';

type Instance = {
  id: string;
  restaurant_id: string;
  instance_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  is_default: boolean;
  last_connected_at: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    connected: { label: 'Conectado', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
    waiting_qr: { label: 'Aguardando QR', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
    disconnected: { label: 'Desconectado', cls: 'bg-muted text-muted-foreground' },
  };
  const s = map[status] ?? map.disconnected;
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

export default function WhatsAppConnections() {
  const { toast } = useToast();
  const { restaurantId } = useEffectiveRestaurantId();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [limit, setLimit] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrInstance, setQrInstance] = useState<Instance | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testInstance, setTestInstance] = useState<Instance | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);

  async function load() {
    if (!restaurantId) return;
    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke('evolution-proxy', {
      body: { action: 'list_instances', restaurant_id: restaurantId },
    });
    setIsLoading(false);
    if (error || data?.error) {
      toast({ title: 'Erro', description: await getFunctionErrorMessage(data, error, 'Não foi possível carregar suas conexões.'), variant: 'destructive' });
      return;
    }
    setInstances((data?.instances || []) as Instance[]);
    setLimit(data?.limit ?? 1);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`admin-inst-${restaurantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'evolution_instances',
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [restaurantId]);

  async function call(action: string, body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke('evolution-proxy', {
      body: { action, ...body },
    });
    if (error || data?.error) {
      const description = await getFunctionErrorMessage(data, error, 'A Evolution não concluiu a ação.');
      toast({ title: 'Erro', description, variant: 'destructive' });
      return null;
    }
    return data;
  }

  function isValidName(n: string) {
    return /^[a-z0-9-]{3,60}$/.test(n.trim());
  }

  async function handleCreate() {
    const name = createName.trim().toLowerCase();
    if (!isValidName(name) || !restaurantId) return;
    setCreating(true);
    const res = await call('create_instance', { restaurant_id: restaurantId, instance_name: name });
    setCreating(false);
    if (res) {
      toast({ title: 'Conexão criada' });
      setCreateOpen(false);
      setCreateName('');
      load();
    }
  }

  async function handleConnect(inst: Instance) {
    setQrInstance(inst);
    setQrOpen(true);
    setQrCode(null);
    setQrLoading(true);
    const res = await call('connect_instance', { instance_id: inst.id });
    setQrLoading(false);
    if (!res) {
      setQrOpen(false);
      return;
    }
    if (res.connected || res.already_connected) {
      toast({ title: res.already_connected ? 'WhatsApp já conectado' : 'Conectado!' });
      setQrOpen(false);
      load();
      return;
    }
    if (res?.qr_code) setQrCode(res.qr_code);
  }

  useEffect(() => {
    if (!qrOpen || !qrInstance) return;
    const t = setInterval(async () => {
      const { data } = await supabase
        .from('evolution_instances').select('status, qr_code')
        .eq('id', qrInstance.id).maybeSingle();
      if (data?.status === 'connected') {
        toast({ title: 'WhatsApp conectado!' });
        setQrOpen(false);
        load();
      } else if (data?.qr_code && data.qr_code !== qrCode) {
        setQrCode(data.qr_code);
      }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [qrOpen, qrInstance, qrCode]);

  async function handleDisconnect(inst: Instance) {
    setBusy(inst.id);
    await call('disconnect_instance', { instance_id: inst.id });
    setBusy(null);
    load();
  }

  async function handleDelete(inst: Instance) {
    setBusy(inst.id);
    const res = await call('delete_instance', { instance_id: inst.id });
    setBusy(null);
    if (res) {
      toast({ title: 'Conexão removida' });
      load();
    }
  }

  async function handleSetDefault(inst: Instance) {
    setBusy(inst.id);
    await call('set_default', { instance_id: inst.id });
    setBusy(null);
    load();
  }

  function openTestDialog(inst: Instance) {
    setTestInstance(inst);
    setTestPhone('');
    setTestOpen(true);
  }

  async function handleSendTest() {
    if (!restaurantId || !testInstance) return;
    const digits = testPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      toast({ title: 'Telefone inválido', description: 'Informe DDI, DDD e número. Ex.: 5511999998888', variant: 'destructive' });
      return;
    }
    setTestSending(true);
    const { data, error } = await supabase.functions.invoke('evolution-send', {
      body: {
        action: 'send_direct',
        restaurant_id: restaurantId,
        instance_id: testInstance.id,
        type: 'text',
        to: digits,
        payload: { text: 'Mensagem de teste do VoeFood: se você recebeu esta mensagem, o envio pelo WhatsApp está funcionando.' },
      },
    });
    setTestSending(false);
    if (error || data?.error || data?.ok === false) {
      toast({ title: 'Teste não enviado', description: await getFunctionErrorMessage(data, error, 'A mensagem de teste não foi aceita pela Evolution.'), variant: 'destructive' });
      return;
    }
    toast({ title: 'Mensagem de teste enviada', description: 'Confira se ela chegou no WhatsApp informado.' });
    setTestOpen(false);
  }

  async function handleSync() {
    if (!restaurantId) return;
    setBusy('sync');
    await call('sync_instances', { restaurant_id: restaurantId });
    setBusy(null);
    load();
  }

  const atLimit = instances.length >= limit;

  return (
    <AdminLayout title="WhatsApp">
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Suas Conexões de WhatsApp</h1>
            <p className="text-muted-foreground text-sm">
              Conecte seus números de WhatsApp escaneando o QR Code com o aparelho.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {instances.length} / {limit} usadas
            </Badge>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={busy === 'sync'}>
              <RefreshCw className={`h-4 w-4 mr-2 ${busy === 'sync' ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={atLimit}>
              <Plus className="h-4 w-4 mr-2" /> Nova conexão
            </Button>
          </div>
        </div>

        {atLimit && (
          <p className="text-xs text-muted-foreground">
            Você atingiu o limite de conexões do seu plano. Para adicionar mais, fale com seu revendedor.
          </p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : instances.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <Smartphone className="h-12 w-12 text-muted-foreground mx-auto" />
              <p className="font-medium">Nenhuma conexão criada ainda</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Clique em "Nova conexão" para conectar o primeiro número de WhatsApp da sua empresa.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {instances.map((inst) => (
              <Card key={inst.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <span className="truncate">{inst.instance_name}</span>
                        {inst.is_default && (
                          <Badge variant="outline" className="bg-primary/10 text-primary">
                            <Star className="h-3 w-3 mr-1" /> Padrão
                          </Badge>
                        )}
                        <StatusBadge status={inst.status} />
                      </CardTitle>
                      <CardDescription>
                        {inst.phone_number ? `+${inst.phone_number}` : 'Sem número conectado'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {inst.status !== 'connected' ? (
                      <Button size="sm" onClick={() => handleConnect(inst)} disabled={busy === inst.id}>
                        <QrCode className="h-4 w-4 mr-1" /> Conectar
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openTestDialog(inst)} disabled={busy === inst.id}>
                          <Send className="h-4 w-4 mr-1" /> Teste
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDisconnect(inst)} disabled={busy === inst.id}>
                          {busy === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4 mr-1" />}
                          Desconectar
                        </Button>
                      </>
                    )}
                    {!inst.is_default && (
                      <Button size="sm" variant="ghost" onClick={() => handleSetDefault(inst)} disabled={busy === inst.id} title="Definir como padrão">
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={busy === inst.id} title="Remover">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover conexão?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isto vai desconectar e excluir "{inst.instance_name}". As conversas existentes ficarão sem origem ativa.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(inst)}>Remover</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova conexão de WhatsApp</DialogTitle>
              <DialogDescription>
                Dê um nome simples para identificar essa conexão (ex: vendas, atendimento).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="conn_name">Nome da conexão</Label>
              <Input
                id="conn_name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value.toLowerCase())}
                placeholder="ex: vendas-01"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números e hifens. Mínimo 3 caracteres.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={creating || !isValidName(createName)}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar conexão
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR dialog */}
        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conectar {qrInstance?.instance_name}</DialogTitle>
              <DialogDescription>
                Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar aparelho → escaneie o código abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-4 min-h-[280px]">
              {qrLoading && !qrCode ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : qrCode ? (
                <QrCodeImage value={qrCode} className="w-64 h-64 rounded-lg border bg-background p-2" />
              ) : (
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  Aguardando QR do servidor Evolution… Se demorar, clique em "Novo QR".
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => qrInstance && handleConnect(qrInstance)} disabled={qrLoading}>
                <RefreshCw className="h-4 w-4 mr-2" /> Novo QR
              </Button>
              <Button onClick={() => setQrOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={testOpen} onOpenChange={setTestOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar mensagem de teste</DialogTitle>
              <DialogDescription>
                A mensagem será enviada pela conexão {testInstance?.instance_name}. Use um número com DDI e DDD.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="test-phone-admin">Telefone</Label>
              <Input
                id="test-phone-admin"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="5511999998888"
                inputMode="tel"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTestOpen(false)} disabled={testSending}>Cancelar</Button>
              <Button onClick={handleSendTest} disabled={testSending || testPhone.replace(/\D/g, '').length < 10}>
                {testSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar teste
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
