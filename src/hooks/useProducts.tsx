import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRestaurant } from './useAdminRestaurant';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

import type { PizzaFlavor, PizzaBorder } from '@/lib/pizza';

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  restaurant_id?: string | null;
  unit_of_sale?: 'un' | 'kg' | 'g' | 'L' | 'ml';
  allow_weight_variation?: boolean;
  track_stock?: boolean;
  stock_qty?: number | null;
  min_stock_qty?: number | null;
  availability_locked?: boolean;
  // Promoções
  promo_enabled?: boolean | null;
  promo_price?: number | null;
  promo_starts_at?: string | null;
  promo_ends_at?: string | null;
  // Pizza module
  is_pizza?: boolean;
  pizza_max_flavors?: number | null;
  pizza_flavors?: PizzaFlavor[] | null;
  pizza_borders?: PizzaBorder[] | null;
  pizza_pricing_rule?: 'highest' | null;
}

export function useProducts() {
  const { restaurantId, isLoading: idLoading } = useEffectiveRestaurantId();

  return useQuery({
    queryKey: ['products', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name');

      if (error) throw error;
      return (data as unknown) as Product[];
    },
    enabled: !idLoading && !!restaurantId,
    // Reavalia periodicamente para promoções iniciarem/encerrarem sozinhas
    refetchInterval: 60_000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  
  return useMutation({
    mutationFn: async (product: Omit<Product, 'id'>) => {
      const { data, error } = await supabase
        .from('products')
        .insert({ ...(product as any), restaurant_id: restaurantId })
        .select()
        .single();

      if (error) throw error;
      return (data as unknown) as Product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...update }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(update as any)
        .eq('id', id)
        .select();

      if (error) throw error;
      return (data?.[0] as unknown) as Product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
