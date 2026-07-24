
ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS contingency_mode text NOT NULL DEFAULT 'normal';

ALTER TABLE public.fiscal_config
  DROP CONSTRAINT IF EXISTS fiscal_config_contingency_mode_check;

ALTER TABLE public.fiscal_config
  ADD CONSTRAINT fiscal_config_contingency_mode_check
  CHECK (contingency_mode IN ('normal','svc_an','svc_rs','offline'));

CREATE TABLE IF NOT EXISTS public.fiscal_inutilizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  serie integer NOT NULL,
  numero_inicial integer NOT NULL,
  numero_final integer NOT NULL,
  justificativa text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  protocolo text,
  rejection_message text,
  raw_response jsonb,
  reference text NOT NULL UNIQUE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (numero_final >= numero_inicial),
  CHECK (char_length(justificativa) >= 15),
  CHECK (status IN ('processing','authorized','rejected','error'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_inutilizacoes TO authenticated;
GRANT ALL ON public.fiscal_inutilizacoes TO service_role;

ALTER TABLE public.fiscal_inutilizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view inutilizacoes"
  ON public.fiscal_inutilizacoes FOR SELECT
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Admins insert inutilizacoes"
  ON public.fiscal_inutilizacoes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_fiscal_inutilizacoes_updated
  BEFORE UPDATE ON public.fiscal_inutilizacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_fiscal_inutilizacoes_restaurant
  ON public.fiscal_inutilizacoes (restaurant_id, created_at DESC);
