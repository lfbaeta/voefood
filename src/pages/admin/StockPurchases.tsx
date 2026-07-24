import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, CheckCircle2, Trash2, X } from 'lucide-react';
import {
  usePurchases, useCreatePurchase, useReceivePurchase, useDeletePurchase,
  useSuppliers, useStockItems,
} from '@/hooks/useStock';
import { useToast } from '@/hooks/use-toast';

type LineItem = { stock_item_id: string; quantity: number; unit_cost: number };

export default function StockPurchases() {
  const { data: purchases = [], isLoading } = usePurchases();
  const { data: suppliers = [] } = useSuppliers();
  const { data: items = [] } = useStockItems();
  const create = useCreatePurchase();
  const receive = useReceivePurchase();
  const del = useDeletePurchase();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>('');
  const [invoice, setInvoice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ stock_item_id: '', quantity: 1, unit_cost: 0 }]);

  const total = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_cost || 0), 0);

  const reset = () => {
    setSupplierId(''); setInvoice(''); setDate(new Date().toISOString().slice(0, 10));
    setNotes(''); setLines([{ stock_item_id: '', quantity: 1, unit_cost: 0 }]);
  };

  const submit = async () => {
    const valid = lines.filter((l) => l.stock_item_id && l.quantity > 0);
    if (!valid.length) { toast({ title: 'Adicione ao menos 1 item', variant: 'destructive' }); return; }
    try {
      await create.mutateAsync({
        supplier_id: supplierId || null,
        invoice_number: invoice || undefined,
        purchase_date: date,
        notes: notes || undefined,
        items: valid,
      });
      toast({ title: 'Compra criada como rascunho' });
      setOpen(false); reset();
    } catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  const doReceive = async (id: string) => {
    if (!confirm('Confirmar recebimento? Isso dará entrada no estoque e recalculará o custo médio.')) return;
    try { await receive.mutateAsync(id); toast({ title: 'Compra recebida' }); }
    catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  return (
    <AdminLayout title="Compras">
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Compras</h1>
            <p className="text-sm text-muted-foreground">Registre entradas de mercadoria e receba para atualizar o estoque.</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova compra</Button>
        </div>

        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">Nº nota</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && purchases.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhuma compra.</td></tr>}
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3 px-4">{new Date(p.purchase_date).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 px-4">{suppliers.find((s) => s.id === p.supplier_id)?.name ?? '—'}</td>
                    <td className="py-3 px-4">{p.invoice_number ?? '—'}</td>
                    <td className="py-3 px-4 text-right">R$ {Number(p.total_amount).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      {p.status === 'draft' && <Badge variant="outline">Rascunho</Badge>}
                      {p.status === 'received' && <Badge className="bg-green-600 hover:bg-green-600">Recebida</Badge>}
                      {p.status === 'cancelled' && <Badge variant="destructive">Cancelada</Badge>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.status === 'draft' && (
                        <Button size="sm" onClick={() => doReceive(p.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" />Receber
                        </Button>
                      )}
                      {p.status === 'draft' && (
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (!confirm('Excluir compra?')) return;
                          try { await del.mutateAsync(p.id); toast({ title: 'Excluída' }); }
                          catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
                        }}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova compra</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Fornecedor</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº da nota</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
              <div><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            </div>

            <div className="space-y-2">
              <Label>Itens</Label>
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_120px_40px] gap-2">
                  <Select value={l.stock_item_id} onValueChange={(v) => {
                    const next = [...lines]; next[idx].stock_item_id = v; setLines(next);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o insumo" /></SelectTrigger>
                    <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="number" step="0.001" placeholder="Qtd" value={l.quantity}
                    onChange={(e) => { const n = [...lines]; n[idx].quantity = Number(e.target.value); setLines(n); }} />
                  <Input type="number" step="0.01" placeholder="Custo unit." value={l.unit_cost}
                    onChange={(e) => { const n = [...lines]; n[idx].unit_cost = Number(e.target.value); setLines(n); }} />
                  <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, i) => i !== idx))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLines([...lines, { stock_item_id: '', quantity: 1, unit_cost: 0 }])}>
                <Plus className="h-4 w-4 mr-2" />Adicionar item
              </Button>
            </div>

            <div><Label>Observações</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

            <div className="flex justify-end text-lg font-bold">Total: R$ {total.toFixed(2)}</div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending}>Salvar rascunho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
