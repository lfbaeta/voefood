import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ChevronLeft, Check, Pizza as PizzaIcon } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { formatBRL } from '@/lib/pizza';
import { newId } from '@/lib/pizza';
import type { PizzaFlavor, PizzaBorder } from '@/lib/pizza';
import {
  usePizzaFlavors, usePizzaBorders,
  usePizzaFlavorPrices, usePizzaBorderPrices,
  type PizzaSize,
} from '@/hooks/usePizzeria';

interface Props {
  size: PizzaSize;
  open: boolean;
  onClose: () => void;
}

type Step = 'flavors' | 'border' | 'review';

export function PizzaBuilderModal({ size, open, onClose }: Props) {
  const { data: flavors = [], isLoading: lf } = usePizzaFlavors();
  const { data: borders = [], isLoading: lb } = usePizzaBorders();
  const { data: flavorPrices = [] } = usePizzaFlavorPrices();
  const { data: borderPrices = [] } = usePizzaBorderPrices();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('flavors');
  const [selectedFlavorIds, setSelectedFlavorIds] = useState<string[]>([]);
  const [selectedBorderId, setSelectedBorderId] = useState<string | 'none'>('none');
  const [quantity, setQuantity] = useState(1);

  const flavorPriceForSize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of flavorPrices) if (p.size_id === size.id) m[p.flavor_id] = p.price;
    return m;
  }, [flavorPrices, size.id]);

  const borderPriceForSize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of borderPrices) if (p.size_id === size.id) m[p.border_id] = p.price;
    return m;
  }, [borderPrices, size.id]);

  const availableFlavors = flavors.filter((f) => f.is_available && flavorPriceForSize[f.id] != null);
  const availableBorders = borders.filter((b) => b.is_available && borderPriceForSize[b.id] != null);

  const selectedFlavors = availableFlavors.filter((f) => selectedFlavorIds.includes(f.id));
  const selectedBorder = availableBorders.find((b) => b.id === selectedBorderId) || null;

  const flavorMax = selectedFlavors.length > 0
    ? Math.max(...selectedFlavors.map((f) => flavorPriceForSize[f.id] || 0))
    : 0;
  const borderPrice = selectedBorder ? borderPriceForSize[selectedBorder.id] || 0 : 0;
  const basePrice = Number(size.base_price || 0);
  const unitPrice = Math.max(basePrice, flavorMax) + borderPrice;
  const totalPrice = unitPrice * quantity;

  const toggleFlavor = (id: string) => {
    setSelectedFlavorIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= size.max_flavors) {
        toast({ title: `Máximo de ${size.max_flavors} sabor${size.max_flavors > 1 ? 'es' : ''}` });
        return prev;
      }
      return [...prev, id];
    });
  };

  const reset = () => {
    setStep('flavors');
    setSelectedFlavorIds([]);
    setSelectedBorderId('none');
    setQuantity(1);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleConfirm = () => {
    if (selectedFlavors.length === 0) return;
    const pizzaFlavors: PizzaFlavor[] = selectedFlavors.map((f) => ({
      id: f.id, name: f.name, description: f.ingredients || undefined,
      price: flavorPriceForSize[f.id] || 0, is_available: true,
    }));
    const pizzaBorder: PizzaBorder | null = selectedBorder
      ? { id: selectedBorder.id, name: selectedBorder.name, price: borderPrice, is_available: true }
      : null;

    addItem(
      {
        id: `pizza-size:${size.id}:${newId()}`,
        category_id: '',
        name: size.name,
        description: size.description || '',
        price: unitPrice,
        image_url: size.image_url || '',
        is_available: true,
      } as any,
      quantity,
      { pizzaFlavors, pizzaBorder, forceNewLine: true },
    );
    toast({ title: 'Pizza adicionada ao carrinho' });
    handleClose();
  };

  const canGoNext = step === 'flavors' ? selectedFlavors.length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-0 border-b">
          <div className="relative h-32 w-full bg-gradient-to-br from-primary/20 to-primary/5 overflow-hidden">
            {size.image_url ? (
              <img src={size.image_url} alt={size.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <PizzaIcon className="h-14 w-14 text-primary/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <DialogTitle className="flex items-center gap-2">
                {step !== 'flavors' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStep(step === 'review' ? 'border' : 'flavors')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <span className="text-lg">{size.name}</span>
                <span className="text-xs text-muted-foreground font-normal">
                  · até {size.max_flavors} sabor{size.max_flavors > 1 ? 'es' : ''}
                </span>
              </DialogTitle>
            </div>
          </div>
          <div className="flex gap-1 p-4 pt-3">
            {(['flavors', 'border', 'review'] as Step[]).map((s, i) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${['flavors','border','review'].indexOf(step) >= i ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {step === 'flavors' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Escolha até {size.max_flavors} sabor{size.max_flavors > 1 ? 'es' : ''}. O preço usa o sabor mais caro.
                </p>
                {lf && <Loader2 className="h-5 w-5 animate-spin" />}
                {!lf && availableFlavors.length === 0 && <p className="text-sm text-muted-foreground">Nenhum sabor cadastrado para este tamanho.</p>}
                {availableFlavors.map((f) => {
                  const checked = selectedFlavorIds.includes(f.id);
                  return (
                    <label key={f.id} className={`flex items-center gap-3 rounded-xl border p-2.5 cursor-pointer transition ${checked ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-muted/40'}`}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleFlavor(f.id)} />
                      <div className="h-14 w-14 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {f.image_url ? (
                          <img src={f.image_url} alt={f.name} className="h-full w-full object-cover" />
                        ) : (
                          <PizzaIcon className="h-6 w-6 text-primary/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium truncate">{f.name}</span>
                          <span className="text-sm font-semibold text-primary flex-shrink-0">{formatBRL(flavorPriceForSize[f.id] || 0)}</span>
                        </div>
                        {f.ingredients && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.ingredients}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {step === 'border' && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-2">Escolha a borda (opcional).</p>
                {lb && <Loader2 className="h-5 w-5 animate-spin" />}
                <RadioGroup value={selectedBorderId} onValueChange={(v) => setSelectedBorderId(v)}>
                  <label className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selectedBorderId === 'none' ? 'border-primary bg-primary/5' : ''}`}>
                    <RadioGroupItem value="none" id="border-none" />
                    <div className="flex-1"><Label htmlFor="border-none" className="cursor-pointer">Sem borda recheada</Label></div>
                    <span className="text-sm text-muted-foreground">Grátis</span>
                  </label>
                  {availableBorders.map((b) => (
                    <label key={b.id} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${selectedBorderId === b.id ? 'border-primary bg-primary/5' : ''}`}>
                      <RadioGroupItem value={b.id} id={`border-${b.id}`} />
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={`border-${b.id}`} className="cursor-pointer font-medium">{b.name}</Label>
                        {b.description && <div className="text-xs text-muted-foreground">{b.description}</div>}
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {borderPriceForSize[b.id] > 0 ? `+ ${formatBRL(borderPriceForSize[b.id])}` : 'Grátis'}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            )}

            {step === 'review' && (
              <div className="space-y-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Tamanho</div>
                  <div className="font-medium">{size.name}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground mb-1">Sabor{selectedFlavors.length > 1 ? 'es' : ''}</div>
                  <ul className="space-y-1">
                    {selectedFlavors.map((f) => (
                      <li key={f.id} className="flex justify-between text-sm">
                        <span>{f.name}</span>
                        <span className="text-muted-foreground">{formatBRL(flavorPriceForSize[f.id] || 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Borda</div>
                  <div className="flex justify-between text-sm">
                    <span>{selectedBorder ? selectedBorder.name : 'Sem borda recheada'}</span>
                    <span className="text-muted-foreground">{borderPrice > 0 ? `+ ${formatBRL(borderPrice)}` : 'Grátis'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm">Quantidade</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</Button>
                    <span className="w-8 text-center">{quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(quantity + 1)}>+</Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-bold text-primary">{formatBRL(totalPrice)}</div>
          </div>
          {step !== 'review' ? (
            <Button disabled={!canGoNext} onClick={() => setStep(step === 'flavors' ? 'border' : 'review')}>
              Continuar
            </Button>
          ) : (
            <Button onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
