CREATE OR REPLACE FUNCTION public.is_store_accepting_orders(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_open boolean;
  v_tz text;
  v_now timestamp;
  v_dow int;
  v_time time;
  v_has_hours boolean;
  v_within boolean := false;
BEGIN
  IF p_restaurant_id IS NULL THEN RETURN false; END IF;

  SELECT COALESCE(sc.is_open, false), COALESCE(NULLIF(sc.timezone,''), 'America/Sao_Paulo')
  INTO v_is_open, v_tz
  FROM public.store_config sc
  WHERE sc.restaurant_id = p_restaurant_id
  LIMIT 1;

  IF v_is_open IS NULL OR v_is_open = false THEN
    RETURN false;
  END IF;

  v_now := (now() AT TIME ZONE v_tz);
  v_dow := EXTRACT(DOW FROM v_now)::int;
  v_time := v_now::time;

  SELECT EXISTS (SELECT 1 FROM public.business_hours bh WHERE bh.restaurant_id = p_restaurant_id)
  INTO v_has_hours;

  IF NOT v_has_hours THEN
    RETURN true;
  END IF;

  -- Faixa normal no dia atual
  SELECT EXISTS (
    SELECT 1 FROM public.business_hours bh
    WHERE bh.restaurant_id = p_restaurant_id
      AND bh.is_active = true
      AND bh.day_of_week = v_dow
      AND bh.open_time IS NOT NULL AND bh.close_time IS NOT NULL
      AND (
        (bh.close_time > bh.open_time AND v_time >= bh.open_time AND v_time < bh.close_time)
        OR (bh.close_time <= bh.open_time AND v_time >= bh.open_time)
      )
  ) INTO v_within;

  IF v_within THEN RETURN true; END IF;

  -- Faixa que virou a madrugada (abriu ontem e fecha hoje)
  SELECT EXISTS (
    SELECT 1 FROM public.business_hours bh
    WHERE bh.restaurant_id = p_restaurant_id
      AND bh.is_active = true
      AND bh.day_of_week = ((v_dow + 6) % 7)
      AND bh.open_time IS NOT NULL AND bh.close_time IS NOT NULL
      AND bh.close_time <= bh.open_time
      AND v_time < bh.close_time
  ) INTO v_within;

  RETURN v_within;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_store_accepting_orders(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_customer_order(p_restaurant_id uuid, p_customer_name text, p_customer_phone text, p_address_street text, p_address_number text, p_address_neighborhood text, p_address_complement text, p_address_reference text, p_total_amount numeric, p_payment_method text, p_change_for numeric, p_items jsonb, p_convenience_fee numeric DEFAULT 0)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
  IF NOT public.is_store_accepting_orders(p_restaurant_id) THEN
    RAISE EXCEPTION 'store_closed';
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
    p_total_amount, p_payment_method, p_change_for, 'pending', COALESCE(p_convenience_fee, 0)
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
      CASE WHEN v_item ? 'pizza_flavors' THEN v_item->'pizza_flavors' ELSE NULL END,
      CASE WHEN v_item ? 'pizza_border' THEN v_item->'pizza_border' ELSE NULL END,
      CASE WHEN v_item ? 'addons_snapshot' THEN v_item->'addons_snapshot' ELSE NULL END
    );
  END LOOP;

  RETURN v_order_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.create_customer_order(uuid, text, text, text, text, text, text, text, numeric, text, numeric, jsonb);