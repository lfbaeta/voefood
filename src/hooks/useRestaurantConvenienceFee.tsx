import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export type ConvenienceFeeType = 'none' | 'percent' | 'fixed' | 'percent_plus_fixed';

export interface ConvenienceFeeInfo {
  fee_type: ConvenienceFeeType;
  fee_percent: number;
  fee_fixed: number;
  fee_amount: number;
  label: string;
  description: string;
}

/**
 * Fetches convenience-fee configuration for the current restaurant.
 * `subtotal` is used server-side to compute the exact amount for percent-based fees.
 */
export function useRestaurantConvenienceFee(subtotal: number) {
  const { restaurantId } = useEffectiveRestaurantId();

  // Round to cents so react-query does not refetch on tiny float noise.
  const roundedSubtotal = Math.round((subtotal || 0) * 100) / 100;

  return useQuery({
    queryKey: ['convenience-fee', restaurantId, roundedSubtotal],
    queryFn: async (): Promise<ConvenienceFeeInfo> => {
      if (!restaurantId) {
        return {
          fee_type: 'none',
          fee_percent: 0,
          fee_fixed: 0,
          fee_amount: 0,
          label: 'Taxa de conveniência',
          description: '',
        };
      }
      const { data, error } = await supabase.rpc('get_restaurant_convenience_fee' as any, {
        p_restaurant_id: restaurantId,
        p_subtotal: roundedSubtotal,
      });
      if (error) throw error;
      const row = (data as any[])?.[0];
      return {
        fee_type: (row?.fee_type as ConvenienceFeeType) || 'none',
        fee_percent: Number(row?.fee_percent || 0),
        fee_fixed: Number(row?.fee_fixed || 0),
        fee_amount: Number(row?.fee_amount || 0),
        label: row?.label || 'Taxa de conveniência',
        description: row?.description || '',
      };
    },
    enabled: !!restaurantId,
    staleTime: 60_000,
  });
}
