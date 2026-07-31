import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSlug } from '@/hooks/useSlug';

/**
 * Hook para resolver restaurant_id a partir do slug via RPC pública
 * (seguro para páginas anônimas). Usa `get_restaurant_id_by_slug`.
 */
export function usePublicRestaurantId() {
  const slug = useSlug();

  const { data: restaurantId, isLoading } = useQuery({
    queryKey: ['public-restaurant-id', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase.rpc('get_restaurant_id_by_slug', {
        p_slug: slug,
      });
      if (error) throw error;
      return (data as string | null) || null;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });

  return { restaurantId, isLoading, slug };
}

/**
 * Versão utilitária (fora de hooks).
 */
export async function getPublicRestaurantIdBySlug(slug: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_restaurant_id_by_slug', {
    p_slug: slug,
  });
  if (error) throw error;
  return (data as string | null) || null;
}
