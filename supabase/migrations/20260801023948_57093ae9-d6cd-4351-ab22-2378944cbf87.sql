CREATE OR REPLACE FUNCTION public.is_store_accepting_orders(p_restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_open boolean;
BEGIN
  IF p_restaurant_id IS NULL THEN RETURN false; END IF;

  SELECT COALESCE(sc.is_open, false)
  INTO v_is_open
  FROM public.store_config sc
  WHERE sc.restaurant_id = p_restaurant_id
  LIMIT 1;

  RETURN COALESCE(v_is_open, false);
END;
$$;