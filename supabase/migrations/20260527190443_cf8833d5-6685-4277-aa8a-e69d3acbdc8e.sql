
-- Storage bucket for WhatsApp media uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wa-media',
  'wa-media',
  true,
  104857600, -- 100 MB
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- Public read (media URLs are shared with WhatsApp)
CREATE POLICY "wa-media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'wa-media');

-- Authenticated users can upload (edge function does the authorization)
CREATE POLICY "wa-media auth upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wa-media');

-- Authenticated users can update/delete own paths (path starts with restaurant_id)
CREATE POLICY "wa-media auth update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'wa-media');

CREATE POLICY "wa-media auth delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'wa-media');
