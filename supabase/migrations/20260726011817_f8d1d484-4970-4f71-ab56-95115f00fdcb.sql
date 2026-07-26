DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can update tables" ON public.tables;
CREATE POLICY "Admins, restaurant admins and resellers can update tables"
ON public.tables FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can delete tables" ON public.tables;
CREATE POLICY "Admins, restaurant admins and resellers can delete tables"
ON public.tables FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can insert tables" ON public.tables;
CREATE POLICY "Admins, restaurant admins and resellers can insert tables"
ON public.tables FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can update orders" ON public.orders;
CREATE POLICY "Admins, restaurant admins and resellers can update orders"
ON public.orders FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));

DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can delete orders" ON public.orders;
CREATE POLICY "Admins, restaurant admins and resellers can delete orders"
ON public.orders FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_admin_of_restaurant(auth.uid(), restaurant_id) OR is_reseller_of_restaurant(auth.uid(), restaurant_id));