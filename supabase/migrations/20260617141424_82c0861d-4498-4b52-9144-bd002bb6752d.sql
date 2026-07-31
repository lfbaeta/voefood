
ALTER TABLE public.restaurant_payment_gateways
  DROP COLUMN IF EXISTS credentials_cipher,
  ADD COLUMN IF NOT EXISTS credentials jsonb NOT NULL DEFAULT '{}'::jsonb;
