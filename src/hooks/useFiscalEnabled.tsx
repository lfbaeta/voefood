import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Retorna se o módulo fiscal (NFC-e) está ativo para o restaurante.
 * Usado para esconder itens de menu, cards e rotas quando desligado.
 */
export function useFiscalEnabled(restaurantId?: string | null) {
  const query = useQuery({
    queryKey: ['fiscal-enabled', restaurantId],
    enabled: !!restaurantId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('has_fiscal_enabled' as any, {
        _restaurant_id: restaurantId,
      });
      return !!data;
    },
  });
  return { enabled: !!query.data, isLoading: query.isLoading };
}
