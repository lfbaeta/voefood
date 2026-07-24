import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Package, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useUpdateRestaurant } from '@/hooks/useReseller';
import { Restaurant } from '@/types/reseller';

interface PlanManagerProps {
  restaurant: Restaurant;
}

export function PlanManager({ restaurant }: PlanManagerProps) {
  const { toast } = useToast();
  const { data: plans, isLoading } = useSubscriptionPlans();
  const updateRestaurant = useUpdateRestaurant();

  const activePlans = (plans || []).filter((p) => p.is_active);
  const currentPlan = plans?.find((p) => p.id === restaurant.plan_id) || null;

  const [selectedPlanId, setSelectedPlanId] = useState<string>(restaurant.plan_id || 'custom');
  const [customFee, setCustomFee] = useState<string>(restaurant.monthly_fee.toFixed(2));
  const [applyFeeFromPlan, setApplyFeeFromPlan] = useState(true);

  useEffect(() => {
    setSelectedPlanId(restaurant.plan_id || 'custom');
    setCustomFee(restaurant.monthly_fee.toFixed(2));
  }, [restaurant.plan_id, restaurant.monthly_fee]);

  const selectedPlan = selectedPlanId !== 'custom'
    ? activePlans.find((p) => p.id === selectedPlanId)
    : null;

  const isDirty =
    (restaurant.plan_id || null) !== (selectedPlanId === 'custom' ? null : selectedPlanId) ||
    (selectedPlanId === 'custom' && parseFloat(customFee || '0') !== restaurant.monthly_fee) ||
    (selectedPlan && applyFeeFromPlan && selectedPlan.monthly_fee !== restaurant.monthly_fee);

  const handleSave = async () => {
    const isCustom = selectedPlanId === 'custom';
    const newFee = isCustom
      ? parseFloat(customFee || '0')
      : applyFeeFromPlan && selectedPlan
      ? selectedPlan.monthly_fee
      : restaurant.monthly_fee;

    if (isNaN(newFee) || newFee < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }

    try {
      await updateRestaurant.mutateAsync({
        id: restaurant.id,
        plan_id: isCustom ? null : selectedPlanId,
        monthly_fee: newFee,
      });
      toast({
        title: currentPlan?.id !== selectedPlanId ? 'Plano atualizado' : 'Alterações salvas',
        description: 'As mudanças foram aplicadas com sucesso.',
      });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Plano de Assinatura
          </CardTitle>
          <CardDescription>
            Selecione ou migre o plano deste estabelecimento a qualquer momento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Plan */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Plano Atual</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">
                  {currentPlan?.name || 'Personalizado (sem plano)'}
                </p>
                {currentPlan?.is_popular && <Badge variant="secondary">Popular</Badge>}
              </div>
              <p className="text-lg font-bold text-primary">
                R$ {restaurant.monthly_fee.toFixed(2)}/mês
              </p>
            </div>
            {currentPlan?.description && (
              <p className="text-sm text-muted-foreground mt-2">{currentPlan.description}</p>
            )}
          </div>

          {/* Select New Plan */}
          <div className="space-y-3">
            <Label>Alterar / migrar plano</Label>
            {activePlans.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum plano ativo cadastrado. Crie planos em <strong>Configurações → Planos</strong>.
                </AlertDescription>
              </Alert>
            ) : (
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — R$ {p.monthly_fee.toFixed(2)}/mês
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado (sem plano)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Fee handling */}
          {selectedPlan ? (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Aplicar mensalidade do plano</p>
                  <p className="text-xs text-muted-foreground">
                    Atualizar a mensalidade para R$ {selectedPlan.monthly_fee.toFixed(2)}
                  </p>
                </div>
                <Switch checked={applyFeeFromPlan} onCheckedChange={setApplyFeeFromPlan} />
              </div>

              {currentPlan && currentPlan.id !== selectedPlan.id && (
                <Alert>
                  <ArrowRight className="h-4 w-4" />
                  <AlertDescription>
                    Migração: <strong>{currentPlan.name}</strong> → <strong>{selectedPlan.name}</strong>
                    {applyFeeFromPlan && (
                      <> (R$ {restaurant.monthly_fee.toFixed(2)} → R$ {selectedPlan.monthly_fee.toFixed(2)})</>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="custom-fee">Mensalidade personalizada (R$)</Label>
              <Input
                id="custom-fee"
                type="number"
                step="0.01"
                min="0"
                value={customFee}
                onChange={(e) => setCustomFee(e.target.value)}
              />
            </div>
          )}

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A troca de plano <strong>não</strong> altera automaticamente a assinatura já criada no
              Mercado Pago. Se o valor mudar, cancele a assinatura atual e gere uma nova cobrança na aba
              anterior.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!isDirty || updateRestaurant.isPending}>
              {updateRestaurant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
