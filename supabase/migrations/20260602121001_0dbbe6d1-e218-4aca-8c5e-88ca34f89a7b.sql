-- Make every active reseller a global admin: full access to all restaurants and related configs

-- 1) Broaden helper: any active reseller is considered "reseller of any restaurant"
CREATE OR REPLACE FUNCTION public.is_reseller_of_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_reseller(_user_id);
$function$;

-- 2) restaurant_admins: allow any reseller to manage admins of any restaurant
DROP POLICY IF EXISTS "Resellers can delete restaurant admins" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Resellers can manage restaurant admins" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Resellers can update restaurant admins" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Restaurant admins viewable by reseller or self" ON public.restaurant_admins;

CREATE POLICY "Restaurant admins viewable by reseller or self"
ON public.restaurant_admins FOR SELECT
USING (user_id = auth.uid() OR public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can insert restaurant admins"
ON public.restaurant_admins FOR INSERT
WITH CHECK (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can update restaurant admins"
ON public.restaurant_admins FOR UPDATE
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can delete restaurant admins"
ON public.restaurant_admins FOR DELETE
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3) restaurants: any reseller can manage any restaurant
DROP POLICY IF EXISTS "Resellers can delete own restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Resellers can insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Resellers can update own restaurants" ON public.restaurants;

CREATE POLICY "Resellers can insert restaurants"
ON public.restaurants FOR INSERT
WITH CHECK (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can update restaurants"
ON public.restaurants FOR UPDATE
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can delete restaurants"
ON public.restaurants FOR DELETE
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 4) communication_logs: any reseller manages all
DROP POLICY IF EXISTS "Resellers can delete communication logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Resellers can insert communication logs" ON public.communication_logs;

CREATE POLICY "Resellers can insert communication logs"
ON public.communication_logs FOR INSERT
WITH CHECK (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can delete communication logs"
ON public.communication_logs FOR DELETE
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 5) landing_page_leads: any reseller can read/update all
DROP POLICY IF EXISTS "Leads readable by owner reseller" ON public.landing_page_leads;
DROP POLICY IF EXISTS "Resellers can update their own leads" ON public.landing_page_leads;

CREATE POLICY "Leads readable by resellers"
ON public.landing_page_leads FOR SELECT
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can update leads"
ON public.landing_page_leads FOR UPDATE
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 6) reseller_evolution_config: any reseller manages all
DROP POLICY IF EXISTS "Reseller can delete own evolution config" ON public.reseller_evolution_config;
DROP POLICY IF EXISTS "Reseller can insert own evolution config" ON public.reseller_evolution_config;
DROP POLICY IF EXISTS "Reseller can update own evolution config" ON public.reseller_evolution_config;

CREATE POLICY "Resellers can view evolution config"
ON public.reseller_evolution_config FOR SELECT
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can insert evolution config"
ON public.reseller_evolution_config FOR INSERT
WITH CHECK (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can update evolution config"
ON public.reseller_evolution_config FOR UPDATE
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Resellers can delete evolution config"
ON public.reseller_evolution_config FOR DELETE
USING (public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 7) resellers: every reseller can view all resellers (read-only). Updates still scoped to owner.
DROP POLICY IF EXISTS "Reseller owner can view own data" ON public.resellers;

CREATE POLICY "Resellers can view all resellers"
ON public.resellers FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_reseller(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
