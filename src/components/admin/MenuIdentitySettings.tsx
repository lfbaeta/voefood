import { useEffect, useState } from 'react';
import { Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStoreConfig, useUpdateStoreConfig } from '@/hooks/useStore';
import { useToast } from '@/hooks/use-toast';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import {
  BUSINESS_TYPE_LIST,
  BUSINESS_TYPE_PRESETS,
  type BusinessType,
  type MenuLabels,
} from '@/lib/businessTypePresets';
import { getSubtypes } from '@/lib/businessCapabilities';

type LabelKey = keyof MenuLabels;

const FIELD_DEFS: { key: LabelKey; label: string; help?: string }[] = [
  { key: 'heroTagline', label: 'Tagline do topo', help: 'Texto curto acima do nome do estabelecimento (em destaque).' },
  { key: 'menuSectionTitle', label: 'Título da seção principal', help: 'Ex.: "Cardápio", "Produtos", "Cortes".' },
  { key: 'categoriesTitle', label: 'Título de categorias', help: 'Ex.: "Categorias" ou "Departamentos".' },
  { key: 'allCategoriesLabel', label: 'Label do filtro "Todos"' },
  { key: 'searchPlaceholder', label: 'Placeholder da busca' },
  { key: 'itemsLabelSingular', label: 'Singular do contador', help: 'Ex.: "item", "produto".' },
  { key: 'itemsLabelPlural', label: 'Plural do contador', help: 'Ex.: "itens", "produtos".' },
  { key: 'emptyStateText', label: 'Mensagem quando não há produtos' },
  { key: 'emptySearchText', label: 'Mensagem quando a busca não encontra nada' },
  { key: 'allCategoriesEmoji', label: 'Emoji do botão "Todos"' },
  { key: 'defaultCategoryEmoji', label: 'Emoji padrão de categoria sem imagem' },
];

export function MenuIdentitySettings() {
  const { data: store } = useStoreConfig();
  const updateStore = useUpdateStoreConfig();
  const { toast } = useToast();
  const { checkDemoMode } = useDemoGuard();

  const [businessType, setBusinessType] = useState<BusinessType>('restaurant');
  const [businessSubtype, setBusinessSubtype] = useState<string>('');
  const [overrides, setOverrides] = useState<Partial<MenuLabels>>({});

  useEffect(() => {
    if (store) {
      const bt = ((store as any).business_type as BusinessType) || 'restaurant';
      setBusinessType(BUSINESS_TYPE_PRESETS[bt] ? bt : 'restaurant');
      setBusinessSubtype(((store as any).business_subtype as string) || '');
      setOverrides(((store as any).menu_labels as Partial<MenuLabels>) || {});
    }
  }, [store]);

  if (!store) return null;

  const preset = BUSINESS_TYPE_PRESETS[businessType] || BUSINESS_TYPE_PRESETS.restaurant;

  const handleFieldChange = (key: LabelKey, value: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value.trim().length === 0) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const handleResetAll = () => {
    setOverrides({});
  };

  const handleSave = async () => {
    if (checkDemoMode()) return;
    if (!store.id) return;
    try {
      await updateStore.mutateAsync({
        id: store.id,
        business_type: businessType,
        business_subtype: businessSubtype || null,
        menu_labels: overrides,
      } as any);
      toast({ title: 'Identidade do cardápio salva!' });
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="bg-card rounded-xl p-4 sm:p-6 shadow-card space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        <h3 className="font-semibold text-foreground text-sm sm:text-base">
          Identidade do Cardápio
        </h3>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">
        Personalize os textos que aparecem no cardápio do cliente. Útil quando você atende
        farmácia, mercado, açougue, padaria, pet shop etc.
      </p>

      <div className="space-y-2">
        <Label htmlFor="business-type">Tipo de estabelecimento</Label>
        <Select value={businessType} onValueChange={(v) => { setBusinessType(v as BusinessType); setBusinessSubtype(''); }}>
          <SelectTrigger id="business-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUSINESS_TYPE_LIST.map((bt) => (
              <SelectItem key={bt.id} value={bt.id}>
                {bt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{preset.description}</p>
      </div>

      {getSubtypes(businessType).length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="business-subtype">Subtipo (opcional)</Label>
          <Select value={businessSubtype || '__none__'} onValueChange={(v) => setBusinessSubtype(v === '__none__' ? '' : v)}>
            <SelectTrigger id="business-subtype">
              <SelectValue placeholder="Escolha um subtipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem subtipo</SelectItem>
              {getSubtypes(businessType).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O subtipo ajusta finamente quais campos e funcionalidades aparecem no painel.
          </p>
        </div>
      )}

      <div className="space-y-4 pt-2 border-t border-border">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Personalizar textos</p>
          <Button type="button" variant="ghost" size="sm" onClick={handleResetAll}>
            <RotateCcw className="h-3 w-3 mr-1" />
            Resetar para o padrão
          </Button>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Deixe em branco para usar o texto padrão do tipo selecionado.
        </p>

        <div className="grid gap-4">
          {FIELD_DEFS.map(({ key, label, help }) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`field-${key}`} className="text-xs">
                {label}
              </Label>
              <Input
                id={`field-${key}`}
                value={overrides[key] ?? ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                placeholder={preset.labels[key]}
                className="h-9"
              />
              {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={updateStore.isPending} className="w-full">
        {updateStore.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Salvando...
          </>
        ) : (
          'Salvar Identidade do Cardápio'
        )}
      </Button>
    </div>
  );
}
