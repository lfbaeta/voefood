-- Allow public read access to store-assets
CREATE POLICY "Public Read Access" ON storage.objects FOR SELECT USING (bucket_id = 'store-assets');

-- Allow resellers and super admins to upload logos to store-assets
CREATE POLICY "Resellers and Admins can upload landing logos" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'store-assets' AND (
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (SELECT 1 FROM public.resellers WHERE user_id = auth.uid())
  )
);

-- Allow resellers and super admins to update logos in store-assets
CREATE POLICY "Resellers and Admins can update landing logos" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
  bucket_id = 'store-assets' AND (
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (SELECT 1 FROM public.resellers WHERE user_id = auth.uid())
  )
);

-- Allow resellers and super admins to delete logos in store-assets
CREATE POLICY "Resellers and Admins can delete landing logos" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'store-assets' AND (
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (SELECT 1 FROM public.resellers WHERE user_id = auth.uid())
  )
);
