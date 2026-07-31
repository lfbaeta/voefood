import { Product } from '@/hooks/useProducts';
import { MenuProductCard } from './MenuProductCard';
import { Tag } from 'lucide-react';

interface PromoSectionProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
}

export function PromoSection({ products, onProductSelect }: PromoSectionProps) {
  if (products.length === 0) return null;

  return (
    <section className="animate-fade-in rounded-3xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Tag className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Promoções</h3>
            <p className="text-xs text-muted-foreground">
              {products.length} {products.length === 1 ? 'oferta ativa' : 'ofertas ativas'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {products.map((product) => (
          <MenuProductCard key={product.id} product={product} onSelect={onProductSelect} />
        ))}
      </div>
    </section>
  );
}
