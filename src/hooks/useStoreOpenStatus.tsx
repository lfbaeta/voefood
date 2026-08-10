import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BusinessHour, isStoreCurrentlyOpen } from './useBusinessHours';

interface StoreOpenStatusResult {
  isOpen: boolean;
  manualOverride: boolean;
  withinBusinessHours: boolean;
  isLoading: boolean;
}

/**
 * Hook to determine if a store is currently open.
 * A store is considered open ONLY if:
 * 1. The manual toggle (is_open) is set to true in store_config
 * 2. AND the current time is within the configured business hours
 */
export function useStoreOpenStatus(restaurantId: string | null | undefined): StoreOpenStatusResult {
  // Recompute open/closed status periodically so UI stays in sync with time.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Get store config for manual toggle + timezone
  const { data: storeConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['store-open-status-config', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;

      // Admins/resellers can read the full table.
      const { data, error } = await supabase
        .from('store_config')
        .select('is_open, timezone')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (!error && data) return data as { is_open: boolean; timezone: string | null };

      // Public/anonymous customers: RLS blocks store_config, use the public RPC.
      const { data: publicData, error: rpcError } = await supabase
        .rpc('get_public_store_config', { p_restaurant_id: restaurantId });

      if (rpcError) throw rpcError;
      const row = Array.isArray(publicData) ? publicData[0] : null;
      if (!row) return null;

      return { is_open: (row as any).is_open ?? false, timezone: (row as any).timezone ?? null };
    },
    enabled: !!restaurantId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });


  // Get business hours
  const { data: businessHours, isLoading: isLoadingHours } = useQuery({
    queryKey: ['store-open-status-hours', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('day_of_week');

      if (error) throw error;
      return data as BusinessHour[];
    },
    enabled: !!restaurantId,
    staleTime: 30_000,
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,

  });

  const isLoading = isLoadingConfig || isLoadingHours;
  const manualOverride = storeConfig?.is_open ?? false;
  const timezone = (storeConfig as any)?.timezone ?? null;
  const withinBusinessHours = businessHours && businessHours.length > 0
    ? isStoreCurrentlyOpen(businessHours, new Date(nowTick), timezone)
    : true; // If no business hours configured, consider within hours

  // Store is open only if manual toggle is ON (this matches the user's request to obey the button)
  const isOpen = manualOverride;

  return {
    isOpen,
    manualOverride,
    withinBusinessHours,
    isLoading,
  };
}


/**
 * Hook to get open status by slug (for public pages)
 */
export function useStoreOpenStatusBySlug(slug: string | undefined): StoreOpenStatusResult {
  // First get restaurant ID from slug usando VIEW pública
  const { data: restaurant, isLoading: isLoadingRestaurant } = useQuery({
    queryKey: ['restaurant-by-slug', slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .from('restaurants_public' as any)
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as { id: string } | null;
    },
    enabled: !!slug,
  });

  const statusResult = useStoreOpenStatus(restaurant?.id);

  return {
    ...statusResult,
    isLoading: isLoadingRestaurant || statusResult.isLoading,
  };
}
