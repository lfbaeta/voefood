import { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2, Pizza as PizzaIcon } from 'lucide-react';
import {
  usePizzaSizes, usePizzaFlavors, usePizzaBorders,
  usePizzaFlavorPrices, usePizzaBorderPrices,
  useSavePizzaSize, useDeletePizzaSize,
  useSavePizzaFlavor, useDeletePizzaFlavor,
  useSavePizzaBorder, useDeletePizzaBorder,
  type PizzaSize, type PizzaFlavorCatalog, type PizzaBorderCatalog,
} from '@/hooks/usePizzeria';
import { useStoreConfig } from '@/hooks/useStore';
import { formatBRL } from '@/lib/pizza';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from '@/components/admin/ImageUpload';

export default function Pizzeria() {
  const { data: store } = useStoreConfig();
  const isPizzeria = (store as any)?.business_type === 'pizzeria';

  return (
    <AdminLayout title="Pizzaria">
      {!isPizzeria && (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="p-4 text-sm">
            Este módulo aparece para estabelecimentos configurados como <strong>Pizzaria</strong>.
            Você pode configurá-lo mesmo assim; para exibi-lo no cardápio do cliente, altere o tipo
            do estabelecimento em <strong>Configurações → Identidade do Cardápio</strong>.
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <PizzaIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Gestão da Pizzaria</h1>
          <p className="text-sm text-muted-foreground">Tamanhos, sabores e bordas do seu cardápio de pizzas.</p>
        </div>
      </div>

      <Tabs defaultValue="sizes">
        <TabsList>
          <TabsTrigger value="sizes">Tamanhos</TabsTrigger>
          <TabsTrigger value="flavors">Sabores</TabsTrigger>
          <TabsTrigger value="borders">Bordas</TabsTrigger>
        </TabsList>
        <TabsContent value="sizes"><SizesTab /></TabsContent>
        <TabsContent value="flavors"><FlavorsTab /></TabsContent>
        <TabsContent value="borders"><BordersTab /></TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

/* ---------- Sizes ---------- */
function SizesTab() {
  const { data: sizes = [], isLoading } = usePizzaSizes();
  const save = useSavePizzaSize();
  const del = useDeletePizzaSize();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<PizzaSize> | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tamanhos de Pizza</CardTitle>
        <Button size="sm" onClick={() => setEditing({ name: '', max_flavors: 2, base_price: 0, is_available: true, sort_order: sizes.length })}>
          <Plus className="h-4 w-4 mr-1" /> Novo tamanho
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {!isLoading && sizes.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum tamanho cadastrado.</p>
        )}
        {sizes.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="h-14 w-14 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
              {s.image_url ? (
                <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />
              ) : (
                <PizzaIcon className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{s.name} <span className="text-xs text-muted-foreground">· até {s.max_flavors} sabor{s.max_flavors > 1 ? 'es' : ''}</span></div>
              {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
              {s.base_price != null && <div className="text-xs text-muted-foreground">Preço base: {formatBRL(Number(s.base_price))}</div>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => {
                if (confirm(`Excluir "${s.name}"?`)) del.mutate(s.id, { onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.message }) });
              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar tamanho' : 'Novo tamanho'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <ImageUpload
                bucket="product-images"
                currentUrl={editing.image_url || null}
                onUpload={(url) => setEditing({ ...editing, image_url: url })}
                onRemove={() => setEditing({ ...editing, image_url: null })}
              />
              <div>
                <Label>Nome</Label>
                <Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex.: Pizza Grande" />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Ex.: 8 fatias, 35cm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Máx. sabores</Label>
                  <Select value={String(editing.max_flavors ?? 2)} onValueChange={(v) => setEditing({ ...editing, max_flavors: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n} sabor{n > 1 ? 'es' : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preço base (opcional)</Label>
                  <Input inputMode="decimal" value={String(editing.base_price ?? 0)} onChange={(e) => setEditing({ ...editing, base_price: parseFloat(e.target.value.replace(',', '.')) || 0 })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_available ?? true} onCheckedChange={(c) => setEditing({ ...editing, is_available: c })} />
                <Label>Disponível</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Os preços por sabor/borda deste tamanho são definidos nas abas <strong>Sabores</strong> e <strong>Bordas</strong>.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={save.isPending} onClick={() => {
              if (!editing?.name?.trim()) return;
              save.mutate(editing as any, {
                onSuccess: () => { setEditing(null); toast({ title: 'Salvo' }); },
                onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
              });
            }}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Flavors ---------- */
function FlavorsTab() {
  const { data: sizes = [] } = usePizzaSizes();
  const { data: flavors = [], isLoading } = usePizzaFlavors();
  const { data: prices = [] } = usePizzaFlavorPrices();
  const save = useSavePizzaFlavor();
  const del = useDeletePizzaFlavor();
  const { toast } = useToast();
  const [editing, setEditing] = useState<{ row: Partial<PizzaFlavorCatalog>; prices: Record<string, number> } | null>(null);

  const pricesByFlavor = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const p of prices) {
      map[p.flavor_id] = map[p.flavor_id] || {};
      map[p.flavor_id][p.size_id] = p.price;
    }
    return map;
  }, [prices]);

  const openEdit = (f?: PizzaFlavorCatalog) => {
    if (f) {
      setEditing({ row: { ...f }, prices: pricesByFlavor[f.id] || {} });
    } else {
      setEditing({ row: { name: '', ingredients: '', is_available: true, sort_order: flavors.length }, prices: {} });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sabores</CardTitle>
        <Button size="sm" onClick={() => openEdit()} disabled={sizes.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Novo sabor
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {sizes.length === 0 && <p className="text-sm text-muted-foreground">Cadastre ao menos um tamanho antes.</p>}
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {flavors.map((f) => (
          <div key={f.id} className="flex items-start gap-3 rounded-lg border p-3">
            <div className="h-14 w-14 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
              {f.image_url ? (
                <img src={f.image_url} alt={f.name} className="h-full w-full object-cover" />
              ) : (
                <PizzaIcon className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{f.name}</div>
              {f.ingredients && <div className="text-xs text-muted-foreground line-clamp-2">{f.ingredients}</div>}
              <div className="mt-1 flex flex-wrap gap-1">
                {sizes.map((s) => {
                  const p = pricesByFlavor[f.id]?.[s.id];
                  return (
                    <span key={s.id} className="text-[11px] bg-muted rounded px-1.5 py-0.5">
                      {s.name}: {p != null ? formatBRL(p) : '—'}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => {
                if (confirm(`Excluir "${f.name}"?`)) del.mutate(f.id, { onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.message }) });
              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.row.id ? 'Editar sabor' : 'Novo sabor'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <ImageUpload
                bucket="product-images"
                currentUrl={editing.row.image_url || null}
                onUpload={(url) => setEditing({ ...editing, row: { ...editing.row, image_url: url } })}
                onRemove={() => setEditing({ ...editing, row: { ...editing.row, image_url: null } })}
              />
              <div>
                <Label>Nome</Label>
                <Input value={editing.row.name || ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, name: e.target.value } })} placeholder="Ex.: Calabresa" />
              </div>
              <div>
                <Label>Ingredientes</Label>
                <Textarea rows={2} value={editing.row.ingredients || ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, ingredients: e.target.value } })} placeholder="Ex.: Molho, muçarela, calabresa, cebola" />
              </div>
              <div>
                <Label>Categoria (opcional)</Label>
                <Input value={editing.row.category || ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, category: e.target.value } })} placeholder="Ex.: Tradicionais, Doces..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.row.is_available ?? true} onCheckedChange={(c) => setEditing({ ...editing, row: { ...editing.row, is_available: c } })} />
                <Label>Disponível</Label>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <Label className="text-sm">Preço por tamanho</Label>
                {sizes.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="flex-1 text-sm">{s.name}</div>
                    <Input className="w-32" inputMode="decimal" placeholder="0,00"
                      value={String(editing.prices[s.id] ?? '')}
                      onChange={(e) => setEditing({ ...editing, prices: { ...editing.prices, [s.id]: parseFloat(e.target.value.replace(',', '.')) || 0 } })} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={save.isPending} onClick={() => {
              if (!editing?.row.name?.trim()) return;
              save.mutate({ row: editing.row, pricesBySizeId: editing.prices }, {
                onSuccess: () => { setEditing(null); toast({ title: 'Salvo' }); },
                onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
              });
            }}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Borders ---------- */
function BordersTab() {
  const { data: sizes = [] } = usePizzaSizes();
  const { data: borders = [], isLoading } = usePizzaBorders();
  const { data: prices = [] } = usePizzaBorderPrices();
  const save = useSavePizzaBorder();
  const del = useDeletePizzaBorder();
  const { toast } = useToast();
  const [editing, setEditing] = useState<{ row: Partial<PizzaBorderCatalog>; prices: Record<string, number> } | null>(null);

  const pricesByBorder = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const p of prices) {
      map[p.border_id] = map[p.border_id] || {};
      map[p.border_id][p.size_id] = p.price;
    }
    return map;
  }, [prices]);

  const openEdit = (b?: PizzaBorderCatalog) => {
    if (b) setEditing({ row: { ...b }, prices: pricesByBorder[b.id] || {} });
    else setEditing({ row: { name: '', is_available: true, sort_order: borders.length }, prices: {} });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Bordas</CardTitle>
        <Button size="sm" onClick={() => openEdit()} disabled={sizes.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Nova borda
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {sizes.length === 0 && <p className="text-sm text-muted-foreground">Cadastre ao menos um tamanho antes.</p>}
        {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
        {borders.map((b) => (
          <div key={b.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{b.name}</div>
              {b.description && <div className="text-xs text-muted-foreground">{b.description}</div>}
              <div className="mt-1 flex flex-wrap gap-1">
                {sizes.map((s) => {
                  const p = pricesByBorder[b.id]?.[s.id];
                  return (
                    <span key={s.id} className="text-[11px] bg-muted rounded px-1.5 py-0.5">
                      {s.name}: {p != null ? formatBRL(p) : '—'}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => {
                if (confirm(`Excluir "${b.name}"?`)) del.mutate(b.id, { onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.message }) });
              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.row.id ? 'Editar borda' : 'Nova borda'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.row.name || ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, name: e.target.value } })} placeholder="Ex.: Catupiry, Cheddar, Sem borda" />
              </div>
              <div>
                <Label>Descrição (opcional)</Label>
                <Input value={editing.row.description || ''} onChange={(e) => setEditing({ ...editing, row: { ...editing.row, description: e.target.value } })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.row.is_available ?? true} onCheckedChange={(c) => setEditing({ ...editing, row: { ...editing.row, is_available: c } })} />
                <Label>Disponível</Label>
              </div>
              <div className="rounded-lg border p-3 space-y-2">
                <Label className="text-sm">Preço por tamanho (0 para grátis)</Label>
                {sizes.map((s) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="flex-1 text-sm">{s.name}</div>
                    <Input className="w-32" inputMode="decimal" placeholder="0,00"
                      value={String(editing.prices[s.id] ?? '')}
                      onChange={(e) => setEditing({ ...editing, prices: { ...editing.prices, [s.id]: parseFloat(e.target.value.replace(',', '.')) || 0 } })} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={save.isPending} onClick={() => {
              if (!editing?.row.name?.trim()) return;
              save.mutate({ row: editing.row, pricesBySizeId: editing.prices }, {
                onSuccess: () => { setEditing(null); toast({ title: 'Salvo' }); },
                onError: (e: any) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
              });
            }}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
