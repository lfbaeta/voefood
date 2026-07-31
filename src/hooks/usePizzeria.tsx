import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export interface PizzaSize {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  max_flavors: number;
  base_price: number | null;
  sort_order: number;
  is_available: boolean;
}

export interface PizzaFlavorCatalog {
  id: string;
  restaurant_id: string;
  name: string;
  ingredients: string | null;
  image_url: string | null;
  category: string | null;
  sort_order: number;
  is_available: boolean;
}

export interface PizzaBorderCatalog {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_available: boolean;
}

export interface PizzaFlavorPrice { flavor_id: string; size_id: string; price: number; }
export interface PizzaBorderPrice { border_id: string; size_id: string; price: number; }

const client: any = supabase;

export function usePizzaSizes() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['pizza-sizes', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as PizzaSize[];
      const { data, error } = await client.from('pizza_sizes').select('*').eq('restaurant_id', restaurantId).order('sort_order').order('name');
      if (error) throw error;
      return (data || []) as PizzaSize[];
    },
    enabled: !!restaurantId,
  });
}

export function usePizzaFlavors() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['pizza-flavors', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as PizzaFlavorCatalog[];
      const { data, error } = await client.from('pizza_flavors_catalog').select('*').eq('restaurant_id', restaurantId).order('sort_order').order('name');
      if (error) throw error;
      return (data || []) as PizzaFlavorCatalog[];
    },
    enabled: !!restaurantId,
  });
}

export function usePizzaBorders() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['pizza-borders', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as PizzaBorderCatalog[];
      const { data, error } = await client.from('pizza_borders_catalog').select('*').eq('restaurant_id', restaurantId).order('sort_order').order('name');
      if (error) throw error;
      return (data || []) as PizzaBorderCatalog[];
    },
    enabled: !!restaurantId,
  });
}

export function usePizzaFlavorPrices() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['pizza-flavor-prices', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as PizzaFlavorPrice[];
      const { data, error } = await client
        .from('pizza_flavor_prices')
        .select('flavor_id, size_id, price, pizza_flavors_catalog!inner(restaurant_id)')
        .eq('pizza_flavors_catalog.restaurant_id', restaurantId);
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({ flavor_id: r.flavor_id, size_id: r.size_id, price: Number(r.price) }));
    },
    enabled: !!restaurantId,
  });
}

export function usePizzaBorderPrices() {
  const { restaurantId } = useEffectiveRestaurantId();
  return useQuery({
    queryKey: ['pizza-border-prices', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [] as PizzaBorderPrice[];
      const { data, error } = await client
        .from('pizza_border_prices')
        .select('border_id, size_id, price, pizza_borders_catalog!inner(restaurant_id)')
        .eq('pizza_borders_catalog.restaurant_id', restaurantId);
      if (error) throw error;
      return ((data || []) as any[]).map((r) => ({ border_id: r.border_id, size_id: r.size_id, price: Number(r.price) }));
    },
    enabled: !!restaurantId,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['pizza-sizes'] });
    qc.invalidateQueries({ queryKey: ['pizza-flavors'] });
    qc.invalidateQueries({ queryKey: ['pizza-borders'] });
    qc.invalidateQueries({ queryKey: ['pizza-flavor-prices'] });
    qc.invalidateQueries({ queryKey: ['pizza-border-prices'] });
  };
}

export function useSavePizzaSize() {
  const { restaurantId } = useEffectiveRestaurantId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (row: Partial<PizzaSize> & { id?: string }) => {
      const payload: any = { ...row, restaurant_id: restaurantId };
      if (row.id) {
        const { error } = await client.from('pizza_sizes').update(payload).eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await client.from('pizza_sizes').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}
export function useDeletePizzaSize() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('pizza_sizes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSavePizzaFlavor() {
  const { restaurantId } = useEffectiveRestaurantId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (args: { row: Partial<PizzaFlavorCatalog> & { id?: string }; pricesBySizeId: Record<string, number> }) => {
      const payload: any = { ...args.row, restaurant_id: restaurantId };
      let flavorId = args.row.id;
      if (flavorId) {
        const { error } = await client.from('pizza_flavors_catalog').update(payload).eq('id', flavorId);
        if (error) throw error;
      } else {
        const { data, error } = await client.from('pizza_flavors_catalog').insert(payload).select().single();
        if (error) throw error;
        flavorId = (data as any).id;
      }
      // upsert prices
      const rows = Object.entries(args.pricesBySizeId).map(([size_id, price]) => ({ flavor_id: flavorId, size_id, price: Number(price) || 0 }));
      if (rows.length > 0) {
        const { error } = await client.from('pizza_flavor_prices').upsert(rows, { onConflict: 'flavor_id,size_id' });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}
export function useDeletePizzaFlavor() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('pizza_flavors_catalog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useSavePizzaBorder() {
  const { restaurantId } = useEffectiveRestaurantId();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (args: { row: Partial<PizzaBorderCatalog> & { id?: string }; pricesBySizeId: Record<string, number> }) => {
      const payload: any = { ...args.row, restaurant_id: restaurantId };
      let borderId = args.row.id;
      if (borderId) {
        const { error } = await client.from('pizza_borders_catalog').update(payload).eq('id', borderId);
        if (error) throw error;
      } else {
        const { data, error } = await client.from('pizza_borders_catalog').insert(payload).select().single();
        if (error) throw error;
        borderId = (data as any).id;
      }
      const rows = Object.entries(args.pricesBySizeId).map(([size_id, price]) => ({ border_id: borderId, size_id, price: Number(price) || 0 }));
      if (rows.length > 0) {
        const { error } = await client.from('pizza_border_prices').upsert(rows, { onConflict: 'border_id,size_id' });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}
export function useDeletePizzaBorder() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.from('pizza_borders_catalog').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
