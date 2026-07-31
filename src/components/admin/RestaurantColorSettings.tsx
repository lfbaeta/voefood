import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStoreConfig, useUpdateStoreConfig } from '@/hooks/useStore';
import { useToast } from '@/hooks/use-toast';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import { ColorSettingsPanel, DEFAULT_COLOR_FORM, type ColorFormState } from '@/components/shared/ColorSettingsPanel';
import { applyThemeTokens } from '@/lib/themeTokens';

/**
 * Per-restaurant color settings, mounted in the admin Settings page.
 * Saves onto `store_config` so each restaurant can override the reseller-wide
 * palette independently.
 */
export function RestaurantColorSettings() {
  const { data: store } = useStoreConfig();
  const updateStore = useUpdateStoreConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { checkDemoMode } = useDemoGuard();
  const [saving, setSaving] = useState(false);

  if (!store) return null;

  const initial: Partial<ColorFormState> = {
    primary_color: (store as any).primary_color || DEFAULT_COLOR_FORM.primary_color,
    secondary_color: (store as any).secondary_color || DEFAULT_COLOR_FORM.secondary_color,
    background_color: (store as any).background_color || DEFAULT_COLOR_FORM.background_color,
    foreground_color: (store as any).foreground_color || DEFAULT_COLOR_FORM.foreground_color,
    button_text_color: (store as any).button_text_color || DEFAULT_COLOR_FORM.button_text_color,
  };

  const handleSave = async (values: ColorFormState) => {
    if (checkDemoMode()) return;
    if (!store?.id) return;
    setSaving(true);
    try {
      await updateStore.mutateAsync({
        id: store.id,
        primary_color: values.primary_color,
        secondary_color: values.secondary_color,
        background_color: values.background_color,
        foreground_color: values.foreground_color,
        button_text_color: values.button_text_color,
      } as any);

      queryClient.invalidateQueries({ queryKey: ['store-config'] });

      applyThemeTokens(document.documentElement, {
        primary: values.primary_color,
        secondary: values.secondary_color,
        background: values.background_color,
        foreground: values.foreground_color,
        buttonText: values.button_text_color,
      });

      toast({ title: 'Cores do restaurante atualizadas!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ColorSettingsPanel
      title="Cores do Restaurante"
      description="Personalize as cores exibidas no seu cardápio, painel e app. Escolha uma paleta pronta ou ajuste manualmente."
      initial={initial}
      saving={saving}
      onSave={handleSave}
    />
  );
}
