import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

const client: any = supabase;

export interface DriverWithLocation {
  id: string;
  name: string;
  phone: string | null;
  vehicle_type: string;
  status: string;
  photo_url: string | null;
  lat: number | null;
  lng: number | null;
  updated_at: string | null;
}

export function useDriversWithLocation(pollMs = 15000) {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['drivers-with-location', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as DriverWithLocation[];
      const { data, error } = await client.rpc('get_drivers_with_location', {
        p_restaurant_id: restaurantId,
      });
      if (error) throw error;
      return (data || []) as DriverWithLocation[];
    },
    enabled: !!restaurantId,
    refetchInterval: pollMs,
  });
}

export interface NearestDriver {
  driver_id: string;
  driver_name: string;
  distance_km: number | null;
  status: string;
  last_seen: string | null;
}

export function useSuggestNearestDriver() {
  return useMutation({
    mutationFn: async (orderId: number) => {
      const { data, error } = await client.rpc('suggest_nearest_driver', {
        p_order_id: orderId,
      });
      if (error) throw error;
      return (data || []) as NearestDriver[];
    },
  });
}

export interface ShiftReportRow {
  driver_id: string;
  driver_name: string;
  shifts_count: number;
  total_deliveries: number;
  total_commission: number;
  total_hours: number;
  avg_rating: number | null;
}

export function useDriverShiftsReport(startISO?: string, endISO?: string) {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['driver-shifts-report', restaurantId, startISO, endISO],
    queryFn: async () => {
      if (!restaurantId) return [] as ShiftReportRow[];
      const params: any = { p_restaurant_id: restaurantId };
      if (startISO) params.p_start = startISO;
      if (endISO) params.p_end = endISO;
      const { data, error } = await client.rpc('get_driver_shifts_report', params);
      if (error) throw error;
      return (data || []) as ShiftReportRow[];
    },
    enabled: !!restaurantId,
  });
}
