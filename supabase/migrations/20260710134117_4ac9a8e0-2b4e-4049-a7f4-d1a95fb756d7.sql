DROP POLICY IF EXISTS "Admins read own enhanced images" ON storage.objects;
CREATE POLICY "Admins read own enhanced images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'enhanced-images'
    AND public.is_admin_of_restaurant(
      auth.uid(),
      (split_part(name, '/', 1))::uuid
    )
  );
