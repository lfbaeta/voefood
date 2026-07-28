import { useMemo, useState } from 'react';
import { ArrowLeft, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

export interface PdvCartItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  observation: string;
  addons: {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    price: number;
  }[];
  totalPrice: number;
}

interface PdvSaleScreenProps {
  onBack: () => void;
  onContinue: (items: PdvCartItem[]) => void;
}

export const formatBRLCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function PdvSaleScreen({ onBack, onContinue }: PdvSaleScreenProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [items, setItems] = useState<PdvCartItem[]>([]);

  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();

  const filteredProducts = useMemo(() => {
    const available = (products || []).filter((p) => p.is_available);
    return available.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase().trim());
      const matchesCategory = !selectedCategory || product.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const total = useMemo(() => items.reduce((sum, i) => sum + i.totalPrice, 0), [items]);
  const totalQty = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const addProduct = (product: { id: string; name: string; price: number }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id && i.addons.length === 0 && !i.observation);
      if (existing) {
        return prev.map((i) =>
          i.id === existing.id
            ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
            : i,
        );
      }
      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: Number(product.price),
          observation: '',
          addons: [],
          totalPrice: Number(product.price),
        },
      ];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) =>
          i.id === id
            ? { ...i, quantity: i.quantity + delta, totalPrice: (i.quantity + delta) * i.unitPrice }
            : i,
        )
        .filter((i) => i.quantity > 0),
    );
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nova Venda</h1>
          <p className="text-muted-foreground">Busque os produtos e monte o carrinho</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Produtos */}
        <Card className="p-4 flex flex-col min-h-[60vh]">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar produto por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              Todos
            </Button>
            {categories?.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                size="sm"
                className="whitespace-nowrap"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>

          <ScrollArea className="flex-1 max-h-[55vh]">
            {isLoading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando produtos...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Nenhum produto encontrado</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 p-1">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addProduct({ id: product.id, name: product.name, price: Number(product.price) })}
                    className={cn(
                      'text-left p-3 rounded-xl border bg-card transition-all',
                      'hover:border-primary hover:shadow-md active:scale-[0.98]',
                    )}
                  >
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-20 object-cover rounded-lg mb-2"
                      />
                    )}
                    <p className="font-medium text-sm text-foreground line-clamp-2">{product.name}</p>
                    <p className="text-primary font-bold text-sm mt-1">
                      {formatBRLCurrency(Number(product.price))}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>

        {/* Carrinho */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Carrinho
            </h2>
            <Badge variant="secondary">{totalQty} item(ns)</Badge>
          </div>

          <ScrollArea className="flex-1 max-h-[45vh] pr-2">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                Toque em um produto para adicionar
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.productName}</p>
                      <button onClick={() => removeItem(item.id)} aria-label="Remover item">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(item.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-sm w-6 text-center">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => changeQty(item.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {formatBRLCurrency(item.totalPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t mt-3 pt-3 space-y-3">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatBRLCurrency(total)}</span>
            </div>
            <Button className="w-full" size="lg" disabled={items.length === 0} onClick={() => onContinue(items)}>
              Continuar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
