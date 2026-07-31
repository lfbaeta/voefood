ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS certificado_cipher text,
  ADD COLUMN IF NOT EXISTS certificado_password_cipher text,
  ADD COLUMN IF NOT EXISTS certificado_filename text,
  ADD COLUMN IF NOT EXISTS certificado_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS certificado_expires_at timestamptz;