-- 1) cash_sessions
CREATE TABLE public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
  opening_notes text,
  closed_by uuid,
  closed_at timestamptz,
  counted_amounts jsonb, -- { "money": 100.00, "pix": 50.00, ... } informado pelo operador
  expected_amounts jsonb, -- { "money": 105.50, ... } calculado pelo sistema
  difference numeric(12,2), -- (counted total) - (expected total)
  closing_notes text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Apenas 1 caixa aberto por restaurante ao mesmo tempo
CREATE UNIQUE INDEX cash_sessions_one_open_per_restaurant
  ON public.cash_sessions(restaurant_id)
  WHERE status = 'open';

CREATE INDEX idx_cash_sessions_restaurant_opened
  ON public.cash_sessions(restaurant_id, opened_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cash sessions of their restaurant"
  ON public.cash_sessions FOR SELECT
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Admins can open cash sessions"
  ON public.cash_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    AND opened_by = auth.uid()
  );

CREATE POLICY "Admins can update cash sessions (close)"
  ON public.cash_sessions FOR UPDATE
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Admins can delete cash sessions"
  ON public.cash_sessions FOR DELETE
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE TRIGGER trg_cash_sessions_updated
  BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) cash_movements
CREATE TABLE public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sangria','reforco','despesa','recebimento')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_movements_session ON public.cash_movements(session_id, created_at DESC);
CREATE INDEX idx_cash_movements_restaurant ON public.cash_movements(restaurant_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view cash movements of their restaurant"
  ON public.cash_movements FOR SELECT
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Admins can insert cash movements"
  ON public.cash_movements FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.cash_sessions cs
      WHERE cs.id = session_id
        AND cs.restaurant_id = cash_movements.restaurant_id
        AND cs.status = 'open'
    )
  );

CREATE POLICY "Admins can delete cash movements"
  ON public.cash_movements FOR DELETE
  TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

-- 3) Helper: caixa aberto atual
CREATE OR REPLACE FUNCTION public.get_open_cash_session(p_restaurant_id uuid)
RETURNS SETOF public.cash_sessions
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.cash_sessions
  WHERE restaurant_id = p_restaurant_id
    AND status = 'open'
  ORDER BY opened_at DESC
  LIMIT 1;
$$;

-- 4) Resumo do caixa (para fechamento / Z-report)
-- Devolve totais por forma de pagamento somando delivery (orders) + PDV (table_orders)
-- no intervalo [opened_at, closed_at ?? now()], e o total líquido de movimentações manuais.
CREATE OR REPLACE FUNCTION public.get_cash_session_summary(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.cash_sessions%ROWTYPE;
  v_end timestamptz;
  v_sales jsonb;
  v_movements jsonb;
  v_totals jsonb;
BEGIN
  SELECT * INTO v_session FROM public.cash_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;

  IF NOT public.is_admin_of_restaurant(auth.uid(), v_session.restaurant_id) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  v_end := COALESCE(v_session.closed_at, now());

  -- Vendas por forma de pagamento (normalizado)
  WITH combined AS (
    SELECT
      LOWER(COALESCE(NULLIF(TRIM(o.payment_method), ''), 'outros')) AS method,
      COALESCE(o.total_amount, 0) AS amount
    FROM public.orders o
    WHERE o.restaurant_id = v_session.restaurant_id
      AND o.status = 'completed'
      AND o.created_at >= v_session.opened_at
      AND o.created_at <= v_end
    UNION ALL
    SELECT
      LOWER(COALESCE(NULLIF(TRIM(t.payment_method), ''), 'outros')) AS method,
      COALESCE(t.total_amount, 0) AS amount
    FROM public.table_orders t
    WHERE t.restaurant_id = v_session.restaurant_id
      AND t.status = 'paid'
      AND COALESCE(t.closed_at, t.opened_at) >= v_session.opened_at
      AND COALESCE(t.closed_at, t.opened_at) <= v_end
  )
  SELECT COALESCE(jsonb_object_agg(method, total), '{}'::jsonb)
  INTO v_sales
  FROM (
    SELECT method, ROUND(SUM(amount)::numeric, 2) AS total
    FROM combined
    GROUP BY method
  ) x;

  -- Movimentações agregadas
  WITH agg AS (
    SELECT type, SUM(amount) AS total
    FROM public.cash_movements
    WHERE session_id = p_session_id
    GROUP BY type
  )
  SELECT COALESCE(jsonb_object_agg(type, total), '{}'::jsonb)
  INTO v_movements
  FROM agg;

  -- Totais
  v_totals := jsonb_build_object(
    'opening_amount', v_session.opening_amount,
    'sales_by_method', v_sales,
    'movements', v_movements,
    'sales_total', (SELECT COALESCE(SUM((value)::numeric),0) FROM jsonb_each_text(v_sales)),
    'reforco_total', COALESCE((v_movements->>'reforco')::numeric, 0),
    'sangria_total', COALESCE((v_movements->>'sangria')::numeric, 0),
    'despesa_total', COALESCE((v_movements->>'despesa')::numeric, 0),
    'recebimento_total', COALESCE((v_movements->>'recebimento')::numeric, 0),
    'session_id', v_session.id,
    'opened_at', v_session.opened_at,
    'end_at', v_end,
    'status', v_session.status
  );

  RETURN v_totals;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_open_cash_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_session_summary(uuid) TO authenticated;