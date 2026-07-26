import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveRestaurantId } from './useEffectiveRestaurantId';
import { ALL_PLAN_FEATURE_IDS, ALWAYS_ENABLED_FEATURES } from '@/lib/planFeatures';

/**
 * Returns the set of enabled feature IDs for the current restaurant's plan.
 * If the restaurant has no plan_id, all features are enabled (backwards compat).
 */
export function useRestaurantPlanFeatures() {
  const { restaurantId } = useEffectiveRestaurantId();

  const query = useQuery({
    queryKey: ['restaurant-plan-features', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;

      const { data: rest, error: rErr } = await supabase
        .from('restaurants_public')
        .select('plan_id')
        .eq('id', restaurantId)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!rest?.plan_id) return null;

      const { data: plan, error: pErr } = await supabase
        .from('subscription_plans')
        .select('enabled_features')
        .eq('id', rest.plan_id)
        .maybeSingle();
      if (pErr) throw pErr;

      return (plan?.enabled_features as string[] | null) ?? null;
    },
    enabled: !!restaurantId,
    staleTime: 60_000,
  });

  const enabledSet = new Set<string>([
    ...ALWAYS_ENABLED_FEATURES,
    ...(query.data ?? ALL_PLAN_FEATURE_IDS),
  ]);

  return {
    isLoading: query.isLoading,
    isFeatureEnabled: (id: string) => enabledSet.has(id),
    enabledFeatures: enabledSet,
    hasPlan: !!query.data,
  };
}
