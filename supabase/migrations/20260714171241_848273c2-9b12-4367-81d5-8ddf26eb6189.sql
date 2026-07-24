
-- =========================================
-- fiscal_config
-- =========================================
CREATE TABLE public.fiscal_config (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'homologacao' CHECK (environment IN ('homologacao','producao')),

  cnpj text,
  ie text,
  im text,
  razao_social text,
  nome_fantasia text,
  regime_tributario text CHECK (regime_tributario IN ('simples_nacional','simples_nacional_excesso','regime_normal') OR regime_tributario IS NULL),

  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  municipio text,
  uf text,
  codigo_municipio text,

  csc_id text,
  csc_token_cipher text,
  serie integer NOT NULL DEFAULT 1,
  proxima_numeracao integer NOT NULL DEFAULT 1,

  default_ncm text DEFAULT '21069090',
  default_cfop text DEFAULT '5102',
  default_csosn text DEFAULT '102',
  default_origem text DEFAULT '0',
  default_cest text,

  aliquota_icms numeric(6,2) DEFAULT 0,
  aliquota_pis numeric(6,2) DEFAULT 0,
  aliquota_cofins numeric(6,2) DEFAULT 0,

  focus_company_registered boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_config TO authenticated;
GRANT ALL ON public.fiscal_config TO service_role;

ALTER TABLE public.fiscal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fiscal_config"
  ON public.fiscal_config FOR ALL
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_fiscal_config_updated
  BEFORE UPDATE ON public.fiscal_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- fiscal_invoices
-- =========================================
CREATE TABLE public.fiscal_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  order_id bigint REFERENCES public.orders(id) ON DELETE SET NULL,
  table_order_id bigint REFERENCES public.table_orders(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'nfce' CHECK (type IN ('nfce')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','authorized','rejected','cancelled','error')),

  numero integer,
  serie integer,
  chave_acesso text,
  protocolo text,

  data_emissao timestamptz,
  data_autorizacao timestamptz,
  data_cancelamento timestamptz,

  valor_total numeric(12,2),
  valor_produtos numeric(12,2),
  valor_desconto numeric(12,2),

  xml_url text,
  danfe_url text,
  qr_code_url text,

  customer_cpf text,
  customer_name text,
  payment_method text,

  rejection_message text,
  cancellation_reason text,

  raw_payload jsonb,
  raw_response jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_fiscal_invoices_restaurant_created ON public.fiscal_invoices(restaurant_id, created_at DESC);
CREATE INDEX idx_fiscal_invoices_chave ON public.fiscal_invoices(chave_acesso);
CREATE INDEX idx_fiscal_invoices_order ON public.fiscal_invoices(order_id);
CREATE INDEX idx_fiscal_invoices_table_order ON public.fiscal_invoices(table_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_invoices TO authenticated;
GRANT ALL ON public.fiscal_invoices TO service_role;

ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view invoices"
  ON public.fiscal_invoices FOR SELECT
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Admins insert invoices"
  ON public.fiscal_invoices FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Admins update invoices"
  ON public.fiscal_invoices FOR UPDATE
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_fiscal_invoices_updated
  BEFORE UPDATE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- fiscal_events (audit log)
-- =========================================
CREATE TABLE public.fiscal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.fiscal_invoices(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('create','webhook','cancel','reissue','download','register_company','check')),
  payload jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fiscal_events_invoice ON public.fiscal_events(invoice_id, created_at DESC);
CREATE INDEX idx_fiscal_events_restaurant ON public.fiscal_events(restaurant_id, created_at DESC);

GRANT SELECT, INSERT ON public.fiscal_events TO authenticated;
GRANT ALL ON public.fiscal_events TO service_role;

ALTER TABLE public.fiscal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view fiscal_events"
  ON public.fiscal_events FOR SELECT
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

-- =========================================
-- helper
-- =========================================
CREATE OR REPLACE FUNCTION public.has_fiscal_enabled(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_enabled FROM public.fiscal_config WHERE restaurant_id = _restaurant_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.has_fiscal_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_fiscal_enabled(uuid) TO authenticated, service_role;
