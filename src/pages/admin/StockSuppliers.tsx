import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useSuppliers, useUpsertSupplier, useDeleteSupplier, type Supplier } from '@/hooks/useStock';
import { useToast } from '@/hooks/use-toast';

export default function StockSuppliers() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const upsert = useUpsertSupplier();
  const del = useDeleteSupplier();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);

  const save = async () => {
    if (!editing?.name) return;
    try { await upsert.mutateAsync(editing as any); toast({ title: 'Fornecedor salvo' }); setEditing(null); }
    catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
  };

  return (
    <AdminLayout title="Fornecedores">
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Fornecedores</h1>
            <p className="text-sm text-muted-foreground">Cadastre seus fornecedores para vincular às compras.</p>
          </div>
          <Button onClick={() => setEditing({ name: '', is_active: true })}><Plus className="h-4 w-4 mr-2" />Novo fornecedor</Button>
        </div>

        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-3 px-4">Nome</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">E-mail</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Carregando…</td></tr>}
                {!isLoading && suppliers.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum fornecedor.</td></tr>}
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-3 px-4 font-medium">{s.name}</td>
                    <td className="py-3 px-4">{s.document ?? '—'}</td>
                    <td className="py-3 px-4">{s.contact_name ?? '—'}</td>
                    <td className="py-3 px-4">{s.phone ?? '—'}</td>
                    <td className="py-3 px-4">{s.email ?? '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => {
                        if (!confirm(`Excluir "${s.name}"?`)) return;
                        try { await del.mutateAsync(s.id); toast({ title: 'Excluído' }); }
                        catch (e: any) { toast({ title: 'Erro', description: e.message, variant: 'destructive' }); }
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editing?.name ?? ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>CNPJ/CPF</Label><Input value={editing?.document ?? ''} onChange={(e) => setEditing({ ...editing!, document: e.target.value })} /></div>
              <div><Label>Contato</Label><Input value={editing?.contact_name ?? ''} onChange={(e) => setEditing({ ...editing!, contact_name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={editing?.phone ?? ''} onChange={(e) => setEditing({ ...editing!, phone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={editing?.email ?? ''} onChange={(e) => setEditing({ ...editing!, email: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea rows={2} value={editing?.notes ?? ''} onChange={(e) => setEditing({ ...editing!, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
