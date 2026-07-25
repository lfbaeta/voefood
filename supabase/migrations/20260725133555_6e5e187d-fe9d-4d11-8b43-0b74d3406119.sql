DROP POLICY IF EXISTS "Restaurant admins can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can update store assets" ON storage.objects;
DROP POLICY IF EXISTS "Restaurant admins can delete store assets" ON storage.objects;

CREATE POLICY "Authorized users can upload store assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_restaurant_admin(auth.uid())
    OR (
      name LIKE 'landing-logos/%'
      AND EXISTS (
        SELECT 1
        FROM public.resellers r
        WHERE r.user_id = auth.uid()
          AND r.is_active = true
          AND name LIKE ('landing-logos/' || r.id::text || '-%')
      )
    )
  )
);

CREATE POLICY "Authorized users can update store assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_restaurant_admin(auth.uid())
    OR (
      name LIKE 'landing-logos/%'
      AND EXISTS (
        SELECT 1
        FROM public.resellers r
        WHERE r.user_id = auth.uid()
          AND r.is_active = true
          AND name LIKE ('landing-logos/' || r.id::text || '-%')
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'store-assets'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_restaurant_admin(auth.uid())
    OR (
      name LIKE 'landing-logos/%'
      AND EXISTS (
        SELECT 1
        FROM public.resellers r
        WHERE r.user_id = auth.uid()
          AND r.is_active = true
          AND name LIKE ('landing-logos/' || r.id::text || '-%')
      )
    )
  )
);

CREATE POLICY "Authorized users can delete store assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'store-assets'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_restaurant_admin(auth.uid())
    OR (
      name LIKE 'landing-logos/%'
      AND EXISTS (
        SELECT 1
        FROM public.resellers r
        WHERE r.user_id = auth.uid()
          AND r.is_active = true
          AND name LIKE ('landing-logos/' || r.id::text || '-%')
      )
    )
  )
);