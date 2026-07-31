import { useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { EnhanceWithAIButton } from '@/components/admin/EnhanceWithAIButton';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useAddonGroups, useAddProductAddonGroup, useRemoveProductAddonGroup } from '@/hooks/useAddons';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import { useStoreConfig } from '@/hooks/useStore';
import { useBusinessCapabilities } from '@/hooks/useBusinessCapabilities';
import { usePizzaSizes, usePizzaFlavors, usePizzaBorders } from '@/hooks/usePizzeria';
import { Pizza as PizzaIcon } from 'lucide-react';
import { isPromoActive, isoToLocalInput, localInputToISO, formatBRLPrice } from '@/lib/promo';

const AdminProducts = () => {
  const { checkDemoMode } = useDemoGuard();
  const { data: store } = useStoreConfig();
  const capabilities = useBusinessCapabilities();
  const isPizzeria = capabilities.pizzaModule && (store as any)?.business_type === 'pizzeria';
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const { data: addonGroups } = useAddonGroups();
  const { data: pizzaSizes = [] } = usePizzaSizes();
  const { data: pizzaFlavors = [] } = usePizzaFlavors();
  const { data: pizzaBorders = [] } = usePizzaBorders();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const addProductAddonGroup = useAddProductAddonGroup();
  const removeProductAddonGroup = useRemoveProductAddonGroup();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: '',
    is_available: true,
    unit_of_sale: 'un' as 'un' | 'kg' | 'g' | 'L' | 'ml',
    allow_weight_variation: false,
    track_stock: false,
    stock_qty: '',
    min_stock_qty: '',
    availability_locked: false,
    promo_enabled: false,
    promo_price: '',
    promo_starts_at: '',
    promo_ends_at: '',
    is_pizza: false,
    pizza_max_flavors: 1,
    pizza_flavors: [] as Array<{ id: string; name: string; price: number }>,
    pizza_borders: [] as Array<{ id: string; name: string; price: number }>,
  });
  const [selectedAddonGroups, setSelectedAddonGroups] = useState<string[]>([]);
  const [initialAddonGroups, setInitialAddonGroups] = useState<string[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const formatCurrency = (value: number) =>
    Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price: '',
      category_id: '',
      image_url: '',
      is_available: true,
      unit_of_sale: 'un',
      allow_weight_variation: false,
      track_stock: false,
      stock_qty: '',
      min_stock_qty: '',
      availability_locked: false,
      promo_enabled: false,
      promo_price: '',
      promo_starts_at: '',
      promo_ends_at: '',
      is_pizza: false,
      pizza_max_flavors: 1,
      pizza_flavors: [],
      pizza_borders: [],
    });
    setSelectedAddonGroups([]);
    setIsModalOpen(true);
  };

  const openEditModal = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category_id: product.category_id || '',
      image_url: product.image_url || '',
      is_available: product.is_available,
      unit_of_sale: (product.unit_of_sale as any) || 'un',
      allow_weight_variation: !!product.allow_weight_variation,
      track_stock: !!product.track_stock,
      stock_qty: product.stock_qty != null ? String(product.stock_qty) : '',
      min_stock_qty: product.min_stock_qty != null ? String(product.min_stock_qty) : '',
      availability_locked: !!product.availability_locked,
      promo_enabled: !!(product as any).promo_enabled,
      promo_price: (product as any).promo_price != null ? String((product as any).promo_price) : '',
      promo_starts_at: isoToLocalInput((product as any).promo_starts_at),
      promo_ends_at: isoToLocalInput((product as any).promo_ends_at),
      is_pizza: !!product.is_pizza,
      pizza_max_flavors: product.pizza_max_flavors || 1,
      pizza_flavors: Array.isArray(product.pizza_flavors) ? (product.pizza_flavors as any) : [],
      pizza_borders: Array.isArray(product.pizza_borders) ? (product.pizza_borders as any) : [],
    });
    setIsModalOpen(true);
    
    // Fetch product addon groups
    setLoadingAddons(true);
    try {
      const { data, error } = await supabase
        .from('product_addon_groups')
        .select('addon_group_id')
        .eq('product_id', product.id);
      
      if (error) throw error;
      
      const groupIds = data?.map(pag => pag.addon_group_id) || [];
      setSelectedAddonGroups(groupIds);
      setInitialAddonGroups(groupIds);
    } catch (error) {
      console.error('Error fetching product addon groups:', error);
      setSelectedAddonGroups([]);
      setInitialAddonGroups([]);
    } finally {
      setLoadingAddons(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkDemoMode()) return;
    if (!formData.name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    const price = parseFloat(formData.price.replace(',', '.')) || 0;
    if (isNaN(price) || price < 0) {
      toast({ title: 'Preço inválido', variant: 'destructive' });
      return;
    }

    // Validação da promoção
    const promoPrice = formData.promo_enabled
      ? parseFloat(formData.promo_price.replace(',', '.'))
      : null;
    if (formData.promo_enabled) {
      if (promoPrice == null || isNaN(promoPrice) || promoPrice <= 0) {
        toast({ title: 'Informe um valor promocional válido', variant: 'destructive' });
        return;
      }
      if (promoPrice >= price) {
        toast({
          title: 'Valor promocional inválido',
          description: 'O valor promocional deve ser menor que o preço normal.',
          variant: 'destructive',
        });
        return;
      }
      if (
        formData.promo_starts_at && formData.promo_ends_at &&
        new Date(formData.promo_ends_at) <= new Date(formData.promo_starts_at)
      ) {
        toast({
          title: 'Período inválido',
          description: 'A data final deve ser posterior à data inicial.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const productData = {
        name: formData.name,
        description: formData.description || null,
        price,
        category_id: formData.category_id || null,
        image_url: formData.image_url || null,
        is_available: formData.is_available,
        unit_of_sale: formData.unit_of_sale,
        allow_weight_variation: formData.unit_of_sale !== 'un' ? formData.allow_weight_variation : false,
        track_stock: formData.track_stock,
        stock_qty: formData.track_stock && formData.stock_qty !== ''
          ? parseFloat(formData.stock_qty.replace(',', '.'))
          : null,
        min_stock_qty: formData.track_stock && formData.min_stock_qty !== ''
          ? parseFloat(formData.min_stock_qty.replace(',', '.'))
          : null,
        availability_locked: formData.availability_locked,
        promo_enabled: formData.promo_enabled,
        promo_price: formData.promo_enabled ? promoPrice : null,
        promo_starts_at: formData.promo_enabled ? localInputToISO(formData.promo_starts_at) : null,
        promo_ends_at: formData.promo_enabled ? localInputToISO(formData.promo_ends_at) : null,
        is_pizza: formData.is_pizza,
        pizza_max_flavors: formData.is_pizza ? Math.max(1, Number(formData.pizza_max_flavors) || 1) : 1,
        pizza_flavors: formData.is_pizza ? formData.pizza_flavors : [],
        pizza_borders: formData.is_pizza ? formData.pizza_borders : [],
      } as any;

      let productId: string;
      
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, ...productData });
        productId = editingProduct.id;
        
        // Sync addon groups - remove old, add new
        const toRemove = initialAddonGroups.filter(id => !selectedAddonGroups.includes(id));
        const toAdd = selectedAddonGroups.filter(id => !initialAddonGroups.includes(id));
        
        for (const groupId of toRemove) {
          await removeProductAddonGroup.mutateAsync({ product_id: productId, addon_group_id: groupId });
        }
        for (const groupId of toAdd) {
          await addProductAddonGroup.mutateAsync({ product_id: productId, addon_group_id: groupId });
        }
        
        toast({ title: 'Produto atualizado!' });
      } else {
        const result = await createProduct.mutateAsync(productData);
        productId = result.id;
        
        // Add selected addon groups
        for (const groupId of selectedAddonGroups) {
          await addProductAddonGroup.mutateAsync({ product_id: productId, addon_group_id: groupId });
        }
        
        toast({ title: 'Produto criado!' });
      }

      setIsModalOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    }
  };
  
  const toggleAddonGroup = (groupId: string) => {
    setSelectedAddonGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleDelete = async (product: Product) => {
    if (checkDemoMode()) return;
    if (!confirm(`Deseja excluir "${product.name}"?`)) return;

    try {
      await deleteProduct.mutateAsync(product.id);
      toast({ title: 'Produto excluído!' });
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    }
  };

  const toggleAvailability = async (product: Product) => {
    if (checkDemoMode()) return;
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        is_available: !product.is_available,
      });
      toast({ 
        title: product.is_available ? 'Produto desativado' : 'Produto ativado',
      });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Sem categoria';
    return categories?.find(c => c.id === categoryId)?.name || 'Sem categoria';
  };

  if (isLoading) {
    return (
      <AdminLayout title="Produtos">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Produtos">
      {isPizzeria && (
        <div className="mb-4 sm:mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xl">🍕</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">Gestão da Pizzaria</p>
              <p className="text-sm text-muted-foreground">
                Configure tamanhos, sabores e bordas do seu cardápio de pizzas.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const base = window.location.pathname.replace(/\/products.*$/, '');
              window.location.href = `${base}/pizzeria`;
            }}
            className="w-full sm:w-auto"
          >
            Configurar Pizzaria
          </Button>
        </div>
      )}

      {/* Header */}

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreateModal} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Pizzas cadastradas em "Configurar Pizzaria" — somente leitura aqui */}
      {isPizzeria && pizzaSizes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PizzaIcon className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">Pizzas do cardápio</h2>
              <Badge variant="secondary" className="text-[10px]">{pizzaSizes.length} tamanho{pizzaSizes.length > 1 ? 's' : ''}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const base = window.location.pathname.replace(/\/products.*$/, '');
                window.location.href = `${base}/pizzeria`;
              }}
            >
              Editar em Configurar Pizzaria →
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {pizzaSizes.map((s) => (
              <div key={s.id} className="bg-card rounded-xl p-3 sm:p-4 shadow-card border border-primary/10">
                <div className="flex gap-3">
                  <div className="h-16 w-16 rounded-xl overflow-hidden bg-primary/10 flex-shrink-0 flex items-center justify-center">
                    {s.image_url ? (
                      <img src={s.image_url} alt={s.name} className="h-full w-full object-cover" />
                    ) : (
                      <PizzaIcon className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{s.name}</h3>
                      <Badge variant={s.is_available ? 'open' : 'closed'} className="text-[10px] flex-shrink-0">
                        {s.is_available ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      até {s.max_flavors} sabor{s.max_flavors > 1 ? 'es' : ''}
                    </p>
                    {s.base_price != null && Number(s.base_price) > 0 && (
                      <p className="font-bold text-primary text-sm">a partir de {formatCurrency(Number(s.base_price))}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {pizzaFlavors.length} sabor{pizzaFlavors.length === 1 ? '' : 'es'} · {pizzaBorders.length} borda{pizzaBorders.length === 1 ? '' : 's'} cadastrada{pizzaBorders.length === 1 ? '' : 's'}
          </p>
        </div>
      )}

      {/* Produtos comuns */}
      {isPizzeria && (
        <h2 className="font-semibold text-foreground mb-3">Outros produtos (bebidas, entradas, sobremesas…)</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

        {filteredProducts.map((product) => (
          <div 
            key={product.id} 
            className="bg-card rounded-xl p-3 sm:p-4 shadow-card"
          >
            <div className="flex gap-3 sm:gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-2xl sm:text-3xl">🍔</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{product.name}</h3>
                  <Badge variant={product.is_available ? 'open' : 'closed'} className="text-[10px] sm:text-xs flex-shrink-0">
                    {product.is_available ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1 truncate">
                  {getCategoryName(product.category_id)}
                </p>
                {isPromoActive(product as any) ? (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                    <span className="font-bold text-primary text-sm sm:text-base">{formatBRLPrice(Number((product as any).promo_price))}</span>
                    <Badge className="text-[10px]">Promoção</Badge>
                  </div>
                ) : (
                  <p className="font-bold text-primary text-sm sm:text-base">{formatCurrency(product.price)}</p>
                )}
                {product.track_stock && (
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {(product.stock_qty ?? 0) <= 0 ? (
                      <Badge variant="closed" className="text-[10px]">Esgotado</Badge>
                    ) : product.min_stock_qty != null && (product.stock_qty ?? 0) <= product.min_stock_qty ? (
                      <Badge variant="secondary" className="text-[10px] bg-yellow-500/15 text-yellow-700 border-yellow-500/30">
                        Estoque baixo: {product.stock_qty} {product.unit_of_sale || 'un'}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Estoque: {product.stock_qty} {product.unit_of_sale || 'un'}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 mt-3 sm:mt-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
                onClick={() => toggleAvailability(product)}
              >
                {product.is_available ? (
                  <><ToggleRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> <span className="hidden xs:inline">Desativar</span><span className="xs:hidden">Off</span></>
                ) : (
                  <><ToggleLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> <span className="hidden xs:inline">Ativar</span><span className="xs:hidden">On</span></>
                )}
              </Button>
              <Button variant="action-icon" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => openEditModal(product)}>
                <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button variant="action-icon-destructive" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => handleDelete(product)}>
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>
        ))}

        {filteredProducts.length === 0 && (
          <div className="col-span-full py-12 text-center">
            <p className="text-muted-foreground">Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Produto' : 'Novo Produto'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <ImageUpload
              bucket="product-images"
              currentUrl={formData.image_url}
              onUpload={(url) => setFormData({ ...formData, image_url: url })}
              onRemove={() => setFormData({ ...formData, image_url: '' })}
            />
            {formData.image_url && (
              <div className="flex justify-end">
                <EnhanceWithAIButton
                  imageUrl={formData.image_url}
                  onEnhanced={(url) => setFormData({ ...formData, image_url: url })}
                />
              </div>
            )}


            <div>
              <label className="text-sm text-muted-foreground">Nome *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome do produto"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">Descrição</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do produto"
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">
                  Preço * {formData.unit_of_sale !== 'un' && <span className="text-xs">(por {formData.unit_of_sale})</span>}
                </label>
                <Input
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Categoria</label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Unit of sale */}
            <div>
              <label className="text-sm text-muted-foreground">Unidade de venda</label>
              <Select
                value={formData.unit_of_sale}
                onValueChange={(value) => setFormData({
                  ...formData,
                  unit_of_sale: value as any,
                  allow_weight_variation: value !== 'un',
                })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="un">Unidade (un)</SelectItem>
                  <SelectItem value="kg">Quilograma (kg) — preço por kg</SelectItem>
                  <SelectItem value="g">Grama (g) — preço por g</SelectItem>
                  <SelectItem value="L">Litro (L) — preço por L</SelectItem>
                  <SelectItem value="ml">Mililitro (ml) — preço por ml</SelectItem>
                </SelectContent>
              </Select>
              {formData.unit_of_sale !== 'un' && (
                <div className="mt-2 flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="allow-weight-var"
                    checked={formData.allow_weight_variation}
                    onCheckedChange={(c) => setFormData({ ...formData, allow_weight_variation: !!c })}
                    className="mt-0.5"
                  />
                  <Label htmlFor="allow-weight-var" className="text-xs font-normal cursor-pointer leading-relaxed">
                    Permitir variação de peso na entrega — o valor final será ajustado após a pesagem real.
                  </Label>
                </div>
              )}
            </div>

            {/* Promoção */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="promo-enabled"
                  checked={formData.promo_enabled}
                  onCheckedChange={(c) => setFormData({ ...formData, promo_enabled: !!c })}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor="promo-enabled" className="text-sm font-medium cursor-pointer">
                    Ativar promoção
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A promoção inicia e encerra automaticamente no período configurado.
                  </p>
                </div>
              </div>

              {formData.promo_enabled && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Valor promocional *</label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formData.promo_price}
                      onChange={(e) => setFormData({ ...formData, promo_price: e.target.value })}
                      placeholder="0,00"
                      className="mt-1"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Deve ser menor que o preço normal do produto.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Início</label>
                      <Input
                        type="datetime-local"
                        value={formData.promo_starts_at}
                        onChange={(e) => setFormData({ ...formData, promo_starts_at: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Término</label>
                      <Input
                        type="datetime-local"
                        value={formData.promo_ends_at}
                        onChange={(e) => setFormData({ ...formData, promo_ends_at: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Deixe as datas em branco para manter a promoção ativa por tempo indeterminado.
                  </p>
                </>
              )}
            </div>

            {/* Smart stock control */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="track-stock"
                  checked={formData.track_stock}
                  onCheckedChange={(c) => setFormData({ ...formData, track_stock: !!c })}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor="track-stock" className="text-sm font-medium cursor-pointer">
                    Controlar estoque deste produto
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ative para itens contáveis (bebidas, embalados, medicamentos, pães etc.).
                    Desative para produtos preparados sob demanda (ex.: sanduíche, pizza) —
                    nesse caso o controle é feito pelos insumos na Ficha Técnica.
                  </p>
                </div>
              </div>

              {formData.track_stock && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Estoque atual ({formData.unit_of_sale})
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formData.stock_qty}
                        onChange={(e) => setFormData({ ...formData, stock_qty: e.target.value })}
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Estoque mínimo (alerta)
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={formData.min_stock_qty}
                        onChange={(e) => setFormData({ ...formData, min_stock_qty: e.target.value })}
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="lock-availability"
                      checked={formData.availability_locked}
                      onCheckedChange={(c) => setFormData({ ...formData, availability_locked: !!c })}
                      className="mt-0.5"
                    />
                    <Label htmlFor="lock-availability" className="text-xs font-normal cursor-pointer leading-relaxed">
                      Travar disponibilidade manualmente (não marcar como esgotado automaticamente)
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O sistema abate o estoque automaticamente quando o pedido é concluído/pago e
                    marca como "Esgotado" quando chega a zero.
                  </p>
                </>
              )}
            </div>

            {/* Pizza module removido daqui — agora tudo é feito em "Configurar Pizzaria" */}
            {isPizzeria && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                🍕 Para cadastrar tamanhos, sabores e bordas de pizza, use o painel <strong>Configurar Pizzaria</strong>. Esta tela é apenas para produtos comuns (bebidas, entradas, sobremesas, etc.).
              </div>
            )}




            {/* Addon Groups Selection */}
            {capabilities.productHasAddons && addonGroups && addonGroups.length > 0 && (
              <div>
                <label className="text-sm text-muted-foreground">Grupos de Acréscimos</label>
                {loadingAddons ? (
                  <div className="mt-2 flex items-center justify-center p-4 bg-muted/50 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="mt-2 space-y-2 bg-muted/50 rounded-lg p-3">
                    {addonGroups.map((group) => (
                      <div key={group.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`addon-${group.id}`}
                          checked={selectedAddonGroups.includes(group.id)}
                          onCheckedChange={() => toggleAddonGroup(group.id)}
                        />
                        <Label
                          htmlFor={`addon-${group.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {group.title}
                          <span className="text-muted-foreground ml-1 text-xs">
                            ({group.name})
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione os grupos de acréscimos que aparecerão neste produto
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                {(createProduct.isPending || updateProduct.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {editingProduct ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProducts;
