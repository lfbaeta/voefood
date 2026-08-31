-- 1) Replace SECURITY DEFINER view with a security_invoker view backed by a
--    narrow SECURITY DEFINER function that only exposes non-sensitive columns.
CREATE OR REPLACE FUNCTION public.list_public_restaurants()
RETURNS TABLE (id uuid, name text, slug text, is_active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.name, r.slug, r.is_active
  FROM public.restaurants r
  WHERE r.is_active = true;
$$;

REVOKE ALL ON FUNCTION public.list_public_restaurants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_restaurants() TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.restaurants_public;
CREATE VIEW public.restaurants_public
WITH (security_invoker = on)
AS SELECT id, name, slug, is_active FROM public.list_public_restaurants();

GRANT SELECT ON public.restaurants_public TO anon, authenticated, service_role;

-- 2) Storage: scope product-images / store-assets writes to the tenant folder
DROP POLICY IF EXISTS "Restaurant admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can update store assets" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can delete store assets" ON storage.objects;
DROP POLICY IF EXISTS "Resellers and Admins can upload landing logos" ON storage.objects;
DROP POLICY IF EXISTS "Resellers and Admins can update landing logos" ON storage.objects;
DROP POLICY IF EXISTS "Resellers and Admins can delete landing logos" ON storage.objects;

CREATE OR REPLACE FUNCTION public.storage_tenant_write_allowed(_uid uuid, _name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seg text := split_part(_name, '/', 1);
  seg2 text := split_part(_name, '/', 2);
  rid uuid;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF public.has_role(_uid, 'admin'::app_role) THEN RETURN true; END IF;

  -- landing-logos/<reseller_id>/...
  IF seg = 'landing-logos' THEN
    RETURN seg2 ~ '^[0-9a-fA-F-]{36}$'
       AND EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = seg2::uuid AND r.user_id = _uid);
  END IF;

  -- <restaurant_id>/...
  IF seg ~ '^[0-9a-fA-F-]{36}$' THEN
    rid := seg::uuid;
    RETURN public.is_admin_of_restaurant(_uid, rid) OR public.is_reseller_of_restaurant(_uid, rid);
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_tenant_write_allowed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_tenant_write_allowed(uuid, text) TO authenticated, service_role;

CREATE POLICY "Tenant scoped image upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('product-images','store-assets')
  AND public.storage_tenant_write_allowed(auth.uid(), name));

CREATE POLICY "Tenant scoped image update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('product-images','store-assets')
  AND public.storage_tenant_write_allowed(auth.uid(), name))
WITH CHECK (bucket_id IN ('product-images','store-assets')
  AND public.storage_tenant_write_allowed(auth.uid(), name));

CREATE POLICY "Tenant scoped image delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('product-images','store-assets')
  AND public.storage_tenant_write_allowed(auth.uid(), name));