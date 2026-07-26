import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Activity, Webhook, Send, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { getFunctionErrorMessage } from '@/lib/functionErrors';

type HealthData = {
  generated_at: string;
  config: { configured: boolean; server_url: string | null; last_tested_at: string | null; expected_webhook_base: string };
  instances: Array<{
    id: string;
    instance_name: string;
    status: string;
    phone_number: string | null;
    is_default: boolean;
    last_connected_at: string | null;
    webhook: {
      reachable: boolean; enabled: boolean; url: string | null; matches: boolean;
      token_configured: boolean; expected_url: string | null; events: unknown;
    };
  }>;
  webhook: {
    healthy: boolean; last_event_at: string | null; events_24h: number;
    event_counts_24h: Record<string, number>;
    recent: Array<{ event: string; created_at: string; instance_name: string | null }>;
  };
  sending: {
    healthy: boolean | null; attempts_24h: number; failures_24h: number;
    last_success_at: string | null;
    last_failure: { at: string; error: string | null; endpoint: string | null; http_status: number | null } | null;
  };
};

type Attempt = {
  id: string; created_at: string; source: string; target: string | null; endpoint: string | null;
  http_status: number | null; ok: boolean; error: string | null; preview: string | null;
  conversation_id: string | null; order_id: number | null; instance_name: string | null;
};

function fmt(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function StatusPill({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) {
    return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" />{label}</Badge>;
  }
  return ok
    ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15"><CheckCircle2 className="h-3 w-3 mr-1" />{label}</Badge>
    : <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{label}</Badge>;
}

export default function WhatsAppHealth() {
  const { toast } = useToast();
  const { restaurantId } = useEffectiveRestaurantId();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    const [{ data, error }, { data: rows }] = await Promise.all([
      supabase.functions.invoke('evolution-health', { body: { action: 'status', restaurant_id: restaurantId } }),
      supabase
        .from('evolution_send_attempts')
        .select('id, created_at, source, target, endpoint, http_status, ok, error, preview, conversation_id, order_id, instance_name')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);
    setLoading(false);
    if (error || (data as any)?.error) {
      toast({
        title: 'Erro ao checar saúde',
        description: await getFunctionErrorMessage(data, error, 'Não foi possível consultar o status da Evolution.'),
        variant: 'destructive',
      });
      return;
    }
    setHealth(data as HealthData);
    setAttempts((rows ?? []) as Attempt[]);
  }, [restaurantId, toast]);

  useEffect(() => { load(); }, [load]);

  async function runTest() {
    if (!restaurantId || !testTo.trim()) return;
    setTesting(true);
    const { data, error } = await supabase.functions.invoke('evolution-health', {
      body: { action: 'test_send', restaurant_id: restaurantId, to: testTo.trim() },
    });
    setTesting(false);
    if (error || !(data as any)?.ok) {
      toast({
        title: 'Falha no envio de teste',
        description: await getFunctionErrorMessage(data, error, 'A Evolution recusou o envio de teste.'),
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Mensagem de teste enviada', description: `Endpoint: ${(data as any).endpoint}` });
    }
    load();
  }

  const byConversation = useMemo(() => attempts.filter((a) => a.conversation_id), [attempts]);
  const byOrder = useMemo(() => attempts.filter((a) => a.order_id), [attempts]);

  const applyFilter = (list: Attempt[]) => {
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      [a.target, a.source, a.endpoint, a.error, a.preview, a.conversation_id, String(a.order_id ?? '')]
        .some((v) => String(v ?? '').toLowerCase().includes(q)));
  };

  const AttemptTable = ({ rows, showOrder }: { rows: Attempt[]; showOrder?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground">
          <tr className="text-left border-b">
            <th className="py-2 pr-3 font-medium">Quando</th>
            <th className="py-2 pr-3 font-medium">{showOrder ? 'Pedido' : 'Conversa'}</th>
            <th className="py-2 pr-3 font-medium">Origem</th>
            <th className="py-2 pr-3 font-medium">Destino</th>
            <th className="py-2 pr-3 font-medium">Endpoint</th>
            <th className="py-2 pr-3 font-medium">Resultado</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhuma tentativa registrada ainda.</td></tr>
          )}
          {rows.map((a) => (
            <tr key={a.id} className="border-b last:border-0 align-top">
              <td className="py-2 pr-3 whitespace-nowrap">{fmt(a.created_at)}</td>
              <td className="py-2 pr-3 font-mono text-xs">
                {showOrder ? `#${a.order_id}` : (a.conversation_id ?? '—').slice(0, 8)}
              </td>
              <td className="py-2 pr-3">{a.source}</td>
              <td className="py-2 pr-3 font-mono text-xs">{a.target ?? '—'}</td>
              <td className="py-2 pr-3 text-xs">{a.endpoint ?? '—'}{a.http_status ? ` (${a.http_status})` : ''}</td>
              <td className="py-2 pr-3">
                {a.ok
                  ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Enviado</Badge>
                  : <div className="space-y-1"><Badge variant="destructive">Falhou</Badge><p className="text-xs text-muted-foreground max-w-[320px]">{a.error}</p></div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <AdminLayout title="Saúde do WhatsApp">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Saúde do WhatsApp</h1>
            <p className="text-muted-foreground">Status do webhook da Evolution e histórico de tentativas de envio.</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>

        {loading && !health ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !health ? null : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Servidor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <StatusPill ok={health.config.configured} label={health.config.configured ? 'Configurado' : 'Não configurado'} />
                  <p className="text-xs text-muted-foreground break-all">{health.config.server_url ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Último teste: {fmt(health.config.last_tested_at)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhook</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <StatusPill ok={health.webhook.healthy} label={health.webhook.healthy ? 'Ativo' : 'Verificar'} />
                  <p className="text-xs text-muted-foreground">Último evento: {fmt(health.webhook.last_event_at)}</p>
                  <p className="text-xs text-muted-foreground">Eventos 24h: {health.webhook.events_24h}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Envios (24h)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <StatusPill ok={health.sending.healthy} label={health.sending.healthy === null ? 'Sem dados' : health.sending.healthy ? 'Saudável' : 'Com falhas'} />
                  <p className="text-xs text-muted-foreground">{health.sending.attempts_24h} tentativas · {health.sending.failures_24h} falhas</p>
                  <p className="text-xs text-muted-foreground">Último sucesso: {fmt(health.sending.last_success_at)}</p>
                  {health.sending.last_failure && (
                    <p className="text-xs text-destructive">{health.sending.last_failure.error}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Instâncias e registro do webhook</CardTitle>
                <CardDescription>Comparação entre o webhook registrado na Evolution e o endereço esperado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {health.instances.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma instância criada.</p>}
                {health.instances.map((inst) => (
                  <div key={inst.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{inst.instance_name}</span>
                      <Badge variant={inst.status === 'connected' ? 'default' : 'secondary'}>{inst.status}</Badge>
                      {inst.is_default && <Badge variant="outline">padrão</Badge>}
                      <StatusPill ok={inst.webhook.reachable && inst.webhook.enabled && inst.webhook.matches} label="webhook" />
                    </div>
                    <p className="text-xs text-muted-foreground break-all">Registrado: {inst.webhook.url ?? 'não encontrado'}</p>
                    <p className="text-xs text-muted-foreground break-all">Esperado: {inst.webhook.expected_url ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">Telefone: {inst.phone_number ?? '—'} · Conectado em: {fmt(inst.last_connected_at)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Teste de envio em tempo real</CardTitle>
                <CardDescription>Envia uma mensagem de teste e registra o resultado no histórico abaixo.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="to">Número (DDI+DDD+número)</Label>
                  <Input id="to" placeholder="5511999999999" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="w-56" />
                </div>
                <Button onClick={runTest} disabled={testing || !testTo.trim()}>
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar teste
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-3">
                <div>
                  <CardTitle className="text-base">Tentativas de envio</CardTitle>
                  <CardDescription>Últimas 100 tentativas registradas.</CardDescription>
                </div>
                <Input placeholder="Filtrar por número, pedido, erro..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="conversations">
                  <TabsList>
                    <TabsTrigger value="conversations">Por conversa</TabsTrigger>
                    <TabsTrigger value="orders">Por pedido</TabsTrigger>
                    <TabsTrigger value="all">Todas</TabsTrigger>
                    <TabsTrigger value="events">Eventos do webhook</TabsTrigger>
                  </TabsList>
                  <TabsContent value="conversations" className="pt-4"><AttemptTable rows={applyFilter(byConversation)} /></TabsContent>
                  <TabsContent value="orders" className="pt-4"><AttemptTable rows={applyFilter(byOrder)} showOrder /></TabsContent>
                  <TabsContent value="all" className="pt-4"><AttemptTable rows={applyFilter(attempts)} /></TabsContent>
                  <TabsContent value="events" className="pt-4">
                    <div className="space-y-2">
                      {health.webhook.recent.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento recebido ainda.</p>}
                      {health.webhook.recent.map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b py-2 last:border-0">
                          <span className="font-mono text-xs">{e.event}</span>
                          <span className="text-muted-foreground text-xs">{e.instance_name ?? '—'} · {fmt(e.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
