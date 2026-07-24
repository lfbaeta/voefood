import { useEffect, useMemo, useState } from 'react';
import { Loader2, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useStoreConfig, useUpdateStoreConfig } from '@/hooks/useStore';
import { useToast } from '@/hooks/use-toast';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import {
  resolveCapabilities,
  CAPABILITY_LABELS,
  type BusinessCapabilities,
} from '@/lib/businessCapabilities';

type CapKey = keyof BusinessCapabilities;

// Somente flags booleanas ficam disponíveis para override no toggle.
const TOGGLE_KEYS: CapKey[] = [
  'counterPOS',
  'deliveryModule',
  'kitchenDepartment',
  'barDepartment',
  'waiterModule',
  'tableModule',
  'pizzaModule',
  'stockRecipes',
  'productHasAddons',
  'productHasVariants',
  'productSoldByWeight',
  'productHasFlavors',
  'productHasBorder',
  'productHasPrescription',
  'productHasExpiration',
  'productHasBrand',
  'productHasNutrition',
  'showCombos',
  'showFlavorFilter',
];

const GROUPS: { title: string; keys: CapKey[] }[] = [
  {
    title: 'Operação',
    keys: ['counterPOS', 'deliveryModule', 'kitchenDepartment', 'barDepartment', 'waiterModule', 'tableModule', 'pizzaModule', 'stockRecipes'],
  },
  {
    title: 'Produto',
    keys: ['productHasAddons', 'productHasVariants', 'productSoldByWeight', 'productHasFlavors', 'productHasBorder', 'productHasPrescription', 'productHasExpiration', 'productHasBrand', 'productHasNutrition'],
  },
  {
    title: 'Cardápio',
    keys: ['showCombos', 'showFlavorFilter'],
  },
];

export function ModulesSettings() {
  const { data: store } = useStoreConfig();
  const updateStore = useUpdateStoreConfig();
  const { toast } = useToast();
  const { checkDemoMode } = useDemoGuard();

  const businessType = (store as any)?.business_type as string | undefined;
  const businessSubtype = (store as any)?.business_subtype as string | undefined;
  const savedOverride = (store as any)?.capabilities_override as
    | Partial<BusinessCapabilities>
    | null
    | undefined;

  // Capabilities "puras" do preset (sem override)
  const presetCaps = useMemo(
    () => resolveCapabilities(businessType, businessSubtype, null),
    [businessType, businessSubtype],
  );

  const [override, setOverride] = useState<Partial<BusinessCapabilities>>({});

  useEffect(() => {
    setOverride({ ...(savedOverride || {}) });
  }, [savedOverride]);

  if (!store) return null;

  const effective = { ...presetCaps, ...override } as BusinessCapabilities;

  const handleToggle = (key: CapKey, presetValue: boolean, checked: boolean) => {
    setOverride((prev) => {
      const next = { ...prev } as any;
      // Se o valor bate com o preset, remove do override (mantém "seguindo o padrão")
      if (checked === presetValue) {
        delete next[key];
      } else {
        next[key] = checked;
      }
      return next;
    });
  };

  const handleResetAll = () => setOverride({});

  const handleSave = async () => {
    if (checkDemoMode()) return;
    try {
      await updateStore.mutateAsync({
        id: store.id,
        capabilities_override: override,
      } as any);
      toast({ title: 'Módulos atualizados!' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 shadow-card space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm sm:text-base">Módulos ativos</h3>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={handleResetAll}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Usar padrão do tipo
        </Button>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Cada tipo de estabelecimento já vem com um conjunto de módulos ativos que faz sentido
        para o seu negócio. Aqui você pode ligar ou desligar algo específico.
      </p>

      <div className="space-y-6">
        {GROUPS.map((g) => (
          <div key={g.title} className="space-y-3">
            <p className="text-sm font-semibold text-foreground">{g.title}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.keys.map((key) => {
                if (!TOGGLE_KEYS.includes(key)) return null;
                const presetValue = presetCaps[key] as boolean;
                const value = effective[key] as boolean;
                const isOverridden = key in override;
                return (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={`cap-${key}`} className="text-sm text-foreground">
                        {CAPABILITY_LABELS[key]}
                      </Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Padrão: <span className="font-medium">{presetValue ? 'Ativado' : 'Desativado'}</span>
                        {isOverridden && <span className="ml-2 text-primary">• Personalizado</span>}
                      </p>
                    </div>
                    <Switch
                      id={`cap-${key}`}
                      checked={value}
                      onCheckedChange={(c) => handleToggle(key, presetValue, c)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={updateStore.isPending} className="w-full">
        {updateStore.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Salvando...
          </>
        ) : (
          'Salvar módulos'
        )}
      </Button>
    </div>
  );
}
