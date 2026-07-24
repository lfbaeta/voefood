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
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id bigint;
  v_item jsonb;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id required';
  END IF;
  IF p_customer_name IS NULL OR length(trim(p_customer_name)) = 0 THEN
    RAISE EXCEPTION 'customer_name required';
  END IF;
  IF p_customer_phone IS NULL OR length(regexp_replace(p_customer_phone,'[^0-9]','','g')) < 8 THEN
    RAISE EXCEPTION 'invalid customer_phone';
  END IF;
  IF p_total_amount IS NULL OR p_total_amount < 0 THEN
    RAISE EXCEPTION 'invalid total_amount';
  END IF;
  IF p_payment_method IS NULL THEN
    RAISE EXCEPTION 'payment_method required';
  END IF;
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
    INSERT INTO public.order_items (order_id, product_name, quantity, unit_price, observation)
    VALUES (
      v_order_id,
      v_item->>'product_name',
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      NULLIF(v_item->>'observation','')
    );
  END LOOP;

  RETURN v_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid,text,text,text,text,text,text,text,numeric,text,numeric,jsonb) TO anon, authenticated;