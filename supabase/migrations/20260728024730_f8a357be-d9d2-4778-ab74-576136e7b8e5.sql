DROP POLICY IF EXISTS "Authorized users can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can update store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can delete store assets" ON storage.objects;

CREATE OR REPLACE FUNCTION public.can_write_store_asset(_user_id uuid, _name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR (
      -- Arquivos na pasta do próprio estabelecimento: <restaurant_id>/arquivo
      (split_part(_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      AND (
        public.is_admin_of_restaurant(_user_id, split_part(_name, '/', 1)::uuid)
        OR public.is_reseller_of_restaurant(_user_id, split_part(_name, '/', 1)::uuid)
      )
    )
    OR (
      -- Logos de landing page do próprio revendedor
      _name LIKE 'landing-logos/%'
      AND EXISTS (
        SELECT 1 FROM public.resellers r
        WHERE r.user_id = _user_id
          AND r.is_active = true
          AND _name LIKE ('landing-logos/' || r.id::text || '-%')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_write_store_asset(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_store_asset(uuid, text) TO authenticated, service_role;

CREATE POLICY "Scoped upload of store assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND public.can_write_store_asset(auth.uid(), storage.objects.name)
);

CREATE POLICY "Scoped update of store assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND public.can_write_store_asset(auth.uid(), storage.objects.name)
)
WITH CHECK (
  bucket_id = 'store-assets'
  AND public.can_write_store_asset(auth.uid(), storage.objects.name)
);

CREATE POLICY "Scoped delete of store assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND public.can_write_store_asset(auth.uid(), storage.objects.name)
);