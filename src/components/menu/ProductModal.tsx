import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, AlertCircle, Pizza } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Product } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { useProductAddons, AddonGroup, AddonOption } from '@/hooks/useAddons';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { isWeightUnit, priceForGrams, formatAmount, priceUnitSuffix, getQuickAmounts, type UnitOfSale } from '@/lib/units';
import { cn } from '@/lib/utils';
import type { CartAddonSnapshot } from '@/types';
import type { PizzaFlavor, PizzaBorder } from '@/lib/pizza';
import { computePizzaBasePrice } from '@/lib/pizza';
import { isPromoActive, effectivePrice, promoDiscountPercent, formatBRLPrice } from '@/lib/promo';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  initialQuantity?: number;
  initialQuantityGrams?: number;
  initialObservation?: string;
  initialAddons?: Record<string, string[]>;
  isEditing?: boolean;
  returnTo?: string | null;
}

interface AddonGroupWithOptions extends AddonGroup {
  options: AddonOption[];
}

export function ProductModal({
  product,
  onClose,
  initialQuantity = 1,
  initialQuantityGrams,
  initialObservation = '',
  initialAddons,
  isEditing = false,
  returnTo = null,
}: ProductModalProps) {
  const navigate = useNavigate();
  const isWeight = isWeightUnit(product.unit_of_sale);
  const unit = (product.unit_of_sale || 'un') as UnitOfSale;
  const quickAmounts = useMemo(() => getQuickAmounts(unit), [unit]);
  const defaultGrams = quickAmounts[Math.min(3, quickAmounts.length - 1)] || 1000;

  // Pizza module state
  const isPizza = !!(product as any).is_pizza;
  const pizzaMaxFlavors = Number((product as any).pizza_max_flavors) || 1;
  const availableFlavors: PizzaFlavor[] = useMemo(
    () => (((product as any).pizza_flavors as PizzaFlavor[] | null) || []).filter(f => f.is_available !== false),
    [product],
  );
  const availableBorders: PizzaBorder[] = useMemo(
    () => (((product as any).pizza_borders as PizzaBorder[] | null) || []).filter(b => b.is_available !== false),
    [product],
  );

  const [quantity, setQuantity] = useState(initialQuantity);
  const [grams, setGrams] = useState<number>(initialQuantityGrams ?? defaultGrams);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [observation, setObservation] = useState(initialObservation);
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, string[]>>(initialAddons || {});
  const [selectedFlavorIds, setSelectedFlavorIds] = useState<string[]>([]);
  const [selectedBorderId, setSelectedBorderId] = useState<string>('');
  const { addItem, removeItem } = useCart();
  
  const { data: addonGroups, isLoading: addonsLoading } = useProductAddons(product.id);

  // Block body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Initialize selected add-ons when data loads (only if not editing with pre-selected addons)
  useEffect(() => {
    if (addonGroups && !initialAddons) {
      const initial: Record<string, string[]> = {};
      addonGroups.forEach((group: AddonGroupWithOptions) => {
        if (group.is_required && group.options.length > 0) {
          // Pre-select first option if required
          initial[group.id] = [group.options[0].id];
        } else {
          initial[group.id] = [];
        }
      });
      setSelectedAddOns(initial);
    }
  }, [addonGroups, initialAddons]);

  // Calculate add-ons total
  const addOnsTotal = useMemo(() => {
    if (!addonGroups) return 0;
    
    let total = 0;
    addonGroups.forEach((group: AddonGroupWithOptions) => {
      const selected = selectedAddOns[group.id] || [];
      selected.forEach(optionId => {
        const option = group.options.find(o => o.id === optionId);
        if (option) {
          total += Number(option.price);
        }
      });
    });
    return total;
  }, [addonGroups, selectedAddOns]);

  const onPromo = isPromoActive(product);
  const basePrice = effectivePrice(product);
  const originalPrice = Number(product.price);

  // Pizza selections
  const selectedFlavors: PizzaFlavor[] = useMemo(
    () => selectedFlavorIds.map(id => availableFlavors.find(f => f.id === id)).filter(Boolean) as PizzaFlavor[],
    [selectedFlavorIds, availableFlavors],
  );
  const selectedBorder: PizzaBorder | null = useMemo(
    () => availableBorders.find(b => b.id === selectedBorderId) || null,
    [selectedBorderId, availableBorders],
  );
  const pizzaBase = isPizza ? computePizzaBasePrice(selectedFlavors, selectedBorder) : 0;

  // Para itens por peso, o preço-base da linha é proporcional ao peso escolhido.
  const lineBasePrice = isPizza
    ? pizzaBase
    : (isWeight ? priceForGrams(basePrice, unit, grams) : basePrice);
  const unitPrice = lineBasePrice + addOnsTotal;
  const effectiveQty = isWeight ? 1 : quantity;
  const totalPrice = (unitPrice * effectiveQty).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
  const formattedPrice = (isPizza && availableFlavors.length > 0
    ? `A partir de ${Math.min(...availableFlavors.map(f => Number(f.price) || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
    : basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  );

  const handleSingleSelect = (groupId: string, optionId: string) => {
    setSelectedAddOns(prev => ({
      ...prev,
      [groupId]: [optionId]
    }));
  };

  const handleMultiSelect = (groupId: string, optionId: string, maxSelections: number) => {
    setSelectedAddOns(prev => {
      const current = prev[groupId] || [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter(id => id !== optionId) };
      } else if (current.length < maxSelections) {
        return { ...prev, [groupId]: [...current, optionId] };
      }
      return prev;
    });
  };

  const applyCustomAmount = () => {
    const raw = customAmount.replace(',', '.').trim();
    if (!raw) return;
    let val = parseFloat(raw);
    if (isNaN(val) || val <= 0) return;
    // Heurística: para kg/L, valores <= 20 são interpretados como kg/L; demais como g/ml
    if ((unit === 'kg' || unit === 'L') && val <= 20) {
      val = val * 1000;
    }
    setGrams(Math.round(val));
  };

  const handleAddToCart = () => {
    if (isWeight && (!grams || grams <= 0)) return;
    if (isPizza && selectedFlavors.length === 0) return;
    if (isEditing) {
      removeItem(product.id);
    }

    // Build addons snapshot (label + price) for receipt/print visibility.
    const addonsSnapshot: CartAddonSnapshot[] = [];
    if (addonGroups) {
      addonGroups.forEach((group: AddonGroupWithOptions) => {
        (selectedAddOns[group.id] || []).forEach((optId) => {
          const opt = group.options.find(o => o.id === optId);
          if (opt) {
            addonsSnapshot.push({
              group_id: group.id,
              group_name: group.title || group.name,
              option_id: opt.id,
              option_name: opt.name,
              price: Number(opt.price) || 0,
            });
          }
        });
      });
    }

    addItem(
      {
        id: product.id,
        category_id: product.category_id || '',
        name: product.name,
        description: product.description || '',
        // Store the BASE line price (without addons). Addons are added on top in the cart total.
        price: lineBasePrice,
        image_url: product.image_url || '',
        is_available: product.is_available,
        unit_of_sale: product.unit_of_sale,
        allow_weight_variation: product.allow_weight_variation,
      },
      effectiveQty,
      {
        observation: observation.trim() ? observation.trim() : undefined,
        selectedAddons: selectedAddOns,
        addonsSnapshot: addonsSnapshot.length > 0 ? addonsSnapshot : undefined,
        quantity_grams: isWeight ? grams : undefined,
        pizzaFlavors: isPizza ? selectedFlavors : undefined,
        pizzaBorder: isPizza ? selectedBorder : undefined,
        forceNewLine: isPizza,
      },
    );

    if (isEditing && returnTo) {
      navigate(`/${returnTo}`);
    } else {
      onClose();
    }
  };

  const toggleFlavor = (id: string) => {
    setSelectedFlavorIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (pizzaMaxFlavors === 1) return [id];
      if (prev.length < pizzaMaxFlavors) return [...prev, id];
      return prev;
    });
  };

  const hasAddons = addonGroups && addonGroups.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-slide-up bg-background sm:rounded-3xl sm:m-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Image Header with Close Button */}
          <div className="relative h-56 sm:h-64 w-full bg-muted">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-6xl">🍔</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="absolute left-3 top-3 h-9 w-9 rounded-full bg-foreground/80 text-background hover:bg-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Product Info */}
          <div className="p-4 sm:p-5 border-b border-border">
            {onPromo && !isPizza && (
              <span className="mb-2 inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
                Promoção{promoDiscountPercent(product) ? ` -${promoDiscountPercent(product)}%` : ''}
              </span>
            )}
            <h2 className="text-lg sm:text-xl font-bold text-foreground">{product.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>
            {onPromo && !isPizza && (
              <p className="mt-3 text-sm text-muted-foreground line-through">
                {formatBRLPrice(originalPrice)}
                {isWeight && <span className="ml-1">{priceUnitSuffix(unit)}</span>}
              </p>
            )}
            <p className={cn('font-bold text-primary italic', onPromo && !isPizza ? 'text-2xl sm:text-3xl' : 'mt-3 text-xl sm:text-2xl')}>
              {formattedPrice}
              {isWeight && <span className="text-sm font-normal text-muted-foreground not-italic ml-1">{priceUnitSuffix(unit)}</span>}
            </p>
          </div>


          {/* Pizza flavors */}
          {isPizza && availableFlavors.length > 0 && (
            <div className="border-b border-border">
              <div className="bg-muted/50 px-4 sm:px-5 py-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                    <Pizza className="h-4 w-4 text-primary" />
                    Sabor{pizzaMaxFlavors > 1 ? `es (até ${pizzaMaxFlavors})` : ''}
                  </h3>
                  <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                    Obrigatório
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {pizzaMaxFlavors > 1
                    ? 'Escolha até 2 sabores — o preço será baseado no sabor mais caro.'
                    : 'Escolha o sabor.'}
                </p>
              </div>
              <div className="px-4 sm:px-5 py-2">
                {availableFlavors.map((f) => {
                  const checked = selectedFlavorIds.includes(f.id);
                  const disabled = !checked && selectedFlavorIds.length >= pizzaMaxFlavors;
                  return (
                    <label
                      key={f.id}
                      className={cn(
                        'flex items-start justify-between gap-3 py-3 border-b border-border/50 last:border-0 cursor-pointer',
                        disabled && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <div className="flex-1">
                        <div className="text-sm sm:text-base text-foreground font-medium">{f.name}</div>
                        {f.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {Number(f.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </div>
                      {pizzaMaxFlavors === 1 ? (
                        <input
                          type="radio"
                          name="pizza-flavor"
                          checked={checked}
                          onChange={() => toggleFlavor(f.id)}
                          className="mt-1 h-5 w-5 accent-primary"
                        />
                      ) : (
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={() => toggleFlavor(f.id)}
                          className="mt-1 h-5 w-5"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pizza borders */}
          {isPizza && availableBorders.length > 0 && (
            <div className="border-b border-border">
              <div className="bg-muted/50 px-4 sm:px-5 py-3">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Borda</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">Escolha 1 opção (opcional)</p>
              </div>
              <RadioGroup
                value={selectedBorderId}
                onValueChange={setSelectedBorderId}
                className="px-4 sm:px-5 py-2"
              >
                <div className="flex items-center justify-between py-3 border-b border-border/50">
                  <Label className="flex-1 cursor-pointer font-normal text-sm text-foreground">
                    Sem borda
                  </Label>
                  <RadioGroupItem value="" className="h-5 w-5 border-2 border-muted-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                </div>
                {availableBorders.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <Label htmlFor={`border-${b.id}`} className="flex-1 cursor-pointer font-normal text-sm text-foreground">
                      {b.name}
                      {Number(b.price) > 0 && (
                        <span className="text-muted-foreground ml-2 text-sm">
                          +{Number(b.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      )}
                    </Label>
                    <RadioGroupItem value={b.id} id={`border-${b.id}`} className="h-5 w-5 border-2 border-muted-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary" />
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Weight selector */}
          {isWeight && (
            <div className="border-b border-border bg-muted/30 px-4 sm:px-5 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground">Quantidade</Label>
                <span className="text-sm font-bold text-primary">{formatAmount(grams, unit)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => { setGrams(g); setCustomAmount(''); }}
                    className={cn(
                      "py-2 rounded-xl text-sm font-medium border transition-colors",
                      grams === g
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {formatAmount(g, unit)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={unit === 'kg' || unit === 'L' ? 'Ex: 1,5 (kg/L) ou 350 (g/ml)' : 'Digite a quantidade'}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  onBlur={applyCustomAmount}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCustomAmount(); } }}
                  className="flex-1 bg-background"
                />
                <Button type="button" variant="outline" onClick={applyCustomAmount}>OK</Button>
              </div>
              {product.allow_weight_variation !== false && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-warning" />
                  <span>O peso final pode variar após a pesagem. O valor será ajustado pelo estabelecimento.</span>
                </p>
              )}
            </div>
          )}

          {/* Add-ons Sections */}
          {addonsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : hasAddons ? (
            addonGroups.map((group: AddonGroupWithOptions) => (
              <div key={group.id} className="border-b border-border">
                {/* Section Header */}
                <div className="bg-muted/50 px-4 sm:px-5 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">{group.title}</h3>
                    {group.is_required && (
                      <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {group.subtitle || `Escolha ${group.max_selections === 1 ? '1 opção' : `até ${group.max_selections} opções`}`}
                  </p>
                </div>
                
                {/* Options */}
                {group.max_selections === 1 ? (
                  <RadioGroup 
                    value={selectedAddOns[group.id]?.[0] || ''} 
                    onValueChange={(value) => handleSingleSelect(group.id, value)} 
                    className="px-4 sm:px-5 py-2"
                  >
                    {group.options.map((option) => (
                      <div 
                        key={option.id} 
                        className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                      >
                        <Label 
                          htmlFor={`${group.id}-${option.id}`} 
                          className="flex-1 cursor-pointer font-normal text-sm sm:text-base text-foreground"
                        >
                          {option.name}
                          {Number(option.price) > 0 && (
                            <span className="text-muted-foreground ml-2 text-sm">
                              +{Number(option.price).toLocaleString('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              })}
                            </span>
                          )}
                        </Label>
                        <RadioGroupItem 
                          value={option.id} 
                          id={`${group.id}-${option.id}`} 
                          className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-muted-foreground data-[state=checked]:border-primary data-[state=checked]:bg-primary" 
                        />
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="px-4 sm:px-5 py-2">
                    {group.options.map((option) => {
                      const isSelected = selectedAddOns[group.id]?.includes(option.id) || false;
                      return (
                        <div 
                          key={option.id} 
                          className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                        >
                          <Label 
                            htmlFor={`${group.id}-${option.id}`} 
                            className="flex-1 cursor-pointer font-normal text-sm sm:text-base text-foreground"
                          >
                            {option.name}
                            {Number(option.price) > 0 && (
                              <span className="text-muted-foreground ml-2 text-sm">
                                +{Number(option.price).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                })}
                              </span>
                            )}
                          </Label>
                          <Checkbox
                            id={`${group.id}-${option.id}`}
                            checked={isSelected}
                            onCheckedChange={() => handleMultiSelect(group.id, option.id, group.max_selections)}
                            className="h-5 w-5 sm:h-6 sm:w-6"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          ) : null}

          {/* Observation */}
          <div className="p-4 sm:p-5">
            <label className="text-sm font-medium text-foreground">
              Alguma observação?
            </label>
            <Textarea 
              placeholder="Ex: Sem cebola, molho à parte..." 
              value={observation} 
              onChange={e => setObservation(e.target.value)} 
              className="mt-2 resize-none rounded-xl bg-muted border-0 text-sm" 
              rows={3} 
            />
          </div>
        </div>

        {/* Footer - Add Button */}
        <div className="shrink-0 bg-background p-4 pb-6 safe-area-bottom border-t border-border">
          {/* Quantity Selector (only for unit-based products) */}
          {!isWeight && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="h-10 w-10 rounded-full"
              >
                -
              </Button>
              <span className="text-lg font-bold w-8 text-center">{quantity}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
                className="h-10 w-10 rounded-full"
              >
                +
              </Button>
            </div>
          )}

          <Button onClick={handleAddToCart} className="w-full rounded-full" size="xl" disabled={(isWeight && grams <= 0) || (isPizza && selectedFlavors.length === 0)}>
            {isEditing ? 'Atualizar' : 'Adicionar'} • {totalPrice}
            {isWeight && <span className="ml-1 text-xs opacity-80">(estimado)</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
