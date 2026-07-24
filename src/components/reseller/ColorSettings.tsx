import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Reseller } from '@/types/reseller';
import { ColorSettingsPanel, DEFAULT_COLOR_FORM, type ColorFormState } from '@/components/shared/ColorSettingsPanel';
import { useState } from 'react';
import { applyThemeTokens } from '@/lib/themeTokens';

interface ColorSettingsProps {
  reseller: Reseller & {
    primary_color?: string;
    secondary_color?: string;
    background_color?: string;
    foreground_color?: string;
    button_text_color?: string;
  };
  onUpdate: () => void;
}

export function ColorSettings({ reseller, onUpdate }: ColorSettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const initial: Partial<ColorFormState> = {
    primary_color: reseller.primary_color || DEFAULT_COLOR_FORM.primary_color,
    secondary_color: reseller.secondary_color || DEFAULT_COLOR_FORM.secondary_color,
    background_color: reseller.background_color || DEFAULT_COLOR_FORM.background_color,
    foreground_color: reseller.foreground_color || DEFAULT_COLOR_FORM.foreground_color,
    button_text_color: reseller.button_text_color || DEFAULT_COLOR_FORM.button_text_color,
  };

  const handleSave = async (values: ColorFormState) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('resellers')
        .update({
          primary_color: values.primary_color,
          secondary_color: values.secondary_color,
          background_color: values.background_color,
          foreground_color: values.foreground_color,
          button_text_color: values.button_text_color,
        } as any)
        .eq('id', reseller.id);
      if (error) throw error;

      // Propagate defaults to restaurants that still use the reseller palette.
      const { data: restaurants, error: rErr } = await supabase
        .from('restaurants')
        .select('id')
        .eq('reseller_id', reseller.id);
      if (rErr) throw rErr;
      const ids = (restaurants || []).map((r) => r.id);
      if (ids.length > 0) {
        const { error: sErr } = await supabase
          .from('store_config')
          .update({
            primary_color: values.primary_color,
            secondary_color: values.secondary_color,
            background_color: values.background_color,
            foreground_color: values.foreground_color,
            button_text_color: values.button_text_color,
          } as any)
          .in('restaurant_id', ids);
        if (sErr) throw sErr;
      }

      queryClient.invalidateQueries({ queryKey: ['current-reseller'] });
      queryClient.invalidateQueries({ queryKey: ['reseller-restaurants'] });
      queryClient.invalidateQueries({ queryKey: ['store-config'] });

      applyThemeTokens(document.documentElement, {
        primary: values.primary_color,
        secondary: values.secondary_color,
        background: values.background_color,
        foreground: values.foreground_color,
        buttonText: values.button_text_color,
      });

      toast({ title: 'Cores atualizadas com sucesso!' });
      onUpdate();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ColorSettingsPanel
      title="Cores do Sistema"
      description="Aplicado ao painel do revendedor e a todos os estabelecimentos que ainda não têm cores próprias."
      initial={initial}
      saving={saving}
      onSave={handleSave}
    />
  );
}
