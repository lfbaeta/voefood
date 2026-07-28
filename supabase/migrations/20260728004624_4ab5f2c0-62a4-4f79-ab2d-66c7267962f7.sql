DROP POLICY IF EXISTS "Communication logs viewable by reseller" ON public.communication_logs;
DROP POLICY IF EXISTS "Resellers can insert communication logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Resellers can delete communication logs" ON public.communication_logs;

CREATE POLICY "Communication logs viewable by authorized users"
ON public.communication_logs FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

CREATE POLICY "Communication logs insertable by authorized users"
ON public.communication_logs FOR INSERT TO authenticated
WITH CHECK (
  restaurant_id IS NOT NULL AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
  )
);

CREATE POLICY "Communication logs deletable by authorized users"
ON public.communication_logs FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);