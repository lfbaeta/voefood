
DROP POLICY IF EXISTS "wa-media public read" ON storage.objects;
DROP POLICY IF EXISTS "wa-media auth upload" ON storage.objects;
DROP POLICY IF EXISTS "wa-media auth update" ON storage.objects;
DROP POLICY IF EXISTS "wa-media auth delete" ON storage.objects;
DROP POLICY IF EXISTS "wa-media restaurant admins read" ON storage.objects;
DROP POLICY IF EXISTS "wa-media restaurant admins upload" ON storage.objects;
DROP POLICY IF EXISTS "wa-media restaurant admins update" ON storage.objects;
DROP POLICY IF EXISTS "wa-media restaurant admins delete" ON storage.objects;

CREATE POLICY "wa-media restaurant admins read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'wa-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_admin_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_reseller_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY "wa-media restaurant admins upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wa-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_admin_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_reseller_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY "wa-media restaurant admins update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'wa-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_admin_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_reseller_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );

CREATE POLICY "wa-media restaurant admins delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wa-media'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_admin_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
      OR public.is_reseller_of_restaurant(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );
