import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRestaurant } from './useAdminRestaurant';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  restaurant_id?: string | null;
}

export function useCoupons() {
  const { restaurantId } = useAdminRestaurant();

  return useQuery({
    queryKey: ['coupons', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data.map(c => ({
        ...c,
        discount_type: c.discount_type as 'percentage' | 'fixed',
      })) as Coupon[];
    },
    enabled: !!restaurantId,
  });
}

export function useValidateCoupon() {
  const { restaurantId } = useEffectiveRestaurantId();

  return useMutation({
    mutationFn: async ({ code, orderTotal }: { code: string; orderTotal: number }) => {
      if (!restaurantId) throw new Error('Restaurante não identificado');

      const { data, error } = await (supabase.rpc as any)('validate_coupon_lookup', {
        p_code: code,
        p_restaurant_id: restaurantId,
        p_order_total: orderTotal,
      });

      if (error) {
        const msg = String((error as { message?: string })?.message || '');
        if (msg.includes('coupon_not_found')) throw new Error('Cupom não encontrado');
        if (msg.includes('coupon_expired')) throw new Error('Cupom expirado');
        if (msg.includes('coupon_exhausted')) throw new Error('Cupom esgotado');
        if (msg.includes('coupon_min_order_not_met')) {
          const min = msg.split('coupon_min_order_not_met:')[1] || '';
          throw new Error(`Pedido mínimo de R$ ${Number(min).toFixed(2)} para usar este cupom`);
        }
        throw new Error('Cupom não encontrado');
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('Cupom não encontrado');

      return {
        ...row,
        discount_type: row.discount_type as 'percentage' | 'fixed',
      } as Coupon;
    },
  });
}

export function useCreateCoupon() {
  const queryClient = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  
  return useMutation({
    mutationFn: async (coupon: Omit<Coupon, 'id' | 'current_uses' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('coupons')
        .insert({
          code: coupon.code.toUpperCase(),
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          min_order_value: coupon.min_order_value,
          max_uses: coupon.max_uses,
          is_active: coupon.is_active,
          expires_at: coupon.expires_at,
          restaurant_id: restaurantId,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Coupon;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });
}

export function useUpdateCoupon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...coupon }: Partial<Coupon> & { id: string }) => {
      const { data, error } = await supabase
        .from('coupons')
        .update(coupon)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data?.[0] as Coupon;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });
}

export function useDeleteCoupon() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });
}

export function calculateDiscount(coupon: Coupon, orderTotal: number): number {
  if (coupon.discount_type === 'percentage') {
    return (orderTotal * coupon.discount_value) / 100;
  }
  return coupon.discount_value;
}
