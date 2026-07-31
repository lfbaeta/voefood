
-- Drop the overly permissive USING(true) SELECT policy on table_orders
DROP POLICY IF EXISTS "Table orders readable by anyone with table context" ON public.table_orders;

-- Create secure RPCs for anonymous (waiter) access to table_orders

-- RPC: Get open table orders for a restaurant (used by waiter dashboard)
CREATE OR REPLACE FUNCTION public.get_open_table_orders(p_restaurant_id uuid)
RETURNS SETOF public.table_orders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.table_orders
  WHERE restaurant_id = p_restaurant_id
    AND status IN ('open', 'requesting_bill')
  ORDER BY opened_at DESC;
$$;

-- RPC: Get a single table order by ID (used by TableOrderScreen)
CREATE OR REPLACE FUNCTION public.get_table_order_by_id(p_order_id bigint)
RETURNS SETOF public.table_orders
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.table_orders
  WHERE id = p_order_id
  LIMIT 1;
$$;
