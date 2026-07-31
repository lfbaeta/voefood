import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Printer, Usb, TestTube2, AlertTriangle, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { useStorePrintPrefs } from '@/hooks/useStorePrintPrefs';
import { usePrintStation } from '@/hooks/usePrintStation';
import { useStoreConfig } from '@/hooks/useStore';
import { enqueuePrintJob } from '@/lib/printQueue';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

type StationRole = 'all' | 'kitchen' | 'bar' | 'cashier';

const ROLE_LABEL: Record<StationRole, string> = {
  all: 'Todos os tickets',
  kitchen: 'Somente Cozinha',
  bar: 'Somente Bar',
  cashier: 'Somente Caixa (recibo do cliente)',
};

const SOURCE_LABEL: Record<string, string> = {
  delivery: 'Delivery',
  table: 'Mesa',
  quick_sale: 'Balcão',
  reprint: 'Reimpressão',
  test: 'Teste',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  printing: 'Imprimindo',
  done: 'Impresso',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700',
  printing: 'bg-blue-500/15 text-blue-700',
  done: 'bg-emerald-500/15 text-emerald-700',
  failed: 'bg-red-500/15 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
};

export default function PrintSettingsPage() {
  const { restaurantId } = useEffectiveRestaurantId();
  const { data: store } = useStoreConfig();
  const { prefs, update, loading } = useStorePrintPrefs();
  const { stations, thisStation, deviceLabel, isSerialAvailable, register, remove } = usePrintStation();

  const [role, setRole] = useState<StationRole>('all');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (thisStation) { setRole(thisStation.role as StationRole); setName(thisStation.name); } }, [thisStation]);

  const handleRegister = async () => {
    setBusy(true);
    try {
      await register({ role, name: name || deviceLabel, paper_width: prefs.print_default_paper_width, copies: prefs.print_default_copies });
      toast.success('Este aparelho agora imprime pedidos.');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao registrar estação');
    } finally { setBusy(false); }
  };

  const handleUnregister = async () => {
    if (!thisStation) return;
    if (!confirm('Remover este aparelho da lista de estações de impressão?')) return;
    await remove(thisStation.id);
    toast.success('Estação removida.');
  };

  const handleConnectSerial = async () => {
    if (!isSerialAvailable) { toast.error('Web Serial não disponível aqui. Use Chrome/Edge fora do preview.'); return; }
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      await port.close(); // just to authorize; runner will reopen
      toast.success('Impressora autorizada! Ela ficará vinculada a este aparelho.');
    } catch (e: any) {
      if (e?.name !== 'NotFoundError') toast.error(e?.message || 'Falha ao conectar');
    }
  };

  const handleTest = async () => {
    if (!restaurantId) return;
    await enqueuePrintJob({
      restaurantId,
      source: 'test',
      sourceId: `test-${Date.now()}`,
      stationRole: role,
      payload: {
        orderNumber: `TESTE-${Date.now().toString().slice(-4)}`,
        orderType: 'quick_sale',
        customerName: 'Teste de Impressão',
        items: [
          { name: 'Item de teste', quantity: 1, unitPrice: 10 },
        ],
        subtotal: 10, total: 10,
        paymentMethod: 'Dinheiro',
        createdAt: new Date(),
        storeInfo: { name: store?.name || 'Meu Restaurante', address: store?.address, phone: store?.phone_whatsapp, logoUrl: store?.logo_url },
      } as any,
    });
    toast.success('Teste enviado para a fila.');
  };

  if (loading) {
    return <AdminLayout title="Impressão"><div className="p-6 text-sm text-muted-foreground">Carregando…</div></AdminLayout>;
  }

  return (
    <AdminLayout title="Impressão">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Impressão</h1>
          <p className="text-sm text-muted-foreground">Configure a impressão automática de pedidos, estações e acompanhe a fila.</p>
        </div>

        <Tabs defaultValue="auto">
          <TabsList>
            <TabsTrigger value="auto">Automação</TabsTrigger>
            <TabsTrigger value="device">Este aparelho</TabsTrigger>
            <TabsTrigger value="stations">Impressoras</TabsTrigger>
            <TabsTrigger value="queue">Fila</TabsTrigger>
          </TabsList>

          {/* ============ Automação ============ */}
          <TabsContent value="auto" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5"/> Impressão automática</CardTitle>
                <CardDescription>Cada novo pedido entra na fila e é impresso pela estação designada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Row label="Impressão automática" hint="Chave geral (liga/desliga tudo)">
                  <Switch checked={prefs.auto_print_enabled} onCheckedChange={(v)=>update({ auto_print_enabled: v })}/>
                </Row>
                <div className="border-t pt-4 space-y-3">
                  <Row label="Delivery">
                    <Switch checked={prefs.auto_print_delivery} disabled={!prefs.auto_print_enabled} onCheckedChange={(v)=>update({ auto_print_delivery: v })}/>
                  </Row>
                  <Row label="Mesa / Comanda">
                    <Switch checked={prefs.auto_print_table} disabled={!prefs.auto_print_enabled} onCheckedChange={(v)=>update({ auto_print_table: v })}/>
                  </Row>
                  <Row label="Vendas de balcão (PDV)">
                    <Switch checked={prefs.auto_print_quick_sale} disabled={!prefs.auto_print_enabled} onCheckedChange={(v)=>update({ auto_print_quick_sale: v })}/>
                  </Row>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <Row label="Separar por departamento" hint="Emite tickets separados para Cozinha e Bar.">
                    <Switch checked={prefs.print_split_by_department} onCheckedChange={(v)=>update({ print_split_by_department: v })}/>
                  </Row>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Largura padrão</Label>
                      <Select value={String(prefs.print_default_paper_width)} onValueChange={(v)=>update({ print_default_paper_width: (Number(v) as 32|48) })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="48">80mm (48 colunas)</SelectItem>
                          <SelectItem value="32">58mm (32 colunas)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Cópias por pedido</Label>
                      <Select value={String(prefs.print_default_copies)} onValueChange={(v)=>update({ print_default_copies: (Number(v) as 1|2|3) })}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 via</SelectItem>
                          <SelectItem value="2">2 vias</SelectItem>
                          <SelectItem value="3">3 vias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ Este aparelho ============ */}
          <TabsContent value="device" className="space-y-4">
            {!isSerialAvailable && (
              <Card className="border-yellow-500/40 bg-yellow-500/5">
                <CardContent className="pt-6 flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5"/>
                  <div className="text-sm">
                    <p className="font-medium">Impressora USB indisponível aqui</p>
                    <p className="text-muted-foreground">A conexão direta com a impressora térmica exige Chrome/Edge fora do preview do editor. A impressão pela janela do navegador continua funcionando.</p>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Tornar este aparelho uma estação de impressão</CardTitle>
                <CardDescription>Este aparelho vai receber os jobs da fila e imprimir automaticamente.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Apelido</Label>
                  <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder={deviceLabel}/>
                </div>
                <div className="grid gap-2">
                  <Label>Papel desta estação</Label>
                  <Select value={role} onValueChange={(v)=>setRole(v as StationRole)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABEL) as StationRole[]).map((r)=>(
                        <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleRegister} disabled={busy}>
                    <Printer className="h-4 w-4 mr-2"/> {thisStation ? 'Atualizar registro' : 'Registrar este aparelho'}
                  </Button>
                  {thisStation && (
                    <Button variant="outline" onClick={handleUnregister}>
                      <Trash2 className="h-4 w-4 mr-2"/> Remover
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleConnectSerial} disabled={!isSerialAvailable}>
                    <Usb className="h-4 w-4 mr-2"/> Autorizar impressora USB
                  </Button>
                  <Button variant="secondary" onClick={handleTest}>
                    <TestTube2 className="h-4 w-4 mr-2"/> Enviar teste para a fila
                  </Button>
                </div>
                {thisStation && (
                  <p className="text-xs text-muted-foreground">
                    Última atividade: {thisStation.last_seen_at ? formatDistanceToNow(new Date(thisStation.last_seen_at), { addSuffix: true, locale: ptBR }) : 'agora'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ Estações ============ */}
          <TabsContent value="stations">
            <Card>
              <CardHeader>
                <CardTitle>Estações registradas</CardTitle>
                <CardDescription>Impressoras vinculadas a este restaurante.</CardDescription>
              </CardHeader>
              <CardContent>
                {stations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma estação. Registre um aparelho na aba "Este aparelho".</p>
                ) : (
                  <div className="space-y-2">
                    {stations.map((s)=>{
                      const online = s.last_seen_at && Date.now() - new Date(s.last_seen_at).getTime() < 2*60_000;
                      return (
                        <div key={s.id} className="flex items-center justify-between border rounded-lg p-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{s.name}</span>
                              <Badge variant="outline">{ROLE_LABEL[s.role as StationRole]}</Badge>
                              {online ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Wifi className="h-3 w-3"/>online</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><WifiOff className="h-3 w-3"/>offline</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {s.paper_width===48?'80mm':'58mm'} • {s.copies} via(s) • última atividade {s.last_seen_at ? formatDistanceToNow(new Date(s.last_seen_at),{addSuffix:true,locale:ptBR}) : '—'}
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={()=>remove(s.id)}>
                            <Trash2 className="h-4 w-4"/>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ Fila ============ */}
          <TabsContent value="queue">
            <PrintQueueTab restaurantId={restaurantId} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label className="text-base">{label}</Label>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function PrintQueueTab({ restaurantId }: { restaurantId: string | null }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data } = await supabase.from('print_jobs').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(50);
    setJobs((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase
      .channel(`print-jobs-list-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs', filter: `restaurant_id=eq.${restaurantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId]);

  const retry = async (id: string) => {
    await supabase.from('print_jobs').update({ status: 'pending', attempts: 0, last_error: null }).eq('id', id);
    toast.success('Reenviado para impressão');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Últimas impressões</CardTitle>
          <CardDescription>Últimos 50 jobs. Falhas podem ser reimprimidas.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading?'animate-spin':''}`}/> Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum job ainda.</p>
        ) : jobs.map((j)=>(
          <div key={j.id} className="flex items-center justify-between border rounded-lg p-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">#{j.payload?.orderNumber || '-'}</span>
                <Badge variant="outline">{SOURCE_LABEL[j.source] || j.source}</Badge>
                <Badge variant="outline">{j.station_role}</Badge>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLOR[j.status]}`}>{STATUS_LABEL[j.status] || j.status}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: ptBR })}
                {j.attempts>0 && ` • ${j.attempts} tentativa(s)`}
                {j.last_error && ` • erro: ${j.last_error.slice(0,60)}`}
              </div>
            </div>
            <div className="flex gap-2">
              {(j.status==='failed' || j.status==='done') && (
                <Button variant="outline" size="sm" onClick={()=>retry(j.id)}>Reimprimir</Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
