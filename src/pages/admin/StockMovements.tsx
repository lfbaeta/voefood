import { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useStockMovements, useStockItems } from '@/hooks/useStock';

const TYPE_LABEL: Record<string, string> = {
  entrada_compra: 'Entrada',
  saida_venda: 'Venda',
  ajuste: 'Ajuste',
  perda: 'Perda',
  producao: 'Produção',
  transferencia: 'Transferência',
};

export default function StockMovements() {
  const { data: movements = [], isLoading } = useStockMovements(500);
  const { data: items = [] } = useStockItems();
  const [type, setType] = useState<string>('all');
  const [itemId, setItemId] = useState<string>('all');

  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const filtered = useMemo(() => {
    return movements.filter((m) => {
      if (type !== 'all' && m.type !== type) return false;
      if (itemId !== 'all' && m.stock_item_id !== itemId) return false;
      return true;
    });
  }, [movements, type, itemId]);

  const exportCsv = () => {
    const header = ['Data', 'Tipo', 'Insumo', 'Quantidade', 'Custo unit.', 'Custo total', 'Referência', 'Observação'];
    const rows = filtered.map((m) => [
      new Date(m.created_at).toLocaleString('pt-BR'),
      TYPE_LABEL[m.type] ?? m.type,
      itemById[m.stock_item_id ?? '']?.name ?? '—',
      m.quantity, m.unit_cost, m.total_cost,
      `${m.reference_type ?? ''}${m.reference_id ? ` #${m.reference_id}` : ''}`,
      (m.notes ?? '').replace(/[\n;]/g, ' '),
    ]);
    const csv = [header, ...rows].map((r) => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `movimentacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Movimentações de Estoque">
      <div className="space-y-6">
        <div className="flex flex-wrap justify-between gap-3 items-end">
          <div>
            <h1 className="text-2xl font-bold">Movimentações</h1>
            <p className="text-sm text-muted-foreground">Histórico completo e auditável de estoque.</p>
          </div>
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-3">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Insumo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos insumos</SelectItem>
                  {items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4">Insumo</th>
                    <th className="py-2 pr-4 text-right">Quantidade</th>
                    <th className="py-2 pr-4 text-right">Custo</th>
                    <th className="py-2 pr-4">Referência</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>}
                  {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhuma movimentação.</td></tr>}
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                      <td className="py-2 pr-4"><Badge variant="outline">{TYPE_LABEL[m.type] ?? m.type}</Badge></td>
                      <td className="py-2 pr-4">{itemById[m.stock_item_id ?? '']?.name ?? '—'}</td>
                      <td className="py-2 pr-4 text-right font-mono">
                        <span className={m.quantity < 0 ? 'text-destructive' : 'text-green-600'}>
                          {m.quantity > 0 ? '+' : ''}{Number(m.quantity).toLocaleString('pt-BR')}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">R$ {Number(m.total_cost).toFixed(2)}</td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">
                        {m.reference_type ?? '—'}{m.reference_id ? ` #${m.reference_id}` : ''}
                        {m.notes ? <div className="italic">{m.notes}</div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
