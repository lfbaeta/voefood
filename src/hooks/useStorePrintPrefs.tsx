import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';
import { invalidatePrintPrefsCache } from '@/lib/printQueue';

export interface StorePrintPrefs {
  auto_print_enabled: boolean;
  auto_print_delivery: boolean;
  auto_print_table: boolean;
  auto_print_quick_sale: boolean;
  print_split_by_department: boolean;
  print_default_paper_width: 32 | 48;
  print_default_copies: 1 | 2 | 3;
}

export const DEFAULT_PREFS: StorePrintPrefs = {
  auto_print_enabled: false,
  auto_print_delivery: true,
  auto_print_table: true,
  auto_print_quick_sale: true,
  print_split_by_department: true,
  print_default_paper_width: 48,
  print_default_copies: 1,
};

export function useStorePrintPrefs() {
  const { restaurantId } = useEffectiveRestaurantId();
  const [prefs, setPrefs] = useState<StorePrintPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('store_config')
        .select('auto_print_enabled, auto_print_delivery, auto_print_table, auto_print_quick_sale, print_split_by_department, print_default_paper_width, print_default_copies')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      if (!alive) return;
      if (data) {
        setPrefs({
          auto_print_enabled: !!(data as any).auto_print_enabled,
          auto_print_delivery: (data as any).auto_print_delivery !== false,
          auto_print_table: (data as any).auto_print_table !== false,
          auto_print_quick_sale: (data as any).auto_print_quick_sale !== false,
          print_split_by_department: (data as any).print_split_by_department !== false,
          print_default_paper_width: (Number((data as any).print_default_paper_width) === 32 ? 32 : 48) as 32 | 48,
          print_default_copies: (Math.min(3, Math.max(1, Number((data as any).print_default_copies) || 1)) as 1 | 2 | 3),
        });
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [restaurantId]);

  const update = useCallback(async (patch: Partial<StorePrintPrefs>) => {
    if (!restaurantId) return;
    setPrefs((p) => ({ ...p, ...patch }));
    setSaving(true);
    try {
      await supabase.from('store_config').update(patch as any).eq('restaurant_id', restaurantId);
      invalidatePrintPrefsCache(restaurantId);
    } finally {
      setSaving(false);
    }
  }, [restaurantId]);

  return { prefs, update, loading, saving };
}
