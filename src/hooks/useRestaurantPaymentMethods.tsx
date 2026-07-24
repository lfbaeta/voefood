import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export interface RestaurantPaymentMethod {
  provider: 'mercado_pago' | 'asaas';
  accepts_pix: boolean;
  accepts_credit_card: boolean;
  public_key: string | null;
  environment: 'sandbox' | 'production';
}

export function useRestaurantPaymentMethods() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['restaurant-payment-methods', restaurantId],
    enabled: !!restaurantId,
    queryFn: async (): Promise<RestaurantPaymentMethod[]> => {
      const { data, error } = await supabase.rpc('get_restaurant_payment_methods' as any, { p_restaurant_id: restaurantId });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

export function pickProviderForMethod(methods: RestaurantPaymentMethod[] | undefined, method: 'pix' | 'credit_card') {
  if (!methods?.length) return null;
  // Prioridade: Mercado Pago > Asaas
  const order: Array<'mercado_pago' | 'asaas'> = ['mercado_pago', 'asaas'];
  for (const p of order) {
    const m = methods.find(x => x.provider === p);
    if (!m) continue;
    if (method === 'pix' && m.accepts_pix) return m;
    if (method === 'credit_card' && m.accepts_credit_card) return m;
  }
  return null;
}
