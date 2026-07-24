-- Remove anonymous UPDATE access from table_orders and table_order_items
-- This fixes the OPEN_ENDPOINTS vulnerability where anonymous users could modify orders

-- Drop the existing policies with anonymous access
DROP POLICY IF EXISTS "Waiters can update table orders" ON public.table_orders;
DROP POLICY IF EXISTS "Waiters can update table order items" ON public.table_order_items;

-- Create secure UPDATE policy for table_orders (no anonymous access)
CREATE POLICY "Admins and staff can update table orders"
ON public.table_orders FOR UPDATE
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create secure UPDATE policy for table_order_items (no anonymous access)
CREATE POLICY "Admins can update table order items"
ON public.table_order_items FOR UPDATE
USING (
  is_admin_of_table_order(auth.uid(), table_order_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create server-side kitchen PIN validation function
-- This replaces client-side PIN comparison with secure server-side validation
CREATE OR REPLACE FUNCTION public.validate_kitchen_pin(
  p_restaurant_id uuid,
  p_pin text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_config
    WHERE restaurant_id = p_restaurant_id
      AND kitchen_pin = p_pin
      AND kitchen_pin_enabled = true
  );
$$;

-- Grant execute to both anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.validate_kitchen_pin(uuid, text) TO anon, authenticated;