
-- =============================================
-- FIX 1: Harden orders INSERT policy with validation
-- =============================================
DROP POLICY IF EXISTS "Anyone can create orders with restaurant_id" ON public.orders;
CREATE POLICY "Orders insertable with validation"
ON public.orders FOR INSERT
TO anon, authenticated
WITH CHECK (
  restaurant_id IS NOT NULL AND
  customer_name IS NOT NULL AND length(trim(customer_name)) > 0 AND length(trim(customer_name)) <= 200 AND
  customer_phone IS NOT NULL AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 10 AND
  address_street IS NOT NULL AND length(trim(address_street)) > 0 AND
  address_neighborhood IS NOT NULL AND length(trim(address_neighborhood)) > 0 AND
  address_number IS NOT NULL AND length(trim(address_number)) > 0 AND
  total_amount > 0 AND
  payment_method IS NOT NULL AND length(trim(payment_method)) > 0
);

-- =============================================
-- FIX 2: Harden order_items INSERT policy
-- =============================================
DROP POLICY IF EXISTS "Order items can be created with valid order" ON public.order_items;
CREATE POLICY "Order items insertable with validation"
ON public.order_items FOR INSERT
TO anon, authenticated
WITH CHECK (
  order_id IS NOT NULL AND
  product_name IS NOT NULL AND length(trim(product_name)) > 0 AND length(trim(product_name)) <= 200 AND
  quantity > 0 AND quantity <= 100 AND
  unit_price >= 0 AND
  (EXISTS (
    SELECT 1 FROM orders WHERE orders.id = order_items.order_id
  ))
);

-- =============================================
-- FIX 3: Fix reversed parameter order in RLS policies
-- =============================================

-- Fix orders SELECT policy
DROP POLICY IF EXISTS "Orders readable by restaurant admin" ON public.orders;
CREATE POLICY "Orders readable by restaurant admin"
ON public.orders FOR SELECT
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- Fix restaurants SELECT policy
DROP POLICY IF EXISTS "Restaurants viewable by owner reseller or admin" ON public.restaurants;
CREATE POLICY "Restaurants viewable by owner reseller or admin"
ON public.restaurants FOR SELECT
TO authenticated
USING (
  is_reseller_of_restaurant(auth.uid(), id)
  OR is_admin_of_restaurant(auth.uid(), id)
);

-- Fix table_orders SELECT policy
DROP POLICY IF EXISTS "Table orders viewable by restaurant admin" ON public.table_orders;
CREATE POLICY "Table orders viewable by restaurant admin"
ON public.table_orders FOR SELECT
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- Fix tables SELECT policy
DROP POLICY IF EXISTS "Tables viewable by restaurant admin" ON public.tables;
CREATE POLICY "Tables viewable by restaurant admin"
ON public.tables FOR SELECT
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- Fix customer_addresses SELECT policy
DROP POLICY IF EXISTS "Addresses viewable by restaurant admin" ON public.customer_addresses;
CREATE POLICY "Addresses viewable by restaurant admin"
ON public.customer_addresses FOR SELECT
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- Fix customer_addresses UPDATE policy
DROP POLICY IF EXISTS "Addresses updatable by restaurant admin" ON public.customer_addresses;
CREATE POLICY "Addresses updatable by restaurant admin"
ON public.customer_addresses FOR UPDATE
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
);

-- Fix customer_addresses DELETE policy
DROP POLICY IF EXISTS "Addresses deletable by restaurant admin" ON public.customer_addresses;
CREATE POLICY "Addresses deletable by restaurant admin"
ON public.customer_addresses FOR DELETE
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
);

-- Fix store_config SELECT policy
DROP POLICY IF EXISTS "Store config readable by admins" ON public.store_config;
CREATE POLICY "Store config readable by admins"
ON public.store_config FOR SELECT
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);
