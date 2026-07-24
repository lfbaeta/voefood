
DROP POLICY IF EXISTS "Resellers can delete restaurant admins" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Resellers can insert restaurant admins" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Resellers can update restaurant admins" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Restaurant admins viewable by reseller or self" ON public.restaurant_admins;

CREATE POLICY "Restaurant admins viewable by reseller or self"
ON public.restaurant_admins FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Resellers can insert restaurant admins"
ON public.restaurant_admins FOR INSERT
WITH CHECK (
  public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Resellers can update restaurant admins"
ON public.restaurant_admins FOR UPDATE
USING (
  public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Resellers can delete restaurant admins"
ON public.restaurant_admins FOR DELETE
USING (
  public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
