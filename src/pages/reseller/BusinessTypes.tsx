import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Loader2, RotateCcw, SlidersHorizontal, Save, Check } from 'lucide-react';
import { ResellerLayout } from '@/components/reseller/ResellerLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useBusinessTypeDefaults,
  useSaveBusinessTypeDefaults,
} from '@/hooks/useBusinessTypeDefaults';
import { BUSINESS_TYPE_LIST, type BusinessType } from '@/lib/businessTypePresets';
import {
  getFactoryCapabilities,
  CAPABILITY_LABELS,
  type BusinessCapabilities,
} from '@/lib/businessCapabilities';

type CapKey = keyof BusinessCapabilities;

const GROUPS: { title: string; keys: CapKey[] }[] = [
  {
    title: 'Operação',
    keys: [
      'counterPOS',
      'deliveryModule',
      'kitchenDepartment',
      'barDepartment',
      'waiterModule',
      'tableModule',
      'pizzaModule',
      'stockRecipes',
    ],
  },
  {
    title: 'Produto',
    keys: [
      'productHasAddons',
      'productHasVariants',
      'productSoldByWeight',
      'productHasFlavors',
      'productHasBorder',
      'productHasPrescription',
      'productHasExpiration',
      'productHasBrand',
      'productHasNutrition',
    ],
  },
  { title: 'Cardápio', keys: ['showCombos', 'showFlavorFilter'] },
];

const ALL_KEYS = GROUPS.flatMap((g) => g.keys);

function TypeEditor({
  type,
  saved,
}: {
  type: BusinessType;
  saved: Partial<BusinessCapabilities>;
}) {
  const { toast } = useToast();
  const save = useSaveBusinessTypeDefaults();
  const factory = useMemo(() => getFactoryCapabilities(type), [type]);
  const [draft, setDraft] = useState<Partial<BusinessCapabilities>>(saved || {});

  useEffect(() => {
    setDraft(saved || {});
  }, [saved]);

  const effective = { ...factory, ...draft } as BusinessCapabilities;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved || {});

  const handleToggle = (key: CapKey, checked: boolean) => {
    setDraft((prev) => {
      const next = { ...prev } as any;
      if (checked === (factory[key] as boolean)) delete next[key];
      else next[key] = checked;
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await save.mutateAsync({ businessType: type, capabilities: draft });
      toast({ title: 'Padrão salvo!', description: 'Vale para novos ajustes deste tipo.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Marque quais módulos ficam liberados por padrão para este tipo de estabelecimento.
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({})}>
          <RotateCcw className="h-3 w-3 mr-1" />
          Voltar ao padrão de fábrica
        </Button>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title} className="space-y-3">
          <p className="text-sm font-semibold text-foreground">{g.title}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.keys.map((key) => {
              const factoryValue = factory[key] as boolean;
              const value = effective[key] as boolean;
              const isOverridden = key in draft;
              return (
                <div
                  key={key}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`${type}-${key}`} className="text-sm text-foreground">
                      {CAPABILITY_LABELS[key]}
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Fábrica:{' '}
                      <span className="font-medium">
                        {factoryValue ? 'Ativado' : 'Desativado'}
                      </span>
                      {isOverridden && <span className="ml-2 text-primary">• Personalizado</span>}
                    </p>
                  </div>
                  <Switch
                    id={`${type}-${key}`}
                    checked={value}
                    onCheckedChange={(c) => handleToggle(key, c)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Button onClick={handleSave} disabled={save.isPending || !dirty} className="w-full">
        {save.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Salvando...
          </>
        ) : dirty ? (
          <>
            <Save className="h-4 w-4 mr-2" />
            Salvar padrão deste tipo
          </>
        ) : (
          <>
            <Check className="h-4 w-4 mr-2" />
            Tudo salvo
          </>
        )}
      </Button>
    </div>
  );
}

export default function BusinessTypes() {
  const { data, isLoading } = useBusinessTypeDefaults();

  return (
    <ResellerLayout title="Módulos por Tipo">
      <Helmet>
        <title>Módulos por tipo de estabelecimento | Super Admin</title>
        <meta
          name="description"
          content="Defina quais módulos (PDV, delivery, cozinha, bar, peso, adicionais) cada tipo de estabelecimento libera por padrão."
        />
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Módulos por tipo de estabelecimento
            </h1>
            <p className="text-xs text-muted-foreground">
              O que você definir aqui passa a ser o padrão de todos os restaurantes do tipo
              correspondente. Cada loja ainda pode ajustar o próprio caso em “Módulos ativos”.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="bg-card rounded-xl p-2 sm:p-4 shadow-card">
            <Accordion type="single" collapsible className="w-full">
              {BUSINESS_TYPE_LIST.map((preset) => {
                const saved = (data?.[preset.id] || {}) as Partial<BusinessCapabilities>;
                const customCount = ALL_KEYS.filter((k) => k in saved).length;
                const Icon = preset.icon;
                return (
                  <AccordionItem key={preset.id} value={preset.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{preset.label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {preset.description}
                          </p>
                        </div>
                        {customCount > 0 && (
                          <Badge variant="secondary" className="ml-2 shrink-0">
                            {customCount} personalizado{customCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <TypeEditor type={preset.id} saved={saved} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}
      </div>
    </ResellerLayout>
  );
}
