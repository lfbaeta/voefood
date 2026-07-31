import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  setBusinessTypeDefaults,
  type BusinessCapabilities,
} from '@/lib/businessCapabilities';

export type BusinessTypeDefaultsMap = Record<string, Partial<BusinessCapabilities>>;

/**
 * Carrega os padrões de módulos por tipo de estabelecimento definidos pelo
 * Super Admin e sincroniza com o registro em memória usado por resolveCapabilities.
 */
export function useBusinessTypeDefaults() {
  const query = useQuery({
    queryKey: ['business-type-defaults'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BusinessTypeDefaultsMap> => {
      const { data, error } = await supabase
        .from('business_type_defaults')
        .select('business_type, capabilities');
      if (error) throw error;
      const map: BusinessTypeDefaultsMap = {};
      for (const row of data || []) {
        map[(row as any).business_type] =
          ((row as any).capabilities as Partial<BusinessCapabilities>) || {};
      }
      return map;
    },
  });

  useEffect(() => {
    if (query.data) setBusinessTypeDefaults(query.data);
  }, [query.data]);

  return query;
}

export function useSaveBusinessTypeDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      businessType: string;
      capabilities: Partial<BusinessCapabilities>;
    }) => {
      const { businessType, capabilities } = params;

      if (!capabilities || Object.keys(capabilities).length === 0) {
        const { error } = await supabase
          .from('business_type_defaults')
          .delete()
          .eq('business_type', businessType);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('business_type_defaults')
        .upsert(
          { business_type: businessType, capabilities: capabilities as any },
          { onConflict: 'business_type' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-type-defaults'] });
      qc.invalidateQueries({ queryKey: ['store-config'] });
    },
  });
}
