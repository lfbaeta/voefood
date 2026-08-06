import { Plus, ImageOff } from 'lucide-react';
import { Product } from '@/hooks/useProducts';
import { cn } from '@/lib/utils';
import { isWeightUnit, priceUnitSuffix } from '@/lib/units';
import { isPromoActive, promoDiscountPercent, formatBRLPrice } from '@/lib/promo';

interface MenuProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
}

export function MenuProductCard({ product, onSelect }: MenuProductCardProps) {
  const onPromo = isPromoActive(product);
  const discount = promoDiscountPercent(product);
  const formattedPrice = formatBRLPrice(Number(product.price));
  const formattedPromo = onPromo ? formatBRLPrice(Number(product.promo_price)) : null;
  const isWeight = isWeightUnit(product.unit_of_sale);
  const unitSuffix = priceUnitSuffix(product.unit_of_sale);

  return (
    <div
      className={cn(
        "group relative flex gap-4 rounded-2xl bg-card p-4 shadow-sm border border-border/50 transition-all duration-300",
        product.is_available 
          ? "cursor-pointer hover:shadow-lg hover:border-primary/30 hover:scale-[1.01] active:scale-[0.99]" 
          : "opacity-60",
        onPromo && "border-primary/40"
      )}
      onClick={() => product.is_available && onSelect(product)}
    >
      {/* Content */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          {onPromo && (
            <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              Promoção{discount ? ` -${discount}%` : ''}
            </span>
          )}
          <h4 className="font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h4>
          {product.description && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>
        <div className="mt-3">
          {onPromo ? (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground line-through">
                {formattedPrice}
                {isWeight && <span className="ml-0.5">{unitSuffix}</span>}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-primary">{formattedPromo}</span>
                {isWeight && <span className="text-xs font-normal text-muted-foreground">{unitSuffix}</span>}
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-primary">{formattedPrice}</span>
              {isWeight && <span className="text-xs font-normal text-muted-foreground">{unitSuffix}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Image */}
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
        {product.image_url ? (
          <>
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <ImageOff className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        
        {/* Unavailable overlay */}
        {!product.is_available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <span className="text-[10px] font-bold uppercase text-white tracking-wider">Esgotado</span>
          </div>
        )}

        {/* Add Button - Positioned over image */}
        {product.is_available && (
          <button
            aria-label={`Adicionar ${product.name} ao carrinho`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(product);
            }}
            className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full gradient-primary text-primary-foreground shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 group-hover:animate-bounce-in"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
