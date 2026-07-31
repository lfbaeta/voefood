import { useAdminRestaurant } from './useAdminRestaurant';
import { usePublicRestaurantId } from './usePublicRestaurantId';

/**
 * Hook centralizado para resolver o restaurant_id efetivo.
 * 
 * Prioridade:
 * 1. Admin logado (via useAdminRestaurant)
 * 2. Slug na URL (via usePublicRestaurantId — VIEW pública, sem auth)
 * 
 * Substitui o padrão duplicado em useProducts, useCategories, useOrders,
 * useBusinessHours, useDeliveryZones, useCoupons etc.
 */
export function useEffectiveRestaurantId() {
  const { restaurantId: adminRestaurantId, isLoading: adminLoading } = useAdminRestaurant();
  const { restaurantId: publicRestaurantId, isLoading: publicLoading, slug } = usePublicRestaurantId();

  const effectiveRestaurantId = adminRestaurantId || publicRestaurantId || null;
  const isLoading = slug ? publicLoading : adminLoading;

  return {
    restaurantId: effectiveRestaurantId,
    isLoading,
    slug,
  };
}
