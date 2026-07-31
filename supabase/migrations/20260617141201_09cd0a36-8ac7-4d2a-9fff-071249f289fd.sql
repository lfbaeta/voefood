
-- Tabela de gateways de pagamento por restaurante
CREATE TABLE IF NOT EXISTS public.restaurant_payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('mercado_pago','asaas')),
  is_enabled boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox','production')),
  accepts_pix boolean NOT NULL DEFAULT true,
  accepts_credit_card boolean NOT NULL DEFAULT true,
  credentials_cipher text,
  public_key text,
  display_name text,
  last_test_at timestamptz,
  last_test_ok boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_payment_gateways TO authenticated;
GRANT ALL ON public.restaurant_payment_gateways TO service_role;

ALTER TABLE public.restaurant_payment_gateways ENABLE ROW LEVEL SECURITY;

-- Admins do restaurante podem ler/escrever metadados (cipher é filtrado via RPC/edge function)
CREATE POLICY "Admins manage own restaurant gateways"
ON public.restaurant_payment_gateways FOR ALL
TO authenticated
USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id))
WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_rpg_updated_at
BEFORE UPDATE ON public.restaurant_payment_gateways
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colunas em orders para pagamento online
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded','cancelled','expired')),
  ADD COLUMN IF NOT EXISTS payment_provider text CHECK (payment_provider IN ('mercado_pago','asaas')),
  ADD COLUMN IF NOT EXISTS payment_provider_id text,
  ADD COLUMN IF NOT EXISTS payment_method_online text CHECK (payment_method_online IN ('pix','credit_card')),
  ADD COLUMN IF NOT EXISTS payment_pix_qr_code text,
  ADD COLUMN IF NOT EXISTS payment_pix_qr_code_base64 text,
  ADD COLUMN IF NOT EXISTS payment_pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider_id ON public.orders(payment_provider, payment_provider_id);

-- RPC pública: retorna métodos online habilitados + public_key (sem cipher)
CREATE OR REPLACE FUNCTION public.get_restaurant_payment_methods(p_restaurant_id uuid)
RETURNS TABLE (
  provider text,
  accepts_pix boolean,
  accepts_credit_card boolean,
  public_key text,
  environment text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rpg.provider, rpg.accepts_pix, rpg.accepts_credit_card, rpg.public_key, rpg.environment
  FROM public.restaurant_payment_gateways rpg
  WHERE rpg.restaurant_id = p_restaurant_id AND rpg.is_enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_payment_methods(uuid) TO anon, authenticated;

-- RPC pública: status de pagamento de um pedido (somente campos seguros)
CREATE OR REPLACE FUNCTION public.get_order_payment_status(p_order_id bigint)
RETURNS TABLE (
  id bigint,
  payment_status text,
  payment_provider text,
  payment_method_online text,
  payment_pix_qr_code text,
  payment_pix_qr_code_base64 text,
  payment_pix_expires_at timestamptz,
  total_amount numeric,
  status text,
  restaurant_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.payment_status, o.payment_provider, o.payment_method_online,
         o.payment_pix_qr_code, o.payment_pix_qr_code_base64, o.payment_pix_expires_at,
         o.total_amount, o.status, o.restaurant_id
  FROM public.orders o
  WHERE o.id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_payment_status(bigint) TO anon, authenticated;
