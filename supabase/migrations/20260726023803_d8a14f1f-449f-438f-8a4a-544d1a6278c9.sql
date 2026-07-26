DROP VIEW IF EXISTS public.restaurants_public;
CREATE VIEW public.restaurants_public AS
SELECT id, name, slug, is_active, plan_id, business_subtype, capabilities_override
FROM public.restaurants
WHERE is_active = true;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;

DROP POLICY IF EXISTS "Restaurants viewable by authorized users" ON public.restaurants;
CREATE POLICY "Restaurants viewable by authorized users"
ON public.restaurants FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM restaurant_admins ra WHERE ra.restaurant_id = restaurants.id AND ra.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM resellers r WHERE r.id = restaurants.reseller_id AND r.user_id = auth.uid() AND r.is_active = true)
  OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::app_role)
);

DROP POLICY IF EXISTS "Restaurant admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can delete product images" ON storage.objects;

CREATE POLICY "product-images scoped upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_admin_of_restaurant(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
    OR is_reseller_of_restaurant(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  )
);

CREATE POLICY "product-images scoped update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_admin_of_restaurant(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
    OR is_reseller_of_restaurant(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  )
);

CREATE POLICY "product-images scoped delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_admin_of_restaurant(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
    OR is_reseller_of_restaurant(auth.uid(), NULLIF(split_part(name, '/', 1), '')::uuid)
  )
);