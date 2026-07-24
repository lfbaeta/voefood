import { Minus, Plus, Trash2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/types';
import { useCart } from '@/hooks/useCart';
import { isWeightUnit, formatAmount, type UnitOfSale } from '@/lib/units';
import { pizzaDetailLines } from '@/lib/pizza';

interface CartItemCardProps {
  item: CartItem;
}

export function CartItemCard({ item }: CartItemCardProps) {
  const { updateQuantity, removeItem } = useCart();
  const isWeight = isWeightUnit(item.product.unit_of_sale) && !!item.quantity_grams;
  const addonsTotal = (item.addonsSnapshot || []).reduce((s, a) => s + Number(a.price || 0), 0);
  const lineUnit = item.product.price + addonsTotal;

  const formattedPrice = (lineUnit * item.quantity).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const pizzaLines = item.pizzaFlavors?.length
    ? pizzaDetailLines(item.pizzaFlavors, item.pizzaBorder ?? null)
    : [];

  return (
    <div className="flex gap-3 rounded-xl bg-card p-3 shadow-card">
      <img
        src={item.product.image_url}
        alt={item.product.name}
        className="h-20 w-20 shrink-0 rounded-lg object-cover"
      />
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{item.product.name}</h3>
          {isWeight && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
              <Scale className="h-3 w-3" />
              {formatAmount(item.quantity_grams!, item.product.unit_of_sale as UnitOfSale)} · valor estimado
            </div>
          )}
          {pizzaLines.map((l, i) => (
            <p key={i} className="text-xs text-muted-foreground mt-0.5">{l}</p>
          ))}
          {(item.addonsSnapshot || []).map((a) => (
            <p key={a.option_id} className="text-xs text-muted-foreground mt-0.5">
              + {a.option_name}{Number(a.price) > 0 ? ` (+${Number(a.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : ''}
            </p>
          ))}
          {item.observation && (
            <p className="text-xs text-muted-foreground mt-0.5">
              📝 {item.observation}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-bold text-foreground">{formattedPrice}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (item.quantity === 1) {
                  removeItem(item.lineId);
                } else {
                  updateQuantity(item.lineId, item.quantity - 1);
                }
              }}
              className="h-8 w-8 rounded-lg bg-muted hover:bg-destructive/10 hover:text-destructive"
            >
              {item.quantity === 1 ? (
                <Trash2 className="h-4 w-4" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
            </Button>
            <span className="w-6 text-center font-semibold">{item.quantity}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
              className="h-8 w-8 rounded-lg bg-muted hover:bg-primary/10 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
