import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRestaurant } from './useAdminRestaurant';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';

export type CategoryDepartment = 'kitchen' | 'bar';

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  image_url?: string | null;
  restaurant_id?: string | null;
  department?: CategoryDepartment;
}

export function useCategories() {
  const { restaurantId, isLoading: idLoading } = useEffectiveRestaurantId();

  return useQuery({
    queryKey: ['categories', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('sort_order');

      if (error) throw error;
      return data as Category[];
    },
    enabled: !idLoading && !!restaurantId,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { restaurantId } = useAdminRestaurant();
  
  return useMutation({
    mutationFn: async (category: { name: string; sort_order: number; image_url?: string | null; department?: CategoryDepartment }) => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ ...category, restaurant_id: restaurantId })
        .select()
        .single();

      if (error) throw error;
      return data as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...update }: Partial<Category> & { id: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(update)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data?.[0] as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) => ({
        id,
        sort_order: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('categories')
          .update({ sort_order: update.sort_order })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}
