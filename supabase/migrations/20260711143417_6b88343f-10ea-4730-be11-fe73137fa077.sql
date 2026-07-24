-- Fix login/role bootstrap policies after internal SECURITY DEFINER helpers were revoked.
-- These policies must not call has_role(), is_reseller(), is_admin_of_restaurant(),
-- or is_reseller_of_restaurant(), otherwise client reads fail before redirecting.

DROP POLICY IF EXISTS "Resellers can view own record" ON public.resellers;
DROP POLICY IF EXISTS "Only admins can insert resellers" ON public.resellers;
DROP POLICY IF EXISTS "Reseller owner can update own data" ON public.resellers;

CREATE POLICY "Resellers can view own record"
ON public.resellers
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Only admins can insert resellers"
ON public.resellers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Reseller owner can update own data"
ON public.resellers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Restaurant admins viewable by reseller or self" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Resellers can insert restaurant admins" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Resellers can update restaurant admins" ON public.restaurant_admins;
DROP POLICY IF EXISTS "Resellers can delete restaurant admins" ON public.restaurant_admins;

CREATE POLICY "Restaurant admins viewable by reseller or self"
ON public.restaurant_admins
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can insert restaurant admins"
ON public.restaurant_admins
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = restaurant_admins.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can update restaurant admins"
ON public.restaurant_admins
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = restaurant_admins.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = restaurant_admins.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can delete restaurant admins"
ON public.restaurant_admins
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = restaurant_admins.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

DROP POLICY IF EXISTS "Restaurants viewable by authorized users" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants viewable by owner reseller or admin" ON public.restaurants;
DROP POLICY IF EXISTS "Resellers can insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Resellers can update restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Resellers can delete restaurants" ON public.restaurants;

CREATE POLICY "Restaurants viewable by authorized users"
ON public.restaurants
FOR SELECT
TO public
USING (
  is_active = true
  OR EXISTS (
    SELECT 1
    FROM public.restaurant_admins ra
    WHERE ra.restaurant_id = restaurants.id
      AND ra.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = restaurants.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can insert restaurants"
ON public.restaurants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = restaurants.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can update restaurants"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = restaurants.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = restaurants.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can delete restaurants"
ON public.restaurants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = restaurants.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);