import { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useProductRecipes, useUpsertRecipe, useDeleteRecipe, useStockItems, type StockUnit } from '@/hooks/useStock';
import { useToast } from '@/hooks/use-toast';

const UNITS: StockUnit[] = ['un', 'kg', 'g', 'L', 'ml'];

export default function StockRecipes() {
  const { data: products = [] } = useProducts();
  const { data: items = [] } = useStockItems();
  const [productId, setProductId] = useState<string>('');
  const { data: recipes = [], isLoading } = useProductRecipes(productId || undefined);
  const upsert = useUpsertRecipe();
  const del = useDeleteRecipe();
  const { toast } = useToast();

  const [newItem, setNewItem] = useState<{ stock_item_id: string; quantity: number; unit: StockUnit }>({
    stock_item_id: '', quantity: 1, unit: 'un',
  });

  const product = products.find((p) => p.id === productId);
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const unitCost = useMemo(() => {
    return recipes.reduce((s, r) => {
      const it = itemById[r.stock_item_id];
      if (!it) return s;
      return s + it.average_cost * r.quantity;
    }, 0);
  }, [recipes, itemById]);

  const margin = product && product.price > 0 ? ((product.price - unitCost) / product.price) * 100 : 0;

  const add = async () => {
    if (!productId || !newItem.stock_item_id || !newItem.quantity) return;
    try {
      await upsert.mutateAsync({ product_id: productId, ...newItem });
      setNewItem({ stock_item_id: '', quantity: 1, unit: 'un' });
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  return (
    <AdminLayout title="Ficha Técnica">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Ficha Técnica dos Produtos</h1>
          <p className="text-sm text-muted-foreground">Cadastre os insumos consumidos por unidade vendida para baixa automática e cálculo de CMV.</p>
        </div>

        <Card><CardContent className="p-4 space-y-4">
          <div>
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="max-w-md"><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {productId && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Preço de venda</p>
                  <p className="text-lg font-bold">R$ {product ? Number(product.price).toFixed(2) : '—'}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Custo unitário (insumos)</p>
                  <p className="text-lg font-bold">R$ {unitCost.toFixed(2)}</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Margem</p>
                  <p className={`text-lg font-bold ${margin < 0 ? 'text-destructive' : ''}`}>{margin.toFixed(1)}%</p>
                </div>
              </div>

              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-4">Insumo</th>
                      <th className="py-2 pr-4 text-right">Quantidade</th>
                      <th className="py-2 pr-4">Unidade</th>
                      <th className="py-2 pr-4 text-right">Custo</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Carregando…</td></tr>}
                    {!isLoading && recipes.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Nenhum insumo. Adicione abaixo.</td></tr>}
                    {recipes.map((r) => {
                      const it = itemById[r.stock_item_id];
                      return (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">{it?.name ?? '—'}</td>
                          <td className="py-2 pr-4 text-right font-mono">{r.quantity}</td>
                          <td className="py-2 pr-4">{r.unit}</td>
                          <td className="py-2 pr-4 text-right">R$ {(it ? it.average_cost * r.quantity : 0).toFixed(2)}</td>
                          <td className="py-2 text-right">
                            <Button variant="ghost" size="icon" onClick={async () => {
                              await del.mutateAsync(r.id);
                            }}><Trash2 className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-2">Adicionar insumo</p>
                <div className="grid grid-cols-[1fr_100px_100px_auto] gap-2">
                  <Select value={newItem.stock_item_id} onValueChange={(v) => setNewItem({ ...newItem, stock_item_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o insumo" /></SelectTrigger>
                    <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" step="0.001" value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: Number(e.target.value) })} />
                  <Select value={newItem.unit} onValueChange={(v: any) => setNewItem({ ...newItem, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={add} disabled={upsert.isPending}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
                </div>
              </div>
            </>
          )}
        </CardContent></Card>
      </div>
    </AdminLayout>
  );
}
