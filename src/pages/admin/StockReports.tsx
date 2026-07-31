import { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStockMovements, useStockItems } from '@/hooks/useStock';

export default function StockReports() {
  const { data: movements = [] } = useStockMovements(1000);
  const { data: items = [] } = useStockItems();

  const today = new Date();
  const startDefault = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const endDefault = today.toISOString().slice(0, 10);
  const [start, setStart] = useState(startDefault);
  const [end, setEnd] = useState(endDefault);

  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const inRange = useMemo(() => {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime() + 24 * 3600 * 1000;
    return movements.filter((m) => {
      const t = new Date(m.created_at).getTime();
      return t >= s && t < e;
    });
  }, [movements, start, end]);

  const cmv = useMemo(() => inRange.filter((m) => m.type === 'saida_venda')
    .reduce((s, m) => s + Math.abs(Number(m.total_cost || 0)), 0), [inRange]);
  const perdas = useMemo(() => inRange.filter((m) => m.type === 'perda')
    .reduce((s, m) => s + Math.abs(Number(m.total_cost || 0)), 0), [inRange]);
  const compras = useMemo(() => inRange.filter((m) => m.type === 'entrada_compra')
    .reduce((s, m) => s + Math.abs(Number(m.total_cost || 0)), 0), [inRange]);
  const valorEstoque = useMemo(() => items.reduce((s, i) => s + i.current_qty * i.average_cost, 0), [items]);

  const topConsumo = useMemo(() => {
    const map = new Map<string, number>();
    inRange.filter((m) => m.type === 'saida_venda').forEach((m) => {
      if (!m.stock_item_id) return;
      map.set(m.stock_item_id, (map.get(m.stock_item_id) ?? 0) + Math.abs(Number(m.quantity)));
    });
    return Array.from(map.entries())
      .map(([id, qty]) => ({ item: itemById[id], qty }))
      .filter((r) => r.item)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  }, [inRange, itemById]);

  return (
    <AdminLayout title="Relatórios de Estoque">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Relatórios de Estoque</h1>
          <p className="text-sm text-muted-foreground">CMV, compras, perdas e giro no período.</p>
        </div>

        <Card><CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label>Início</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label>Fim</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
        </CardContent></Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="CMV (Custo das Vendas)" value={`R$ ${cmv.toFixed(2)}`} />
          <Metric label="Compras no período" value={`R$ ${compras.toFixed(2)}`} />
          <Metric label="Perdas" value={`R$ ${perdas.toFixed(2)}`} tone="danger" />
          <Metric label="Valor total em estoque" value={`R$ ${valorEstoque.toFixed(2)}`} />
        </div>

        <Card><CardContent className="p-4 space-y-3">
          <h2 className="font-semibold">Top 10 insumos mais consumidos</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4">Insumo</th>
                <th className="py-2 pr-4 text-right">Consumo</th>
                <th className="py-2 pr-4 text-right">Estoque atual</th>
              </tr>
            </thead>
            <tbody>
              {topConsumo.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Nenhum consumo no período.</td></tr>}
              {topConsumo.map((r) => (
                <tr key={r.item.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{r.item.name}</td>
                  <td className="py-2 pr-4 text-right font-mono">{r.qty.toFixed(3)} {r.item.unit}</td>
                  <td className="py-2 pr-4 text-right">{Number(r.item.current_qty).toFixed(3)} {r.item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      </div>
    </AdminLayout>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${tone === 'danger' ? 'text-destructive' : ''}`}>{value}</p>
    </CardContent></Card>
  );
}
