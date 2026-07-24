import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { OrderItem } from '@/hooks/useOrders';
import { formatAmount, type UnitOfSale } from '@/lib/units';

interface WeightAdjustModalProps {
  item: OrderItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdjusted?: () => void;
}

export function WeightAdjustModal({ item, open, onOpenChange, onAdjusted }: WeightAdjustModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const unit = (item?.unit_of_sale || 'kg') as UnitOfSale;
  const estimatedGrams = Number(item?.quantity_grams || 0);
  const currentFinal = item?.final_quantity_grams ? Number(item.final_quantity_grams) : null;

  const parsedGrams = useMemo(() => {
    const raw = value.replace(',', '.').trim();
    if (!raw) return null;
    let v = parseFloat(raw);
    if (isNaN(v) || v <= 0) return null;
    if ((unit === 'kg' || unit === 'L') && v <= 20) v = v * 1000;
    return Math.round(v);
  }, [value, unit]);

  const estimatedTotal = Number(item?.unit_price || 0) * Number(item?.quantity || 1);
  const newUnitPrice = parsedGrams && estimatedGrams > 0
    ? Number((Number(item!.unit_price) * (parsedGrams / estimatedGrams)).toFixed(2))
    : null;
  const newTotal = newUnitPrice !== null ? newUnitPrice * Number(item!.quantity || 1) : null;
  const diff = newTotal !== null ? newTotal - estimatedTotal : null;

  const handleSubmit = async () => {
    if (!item || !parsedGrams) return;
    setSaving(true);
    const { error } = await supabase.rpc('adjust_order_item_weight', {
      p_item_id: item.id,
      p_final_grams: parsedGrams,
    });
    setSaving(false);

    if (error) {
      toast({ title: 'Erro ao ajustar peso', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Peso ajustado!', description: 'O valor do pedido foi recalculado.' });
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['order-items', item.order_id] });
    qc.invalidateQueries({ queryKey: ['order', item.order_id] });
    setValue('');
    onAdjusted?.();
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Ajustar peso real
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="font-medium">{item.product_name}</p>
            <p className="text-sm text-muted-foreground">
              Peso pedido pelo cliente: <strong>{formatAmount(estimatedGrams, unit)}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Valor estimado: <strong>{estimatedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            </p>
            {currentFinal && (
              <p className="text-xs text-warning">
                ⚠️ Já foi ajustado para {formatAmount(currentFinal, unit)} — você pode reajustar.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="final-weight">Peso real após pesagem</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="final-weight"
                type="text"
                inputMode="decimal"
                autoFocus
                placeholder={unit === 'kg' || unit === 'L' ? 'Ex: 0,94 (kg) ou 940 (g)' : 'Quantidade'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <div className="flex items-center px-3 bg-muted rounded-md text-sm text-muted-foreground">
                {unit === 'kg' || unit === 'g' ? 'g/kg' : 'ml/L'}
              </div>
            </div>
            {parsedGrams && (
              <p className="text-xs text-muted-foreground mt-1">
                = {formatAmount(parsedGrams, unit)}
              </p>
            )}
          </div>

          {newTotal !== null && diff !== null && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor real</span>
                <span className="font-bold text-primary">
                  {newTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Diferença</span>
                <span className={diff >= 0 ? 'text-warning font-medium' : 'text-emerald-600 font-medium'}>
                  {diff >= 0 ? '+' : ''}{diff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!parsedGrams || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Confirmar peso real
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
