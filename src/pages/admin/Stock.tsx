import { useState, useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Package, AlertTriangle, TrendingDown, DollarSign, Search, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useStockItems, useUpsertStockItem, useDeleteStockItem, useRegisterMovement,
  type StockItem, type StockUnit,
} from '@/hooks/useStock';

const UNIT_OPTIONS: StockUnit[] = ['un', 'kg', 'g', 'L', 'ml'];

export default function Stock() {
  const { data: items = [], isLoading } = useStockItems();
  const upsert = useUpsertStockItem();
  const del = useDeleteStockItem();
  const { toast } = useToast();

  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'zero'>('all');
  const [editing, setEditing] = useState<Partial<StockItem> | null>(null);
  const [moveItem, setMoveItem] = useState<StockItem | null>(null);

  const filtered = useMemo(() => {
    let list = items;
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
    if (filter === 'low') list = list.filter((i) => i.current_qty <= i.min_qty && i.current_qty > 0);
    if (filter === 'zero') list = list.filter((i) => i.current_qty <= 0);
    return list;
  }, [items, q, filter]);

  const stats = useMemo(() => {
    const totalValue = items.reduce((s, i) => s + i.current_qty * i.average_cost, 0);
    const low = items.filter((i) => i.current_qty <= i.min_qty).length;
    const zero = items.filter((i) => i.current_qty <= 0).length;
    return { total: items.length, totalValue, low, zero };
  }, [items]);

  const handleSave = async () => {
    if (!editing?.name) return;
    try {
      await upsert.mutateAsync(editing as any);
      toast({ title: 'Insumo salvo' });
      setEditing(null);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <AdminLayout title="Estoque">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Controle de Estoque</h1>
            <p className="text-sm text-muted-foreground">Gerencie insumos, quantidade, custo médio e mínimos.</p>
          </div>
          <Button onClick={() => setEditing({ name: '', unit: 'un', current_qty: 0, min_qty: 0, is_active: true })}>
            <Plus className="h-4 w-4 mr-2" />Novo insumo
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Package} label="Insumos cadastrados" value={String(stats.total)} />
          <StatCard icon={DollarSign} label="Valor em estoque" value={`R$ ${stats.totalValue.toFixed(2)}`} />
          <StatCard icon={AlertTriangle} label="Abaixo do mínimo" value={String(stats.low)} tone="warning" />
          <StatCard icon={TrendingDown} label="Zerados" value={String(stats.zero)} tone="danger" />
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar insumo…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Baixo estoque</SelectItem>
                  <SelectItem value="zero">Zerados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4">Insumo</th>
                    <th className="py-2 pr-4">SKU</th>
                    <th className="py-2 pr-4">Qtd atual</th>
                    <th className="py-2 pr-4">Mínimo</th>
                    <th className="py-2 pr-4">Custo médio</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum insumo encontrado.</td></tr>
                  )}
                  {filtered.map((it) => {
                    const low = it.current_qty <= it.min_qty;
                    const zero = it.current_qty <= 0;
                    return (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">{it.name}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{it.sku ?? '—'}</td>
                        <td className="py-3 pr-4">{Number(it.current_qty).toLocaleString('pt-BR')} {it.unit}</td>
                        <td className="py-3 pr-4">{Number(it.min_qty).toLocaleString('pt-BR')} {it.unit}</td>
                        <td className="py-3 pr-4">R$ {Number(it.average_cost).toFixed(2)}</td>
                        <td className="py-3 pr-4">
                          {zero ? <Badge variant="destructive">Esgotado</Badge>
                            : low ? <Badge className="bg-yellow-500 hover:bg-yellow-500">Baixo</Badge>
                            : <Badge variant="outline">Ok</Badge>}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => setMoveItem(it)} title="Nova movimentação">
                              <ArrowUpDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setEditing(it)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              if (!confirm(`Excluir "${it.name}"?`)) return;
                              try { await del.mutateAsync(it.id); toast({ title: 'Excluído' }); }
                              catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
                            }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal edição */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar insumo' : 'Novo insumo'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editing?.name ?? ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>SKU</Label>
                <Input value={editing?.sku ?? ''} onChange={(e) => setEditing({ ...editing!, sku: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={editing?.category ?? ''} onChange={(e) => setEditing({ ...editing!, category: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unidade</Label>
                <Select value={editing?.unit ?? 'un'} onValueChange={(v) => setEditing({ ...editing!, unit: v as StockUnit })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantidade atual</Label>
                <Input type="number" step="0.001" value={editing?.current_qty ?? 0}
                  onChange={(e) => setEditing({ ...editing!, current_qty: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Estoque mínimo</Label>
                <Input type="number" step="0.001" value={editing?.min_qty ?? 0}
                  onChange={(e) => setEditing({ ...editing!, min_qty: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Custo médio (R$)</Label>
                <Input type="number" step="0.01" value={editing?.average_cost ?? 0}
                  onChange={(e) => setEditing({ ...editing!, average_cost: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Último custo (R$)</Label>
                <Input type="number" step="0.01" value={editing?.last_cost ?? 0}
                  onChange={(e) => setEditing({ ...editing!, last_cost: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={2} value={editing?.notes ?? ''} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal movimentação */}
      <MovementDialog item={moveItem} onClose={() => setMoveItem(null)} />
    </AdminLayout>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-yellow-600' : 'text-primary';
  return (
    <Card><CardContent className="p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl bg-muted flex items-center justify-center ${color}`}><Icon className="h-5 w-5" /></div>
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold">{value}</p></div>
    </CardContent></Card>
  );
}

function MovementDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const [type, setType] = useState<'entrada_compra' | 'ajuste' | 'perda' | 'producao' | 'transferencia'>('entrada_compra');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const reg = useRegisterMovement();
  const { toast } = useToast();

  const submit = async () => {
    if (!item) return;
    const q = Number(qty);
    if (!q) { toast({ title: 'Informe a quantidade', variant: 'destructive' }); return; }
    try {
      await reg.mutateAsync({ stock_item_id: item.id, type, quantity: q, unit_cost: Number(cost) || 0, notes });
      toast({ title: 'Movimentação registrada' });
      setQty(''); setCost(''); setNotes('');
      onClose();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Movimentação — {item?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada_compra">Entrada / Compra</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
                <SelectItem value="ajuste">Ajuste (+/-)</SelectItem>
                <SelectItem value="perda">Perda / Quebra</SelectItem>
                <SelectItem value="transferencia">Transferência (+/-)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade ({item?.unit})</Label>
              <Input type="number" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)}
                placeholder={type === 'ajuste' || type === 'transferencia' ? 'Use - para diminuir' : ''} />
            </div>
            <div>
              <Label>Custo unitário (R$)</Label>
              <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={reg.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
