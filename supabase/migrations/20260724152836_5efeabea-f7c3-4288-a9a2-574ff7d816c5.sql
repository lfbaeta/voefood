
-- 1) Colunas no subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS convenience_fee_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS convenience_fee_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convenience_fee_fixed numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convenience_fee_label text NOT NULL DEFAULT 'Taxa de conveniência',
  ADD COLUMN IF NOT EXISTS convenience_fee_description text NOT NULL DEFAULT 'Taxa cobrada pelo processamento do pagamento online (PIX/Cartão).';

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_convenience_fee_type_check;
ALTER TABLE public.subscription_plans
  ADD CONSTRAINT subscription_plans_convenience_fee_type_check
  CHECK (convenience_fee_type IN ('none','percent','fixed','percent_plus_fixed'));

-- 2) Coluna no orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS convenience_fee numeric NOT NULL DEFAULT 0;

-- 3) RPC pública para calcular a taxa aplicável ao restaurante
CREATE OR REPLACE FUNCTION public.get_restaurant_convenience_fee(
  p_restaurant_id uuid,
  p_subtotal numeric DEFAULT 0
)
RETURNS TABLE (
  fee_type text,
  fee_percent numeric,
  fee_fixed numeric,
  fee_amount numeric,
  label text,
  description text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_type text;
  v_pct numeric;
  v_fix numeric;
  v_label text;
  v_desc text;
  v_amount numeric := 0;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RETURN;
  END IF;

  SELECT r.plan_id INTO v_plan_id
  FROM public.restaurants r
  WHERE r.id = p_restaurant_id;

  IF v_plan_id IS NULL THEN
    RETURN QUERY SELECT 'none'::text, 0::numeric, 0::numeric, 0::numeric,
                        'Taxa de conveniência'::text,
                        ''::text;
    RETURN;
  END IF;

  SELECT
    COALESCE(sp.convenience_fee_type, 'none'),
    COALESCE(sp.convenience_fee_percent, 0),
    COALESCE(sp.convenience_fee_fixed, 0),
    COALESCE(NULLIF(sp.convenience_fee_label, ''), 'Taxa de conveniência'),
    COALESCE(sp.convenience_fee_description, '')
  INTO v_type, v_pct, v_fix, v_label, v_desc
  FROM public.subscription_plans sp
  WHERE sp.id = v_plan_id;

  IF v_type = 'percent' THEN
    v_amount := round((COALESCE(p_subtotal,0) * v_pct / 100.0)::numeric, 2);
  ELSIF v_type = 'fixed' THEN
    v_amount := round(v_fix::numeric, 2);
  ELSIF v_type = 'percent_plus_fixed' THEN
    v_amount := round((COALESCE(p_subtotal,0) * v_pct / 100.0 + v_fix)::numeric, 2);
  ELSE
    v_amount := 0;
  END IF;

  IF v_amount < 0 THEN v_amount := 0; END IF;

  RETURN QUERY SELECT COALESCE(v_type,'none'), COALESCE(v_pct,0), COALESCE(v_fix,0),
                      v_amount, COALESCE(v_label,'Taxa de conveniência'), COALESCE(v_desc,'');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_restaurant_convenience_fee(uuid, numeric) TO anon, authenticated;

-- 4) Atualiza create_customer_order para aceitar convenience_fee
CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_address_street text,
  p_address_number text,
  p_address_neighborhood text,
  p_address_complement text,
  p_address_reference text,
  p_total_amount numeric,
  p_payment_method text,
  p_change_for numeric,
  p_items jsonb,
  p_convenience_fee numeric DEFAULT 0
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id bigint;
  v_item jsonb;
  v_unit_of_sale text;
  v_quantity_grams numeric;
  v_weight_status text;
  v_product_id uuid;
BEGIN
  IF p_restaurant_id IS NULL THEN RAISE EXCEPTION 'restaurant_id required'; END IF;
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) = 0 THEN RAISE EXCEPTION 'customer_name required'; END IF;
  IF p_customer_phone IS NULL OR length(regexp_replace(p_customer_phone,'[^0-9]','','g')) < 8 THEN RAISE EXCEPTION 'invalid customer_phone'; END IF;
  IF p_total_amount IS NULL OR p_total_amount < 0 THEN RAISE EXCEPTION 'invalid total_amount'; END IF;
  IF p_payment_method IS NULL THEN RAISE EXCEPTION 'payment_method required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = p_restaurant_id AND is_active = true) THEN
    RAISE EXCEPTION 'restaurant not found';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'items required';
  END IF;

  INSERT INTO public.orders (
    restaurant_id, customer_name, customer_phone,
    address_street, address_number, address_neighborhood,
    address_complement, address_reference,
    total_amount, payment_method, change_for, status, convenience_fee
  ) VALUES (
    p_restaurant_id, p_customer_name, p_customer_phone,
    COALESCE(p_address_street,''), COALESCE(p_address_number,''), COALESCE(p_address_neighborhood,''),
    p_address_complement, p_address_reference,
    p_total_amount, p_payment_method, p_change_for, 'pending',
    GREATEST(COALESCE(p_convenience_fee,0), 0)
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_unit_of_sale := COALESCE(NULLIF(v_item->>'unit_of_sale',''), 'un');
    v_quantity_grams := NULLIF(v_item->>'quantity_grams','')::numeric;
    v_weight_status := CASE WHEN v_unit_of_sale IN ('kg','g','L','ml') AND v_quantity_grams IS NOT NULL
                            THEN 'pending' ELSE 'fixed' END;
    v_product_id := NULLIF(v_item->>'product_id','')::uuid;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price, observation,
      unit_of_sale, quantity_grams, weight_status,
      pizza_flavors, pizza_border, addons_snapshot
    ) VALUES (
      v_order_id,
      v_product_id,
      v_item->>'product_name',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      NULLIF(v_item->>'observation',''),
      v_unit_of_sale,
      v_quantity_grams,
      v_weight_status,
      CASE WHEN v_item ? 'pizza_flavors' AND jsonb_typeof(v_item->'pizza_flavors') = 'array'
           THEN v_item->'pizza_flavors' ELSE NULL END,
      CASE WHEN v_item ? 'pizza_border' AND jsonb_typeof(v_item->'pizza_border') = 'object'
           THEN v_item->'pizza_border' ELSE NULL END,
      CASE WHEN v_item ? 'addons_snapshot' AND jsonb_typeof(v_item->'addons_snapshot') = 'array'
           THEN v_item->'addons_snapshot' ELSE NULL END
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid, text, text, text, text, text, text, text, numeric, text, numeric, jsonb, numeric) TO anon, authenticated;
