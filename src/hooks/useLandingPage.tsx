import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Reseller, SubscriptionPlan } from '@/types/reseller';

export interface LandingPageData {
  reseller: Reseller | null;
  plans: SubscriptionPlan[];
}

export function useLandingPageData(resellerSlug?: string) {
  return useQuery({
    queryKey: ['landing-page', resellerSlug || 'default'],
    queryFn: async (): Promise<LandingPageData> => {
      let reseller: Reseller | null = null;

      if (resellerSlug) {
        // Fetch reseller by slug usando RPC
        const { data, error } = await supabase
          .rpc('get_public_reseller_by_slug', { p_slug: resellerSlug });

        if (!error && data && data.length > 0) {
          reseller = data[0] as unknown as Reseller;
        }
      } else {
        // Fetch the first active reseller with landing page enabled usando RPC
        const { data, error } = await supabase
          .rpc('get_default_public_reseller');

        if (!error && data && data.length > 0) {
          reseller = data[0] as unknown as Reseller;
        }
      }

      if (!reseller) {
        return { reseller: null, plans: [] };
      }

      // Check if landing page is enabled
      if (reseller.landing_page_enabled === false) {
        return { reseller: null, plans: [] };
      }

      // Fetch active plans for this reseller
      const { data: plans, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('reseller_id', reseller.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (plansError) {
        console.error('Error fetching plans:', plansError);
        return { reseller, plans: [] };
      }

      return {
        reseller,
        plans: (plans || []) as SubscriptionPlan[],
      };
    },
  });
}
