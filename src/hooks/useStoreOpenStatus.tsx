import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  // Recompute open/closed status periodically so UI stays in sync with time.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Keep every surface (cardápio, carrinho, painel) in sync with the manual toggle.
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`store-open-status-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'store_config', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['store-open-status-config', restaurantId] });
          queryClient.invalidateQueries({ queryKey: ['store-config'] });
          queryClient.invalidateQueries({ queryKey: ['public-store-config'] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'business_hours', filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['store-open-status-hours', restaurantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, queryClient]);

  // Get store config for manual toggle
  const { data: storeConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['store-open-status-config', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      
      const { data, error } = await supabase
        .from('store_config')
        .select('is_open')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
    staleTime: 10_000,
    refetchInterval: 30_000,
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
    staleTime: 60_000,
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,
  });

  const isLoading = isLoadingConfig || isLoadingHours;
  const manualOverride = storeConfig?.is_open ?? false;
  const withinBusinessHours = businessHours && businessHours.length > 0
    ? isStoreCurrentlyOpen(businessHours, new Date(nowTick))
    : true; // If no business hours configured, consider within hours

  // O botão manual do lojista é a fonte da verdade: se ele abrir, a loja fica aberta.
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
        .rpc('get_public_restaurant', { p_slug: slug })
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
