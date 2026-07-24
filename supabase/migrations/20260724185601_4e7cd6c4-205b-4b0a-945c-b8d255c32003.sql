
CREATE OR REPLACE FUNCTION public.search_customer_orders(
  p_restaurant_id uuid,
  p_phone_digits text
)
RETURNS TABLE (
  id bigint,
  status text,
  total_amount numeric,
  created_at timestamptz,
  payment_method text,
  customer_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.status, o.total_amount, o.created_at, o.payment_method, o.customer_phone
  FROM public.orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND length(regexp_replace(coalesce(p_phone_digits,''), '\D', '', 'g')) >= 8
    AND regexp_replace(coalesce(o.customer_phone,''), '\D', '', 'g')
        LIKE '%' || right(regexp_replace(p_phone_digits, '\D', '', 'g'), 8) || '%'
  ORDER BY o.created_at DESC
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_customer_orders(uuid, text) TO anon, authenticated;
