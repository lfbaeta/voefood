
-- 1. Products: unit_of_sale and weight variation flag
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit_of_sale text NOT NULL DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS allow_weight_variation boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_unit_of_sale_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_unit_of_sale_check
  CHECK (unit_of_sale IN ('un','kg','g','L','ml'));

-- 2. Order items: weight tracking fields
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_of_sale text NOT NULL DEFAULT 'un',
  ADD COLUMN IF NOT EXISTS quantity_grams numeric,
  ADD COLUMN IF NOT EXISTS final_quantity_grams numeric,
  ADD COLUMN IF NOT EXISTS final_unit_price numeric,
  ADD COLUMN IF NOT EXISTS weight_status text NOT NULL DEFAULT 'fixed';

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_unit_of_sale_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_unit_of_sale_check
  CHECK (unit_of_sale IN ('un','kg','g','L','ml'));

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_weight_status_check;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_weight_status_check
  CHECK (weight_status IN ('fixed','pending','confirmed'));

-- 3. RPC: adjust order item weight (admin only)
CREATE OR REPLACE FUNCTION public.adjust_order_item_weight(
  p_item_id uuid,
  p_final_grams numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_order_id bigint;
  v_estimated_grams numeric;
  v_unit_price numeric;
  v_quantity int;
  v_new_unit_price numeric;
  v_new_item_total numeric;
  v_items_sum numeric;
  v_delivery_fee numeric;
BEGIN
  IF p_final_grams IS NULL OR p_final_grams <= 0 THEN
    RAISE EXCEPTION 'invalid final weight';
  END IF;

  SELECT oi.order_id, oi.quantity_grams, oi.unit_price, oi.quantity, o.restaurant_id
    INTO v_order_id, v_estimated_grams, v_unit_price, v_quantity, v_restaurant_id
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = p_item_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'order item not found';
  END IF;

  IF NOT public.is_admin_of_restaurant(auth.uid(), v_restaurant_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_estimated_grams IS NULL OR v_estimated_grams <= 0 THEN
    RAISE EXCEPTION 'item is not sold by weight';
  END IF;

  -- unit_price is the price for v_estimated_grams (per the original line)
  -- so new line price = unit_price * (final_grams / estimated_grams)
  v_new_unit_price := round( (v_unit_price * (p_final_grams / v_estimated_grams))::numeric, 2);
  v_new_item_total := v_new_unit_price * v_quantity;

  UPDATE public.order_items
  SET final_quantity_grams = p_final_grams,
      final_unit_price = v_new_unit_price,
      weight_status = 'confirmed'
  WHERE id = p_item_id;

  -- recalc order total
  SELECT COALESCE(SUM(
    CASE WHEN weight_status = 'confirmed' AND final_unit_price IS NOT NULL
      THEN final_unit_price * quantity
      ELSE unit_price * quantity
    END
  ),0)
  INTO v_items_sum
  FROM public.order_items
  WHERE order_id = v_order_id;

  SELECT COALESCE(delivery_fee,0) INTO v_delivery_fee
  FROM public.orders WHERE id = v_order_id;

  UPDATE public.orders
  SET total_amount = v_items_sum + COALESCE(v_delivery_fee,0)
  WHERE id = v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_order_item_weight(uuid, numeric) TO authenticated;

-- 4. Update create_customer_order to accept unit_of_sale + quantity_grams
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
  p_items jsonb
) RETURNS bigint
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
    total_amount, payment_method, change_for, status
  ) VALUES (
    p_restaurant_id, p_customer_name, p_customer_phone,
    COALESCE(p_address_street,''), COALESCE(p_address_number,''), COALESCE(p_address_neighborhood,''),
    p_address_complement, p_address_reference,
    p_total_amount, p_payment_method, p_change_for, 'pending'
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_unit_of_sale := COALESCE(NULLIF(v_item->>'unit_of_sale',''), 'un');
    v_quantity_grams := NULLIF(v_item->>'quantity_grams','')::numeric;
    v_weight_status := CASE WHEN v_unit_of_sale IN ('kg','g','L','ml') AND v_quantity_grams IS NOT NULL
                            THEN 'pending' ELSE 'fixed' END;

    INSERT INTO public.order_items (
      order_id, product_name, quantity, unit_price, observation,
      unit_of_sale, quantity_grams, weight_status
    ) VALUES (
      v_order_id,
      v_item->>'product_name',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      NULLIF(v_item->>'observation',''),
      v_unit_of_sale,
      v_quantity_grams,
      v_weight_status
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;
