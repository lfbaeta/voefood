import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useCustomerOrders(restaurantId: string | undefined, phone: string | null | undefined) {
  return useQuery({
    queryKey: ['customer-orders', restaurantId, phone],
    enabled: !!restaurantId && !!phone && phone.replace(/\D/g, '').length >= 8,
    queryFn: async () => {
      const digits = (phone ?? '').replace(/\D/g, '');
      const { data, error } = await supabase.rpc('search_customer_orders', {
        p_restaurant_id: restaurantId!,
        p_phone_digits: digits,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}
