import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export interface DeliveryDriver {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  cpf: string | null;
  photo_url: string | null;
  vehicle_type: 'motorcycle' | 'bicycle' | 'car' | 'foot';
  vehicle_plate: string | null;
  vehicle_model: string | null;
  pin: string;
  is_active: boolean;
  status: 'offline' | 'available' | 'on_delivery' | 'returning' | 'paused';
  commission_type: 'fixed' | 'percent' | 'per_km';
  commission_value: number;
  pix_key: string | null;
}

const client: any = supabase;

export function useDrivers() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['delivery-drivers', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as DeliveryDriver[];
      const { data, error } = await client
        .from('delivery_drivers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name');
      if (error) throw error;
      return (data || []) as DeliveryDriver[];
    },
    enabled: !!restaurantId,
  });
}

export function useSaveDriver() {
  const { restaurantId } = useEffectiveRestaurantId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<DeliveryDriver> & { id?: string }) => {
      const payload: any = { ...row, restaurant_id: restaurantId };
      if (row.id) {
        const { error } = await client.from('delivery_drivers').update(payload).eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('delivery_drivers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-drivers'] }),
  });
}

export function useDeleteDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('delivery_drivers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['delivery-drivers'] }),
  });
}

export function useAssignDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, driverId }: { orderId: number; driverId: string }) => {
      const { error } = await client.rpc('assign_driver_to_order', {
        p_order_id: orderId,
        p_driver_id: driverId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['delivery-drivers'] });
    },
  });
}
