import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from '@/hooks/useEffectiveRestaurantId';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { translateSefaz } from '@/lib/sefazErrors';
import { FiscalSettings } from '@/components/admin/FiscalSettings';
import {
  Loader2, RefreshCw, Download, XCircle, ExternalLink, Printer, Archive, FileText,
  AlertTriangle, ShieldAlert, Ban, Wifi, WifiOff, PlayCircle, ClipboardCheck,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const statusLabel: Record<string, { label: string; variant: any }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  processing: { label: 'Processando', variant: 'secondary' },
  authorized: { label: 'Autorizada', variant: 'default' },
  rejected: { label: 'Rejeitada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'outline' },
  error: { label: 'Erro', variant: 'destructive' },
};
const brl = (v?: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))', 'hsl(var(--accent))'];

// ---------- NOTAS TAB ----------
function NotasTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [justificativa, setJustificativa] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['fiscal-invoices', restaurantId, status, search],
    queryFn: async () => {
      let q = supabase.from('fiscal_invoices' as any).select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }).limit(200);
      if (status !== 'all') q = q.eq('status', status);
      if (search) q = q.or(`chave_acesso.ilike.%${search}%,customer_name.ilike.%${search}%,customer_cpf.ilike.%${search}%`);
      const { data } = await q;
      return (data as any[]) ?? [];
    },
  });

  const checkMut = useMutation({
    mutationFn: async (invoice_id: string) => {
      const { error } = await supabase.functions.invoke('fiscal-check-nfce', { body: { invoice_id } });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-invoices'] }),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!cancelTarget) return;
      const { error } = await supabase.functions.invoke('fiscal-cancel-nfce', {
        body: { invoice_id: cancelTarget.id, justificativa },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Nota cancelada' });
      setCancelTarget(null); setJustificativa('');
      qc.invalidateQueries({ queryKey: ['fiscal-invoices'] });
    },
    onError: (e: any) => toast({ title: 'Falha ao cancelar', description: e.message, variant: 'destructive' }),
  });

  const reprint = (inv: any) => {
    if (!inv.danfe_url) {
      toast({ title: 'DANFE indisponível', variant: 'destructive' });
      return;
    }
    const w = window.open(inv.danfe_url, '_blank', 'noopener,noreferrer');
    // Try to auto-trigger the print dialog after load
    if (w) setTimeout(() => { try { w.focus(); w.print(); } catch { /* ignore */ } }, 1500);
  };

  const exportCsv = () => {
    const header = ['data', 'status', 'numero', 'serie', 'chave', 'cliente', 'cpf', 'valor', 'pagamento'];
    const rows = invoices.map((i: any) => [
      new Date(i.created_at).toLocaleString('pt-BR'),
      statusLabel[i.status]?.label ?? i.status,
      i.numero ?? '', i.serie ?? '', i.chave_acesso ?? '',
      i.customer_name ?? '', i.customer_cpf ?? '',
      Number(i.valor_total ?? 0).toFixed(2), i.payment_method ?? '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `nfce-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const bulkDownloadXml = async () => {
    const list = invoices.filter((i: any) => i.status === 'authorized' && i.xml_url);
    if (list.length === 0) { toast({ title: 'Nenhuma XML disponível', variant: 'destructive' }); return; }
    setBulkLoading(true);
    try {
      const zip = new JSZip(); let ok = 0;
      for (const inv of list) {
        try {
          const res = await fetch(inv.xml_url);
          if (!res.ok) continue;
          zip.file(`${inv.chave_acesso ?? inv.reference}.xml`, await res.text()); ok++;
        } catch { /* skip */ }
      }
      if (ok === 0) throw new Error('Falha ao baixar XMLs');
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `nfce-xmls-${Date.now()}.zip`; a.click();
      URL.revokeObjectURL(url);
      toast({ title: `${ok} XML(s) baixados` });
    } catch (e: any) { toast({ title: 'Erro no download em lote', description: e.message, variant: 'destructive' }); }
    finally { setBulkLoading(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="authorized">Autorizadas</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="rejected">Rejeitadas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
              <SelectItem value="error">Erro</SelectItem>
            </SelectContent>
          </Select>
          <Input className="w-72" placeholder="Buscar chave, CPF ou nome" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" onClick={bulkDownloadXml} disabled={bulkLoading}>
            {bulkLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Archive className="h-4 w-4 mr-1" />}
            XMLs (ZIP)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma nota emitida ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((i: any) => {
                  const s = statusLabel[i.status] ?? { label: i.status, variant: 'outline' };
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs">{new Date(i.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                        {i.rejection_message && (() => {
                          const t = translateSefaz(i.rejection_message);
                          return (
                            <div className="mt-1 text-[11px] text-destructive max-w-[280px]" title={t.raw}>
                              {t.title}
                              {t.hint && <div className="text-muted-foreground">{t.hint}</div>}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs">{i.numero ? `${i.numero}/${i.serie}` : '—'}</TableCell>
                      <TableCell className="text-xs">{i.customer_name ?? (i.customer_cpf ? `CPF ${i.customer_cpf}` : 'Consumidor')}</TableCell>
                      <TableCell className="font-medium">{brl(i.valor_total)}</TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[220px] truncate">{i.chave_acesso ?? '—'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {i.danfe_url && (
                          <>
                            <Button size="icon" variant="ghost" title="Reimprimir DANFE" onClick={() => reprint(i)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Abrir DANFE" asChild>
                              <a href={i.danfe_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                            </Button>
                          </>
                        )}
                        {i.xml_url && (
                          <Button size="icon" variant="ghost" title="Baixar XML" asChild>
                            <a href={i.xml_url} target="_blank" rel="noreferrer" download><Download className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {i.status === 'processing' && (
                          <Button size="icon" variant="ghost" title="Verificar status" onClick={() => checkMut.mutate(i.id)} disabled={checkMut.isPending}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        {i.status === 'authorized' && (
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={() => setCancelTarget(i)}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar NFC-e</DialogTitle>
            <DialogDescription>Cancelamento aceito em até 30 minutos após a autorização. Justificativa mínima de 15 caracteres.</DialogDescription>
          </DialogHeader>
          <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Motivo do cancelamento" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => cancelMut.mutate()} disabled={justificativa.trim().length < 15 || cancelMut.isPending}>
              {cancelMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- RELATÓRIOS TAB ----------
function RelatoriosTab({ restaurantId }: { restaurantId: string }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const [from, setFrom] = useState(first.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const { data: invs = [], isLoading, refetch } = useQuery({
    queryKey: ['fiscal-report', restaurantId, from, to],
    queryFn: async () => {
      const { data } = await supabase.from('fiscal_invoices' as any)
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', `${from}T00:00:00Z`)
        .lte('created_at', `${to}T23:59:59Z`)
        .order('created_at', { ascending: true })
        .limit(2000);
      return (data as any[]) ?? [];
    },
  });

  const totals = useMemo(() => {
    const t = { total: invs.length, authorized: 0, rejected: 0, cancelled: 0, processing: 0, valor_autorizado: 0, valor_cancelado: 0 };
    for (const i of invs) {
      if (i.status === 'authorized') { t.authorized++; t.valor_autorizado += Number(i.valor_total ?? 0); }
      else if (i.status === 'rejected' || i.status === 'error') t.rejected++;
      else if (i.status === 'cancelled') { t.cancelled++; t.valor_cancelado += Number(i.valor_total ?? 0); }
      else if (i.status === 'processing') t.processing++;
    }
    return t;
  }, [invs]);

  const byDay = useMemo(() => {
    const map: Record<string, { day: string; autorizadas: number; rejeitadas: number; valor: number }> = {};
    for (const i of invs) {
      const d = new Date(i.created_at).toISOString().slice(0, 10);
      if (!map[d]) map[d] = { day: d.slice(5), autorizadas: 0, rejeitadas: 0, valor: 0 };
      if (i.status === 'authorized') { map[d].autorizadas++; map[d].valor += Number(i.valor_total ?? 0); }
      if (i.status === 'rejected' || i.status === 'error') map[d].rejeitadas++;
    }
    return Object.values(map);
  }, [invs]);

  const byPayment = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of invs) {
      if (i.status !== 'authorized') continue;
      const k = (i.payment_method || 'outros').toLowerCase();
      map[k] = (map[k] ?? 0) + Number(i.valor_total ?? 0);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [invs]);

  const exportCsv = () => {
    const header = ['data', 'status', 'numero', 'chave', 'cliente', 'valor', 'pagamento'];
    const rows = invs.map((i: any) => [
      new Date(i.created_at).toLocaleString('pt-BR'),
      statusLabel[i.status]?.label ?? i.status,
      i.numero ?? '', i.chave_acesso ?? '', i.customer_name ?? '',
      Number(i.valor_total ?? 0).toFixed(2), i.payment_method ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `relatorio-nfce-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total emitidas</CardDescription><CardTitle>{totals.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Autorizadas</CardDescription><CardTitle className="text-green-600">{totals.authorized}</CardTitle></CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">{brl(totals.valor_autorizado)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Rejeitadas</CardDescription><CardTitle className="text-destructive">{totals.rejected}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Canceladas</CardDescription><CardTitle>{totals.cancelled}</CardTitle></CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">{brl(totals.valor_cancelado)}</CardContent></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Emissão por dia</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            {isLoading ? <Loader2 className="animate-spin" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="autorizadas" fill="hsl(var(--primary))" />
                  <Bar dataKey="rejeitadas" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Vendas autorizadas por pagamento</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            {byPayment.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byPayment} dataKey="value" nameKey="name" outerRadius={90} label={(e) => `${e.name}: ${brl(e.value)}`}>
                    {byPayment.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------- CONTINGÊNCIA TAB ----------
function ContingenciaTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reprocessing, setReprocessing] = useState(false);
  const [inutOpen, setInutOpen] = useState(false);
  const [inut, setInut] = useState({ serie: 1, numero_inicial: 1, numero_final: 1, justificativa: '' });

  const { data: cfg, refetch: refetchCfg } = useQuery({
    queryKey: ['fiscal-config', restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from('fiscal_config' as any).select('*').eq('restaurant_id', restaurantId).maybeSingle();
      return data as any;
    },
  });

  const { data: pending = [], refetch: refetchPending } = useQuery({
    queryKey: ['fiscal-pending', restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from('fiscal_invoices' as any).select('id, reference, status, created_at, numero, valor_total, rejection_message')
        .eq('restaurant_id', restaurantId)
        .in('status', ['processing', 'rejected', 'error'])
        .order('created_at', { ascending: false }).limit(100);
      return (data as any[]) ?? [];
    },
  });

  const { data: inuts = [], refetch: refetchInuts } = useQuery({
    queryKey: ['fiscal-inuts', restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from('fiscal_inutilizacoes' as any).select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false }).limit(50);
      return (data as any[]) ?? [];
    },
  });

  const setMode = async (mode: string) => {
    const { error } = await supabase.from('fiscal_config' as any)
      .update({ contingency_mode: mode }).eq('restaurant_id', restaurantId);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Modo atualizado', description: `Contingência: ${mode.toUpperCase()}` });
    refetchCfg();
  };

  const runReprocess = async (retry_rejected: boolean) => {
    setReprocessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('fiscal-reprocess', {
        body: { restaurant_id: restaurantId, retry_rejected },
      });
      if (error) throw error;
      toast({ title: `${data?.processed ?? 0} nota(s) reprocessada(s)` });
      refetchPending();
      qc.invalidateQueries({ queryKey: ['fiscal-invoices'] });
    } catch (e: any) {
      toast({ title: 'Falha no reprocessamento', description: e.message, variant: 'destructive' });
    } finally { setReprocessing(false); }
  };

  const submitInut = async () => {
    try {
      const { error } = await supabase.functions.invoke('fiscal-inutilizar-numeracao', {
        body: { restaurant_id: restaurantId, ...inut },
      });
      if (error) throw error;
      toast({ title: 'Inutilização enviada à SEFAZ' });
      setInutOpen(false);
      setInut({ serie: 1, numero_inicial: 1, numero_final: 1, justificativa: '' });
      refetchInuts();
    } catch (e: any) {
      toast({ title: 'Falha ao inutilizar', description: e.message, variant: 'destructive' });
    }
  };

  const mode = cfg?.contingency_mode ?? 'normal';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mode === 'normal' ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-amber-600" />}
            Modo de emissão
          </CardTitle>
          <CardDescription>
            Use SVC quando a SEFAZ do seu estado estiver indisponível. Volte para "Normal" assim que o serviço regularizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>Modo atual</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal (SEFAZ estado)</SelectItem>
                <SelectItem value="svc_an">SVC-AN (contingência nacional)</SelectItem>
                <SelectItem value="svc_rs">SVC-RS (contingência RS)</SelectItem>
                <SelectItem value="offline">Offline (emitir depois)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode !== 'normal' && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Em contingência</Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PlayCircle className="h-5 w-5" /> Notas pendentes / rejeitadas</CardTitle>
          <CardDescription>Consulta a SEFAZ pelas notas em processamento e permite reenviar as que foram rejeitadas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => runReprocess(false)} disabled={reprocessing}>
              {reprocessing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Verificar pendentes
            </Button>
            <Button variant="secondary" onClick={() => runReprocess(true)} disabled={reprocessing}>
              <ShieldAlert className="h-4 w-4 mr-2" /> Reenviar rejeitadas
            </Button>
          </div>
          {pending.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma nota pendente 🎉</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Status</TableHead>
                  <TableHead>Nº</TableHead><TableHead>Valor</TableHead><TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((p: any) => {
                  const s = statusLabel[p.status] ?? { label: p.status, variant: 'outline' };
                  const t = p.rejection_message ? translateSefaz(p.rejection_message) : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{new Date(p.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      <TableCell className="text-xs">{p.numero ?? '—'}</TableCell>
                      <TableCell className="text-xs">{brl(p.valor_total)}</TableCell>
                      <TableCell className="text-xs max-w-[380px]">{t ? <><div>{t.title}</div>{t.hint && <div className="text-muted-foreground">{t.hint}</div>}</> : '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Ban className="h-5 w-5" /> Inutilização de numeração</CardTitle>
              <CardDescription>Descarta oficialmente uma faixa de números NFC-e que não será mais usada (ex.: falha entre autorizações).</CardDescription>
            </div>
            <Button onClick={() => setInutOpen(true)}><Ban className="h-4 w-4 mr-2" /> Nova inutilização</Button>
          </div>
        </CardHeader>
        <CardContent>
          {inuts.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma inutilização registrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Status</TableHead>
                  <TableHead>Série</TableHead><TableHead>Faixa</TableHead>
                  <TableHead>Justificativa</TableHead><TableHead>Protocolo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inuts.map((it: any) => {
                  const s = statusLabel[it.status] ?? { label: it.status, variant: 'outline' };
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="text-xs">{new Date(it.created_at).toLocaleString('pt-BR')}</TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge>
                        {it.rejection_message && <div className="text-[11px] text-destructive mt-1">{translateSefaz(it.rejection_message).title}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{it.serie}</TableCell>
                      <TableCell className="text-xs">{it.numero_inicial} — {it.numero_final}</TableCell>
                      <TableCell className="text-xs max-w-[280px]">{it.justificativa}</TableCell>
                      <TableCell className="text-xs font-mono">{it.protocolo ?? '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={inutOpen} onOpenChange={setInutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inutilizar faixa de numeração</DialogTitle>
            <DialogDescription>Use apenas para números que não geraram NFC-e autorizada. Justificativa mínima de 15 caracteres.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Série</Label>
              <Input type="number" value={inut.serie} onChange={(e) => setInut({ ...inut, serie: Number(e.target.value) })} />
            </div>
            <div className="space-y-1"><Label>Número inicial</Label>
              <Input type="number" value={inut.numero_inicial} onChange={(e) => setInut({ ...inut, numero_inicial: Number(e.target.value) })} />
            </div>
            <div className="space-y-1"><Label>Número final</Label>
              <Input type="number" value={inut.numero_final} onChange={(e) => setInut({ ...inut, numero_final: Number(e.target.value) })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Justificativa</Label>
            <Textarea rows={3} value={inut.justificativa} onChange={(e) => setInut({ ...inut, justificativa: e.target.value })} placeholder="Ex.: falha no sistema entre as numerações XXXX e YYYY" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInutOpen(false)}>Cancelar</Button>
            <Button onClick={submitInut} disabled={inut.justificativa.trim().length < 15 || inut.numero_final < inut.numero_inicial}>
              <ClipboardCheck className="h-4 w-4 mr-2" /> Enviar à SEFAZ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- MAIN ----------
export default function AdminFiscalPanel() {
  const { restaurantId } = useEffectiveRestaurantId();
  const [tab, setTab] = useState('notas');

  if (!restaurantId) {
    return <AdminLayout title="Fiscal"><div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div></AdminLayout>;
  }

  return (
    <AdminLayout title="Painel Fiscal">
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto">
          <TabsTrigger value="notas"><FileText className="h-4 w-4 mr-1" /> Notas</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="contingencia"><WifiOff className="h-4 w-4 mr-1" /> Contingência</TabsTrigger>
          <TabsTrigger value="chaves">Chaves & Certificado</TabsTrigger>
        </TabsList>
        <TabsContent value="notas"><NotasTab restaurantId={restaurantId} /></TabsContent>
        <TabsContent value="relatorios"><RelatoriosTab restaurantId={restaurantId} /></TabsContent>
        <TabsContent value="contingencia"><ContingenciaTab restaurantId={restaurantId} /></TabsContent>
        <TabsContent value="chaves"><FiscalSettings /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
