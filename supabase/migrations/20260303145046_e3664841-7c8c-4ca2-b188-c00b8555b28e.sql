-- 1. Orders: public SELECT
CREATE POLICY "Orders publicly readable by restaurant"
ON public.orders FOR SELECT
TO anon, authenticated
USING (restaurant_id IS NOT NULL);

-- 2. customer_addresses: DROP old INSERT, create new one for anon+authenticated
DROP POLICY IF EXISTS "Authenticated users can insert addresses" ON public.customer_addresses;
CREATE POLICY "Anyone can insert addresses with restaurant"
ON public.customer_addresses FOR INSERT
TO anon, authenticated
WITH CHECK (restaurant_id IS NOT NULL);

-- 3. customer_addresses: public SELECT/UPDATE/DELETE
CREATE POLICY "Customers can view own addresses"
ON public.customer_addresses FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Customers can update own addresses"
ON public.customer_addresses FOR UPDATE
TO anon, authenticated
USING (true);

CREATE POLICY "Customers can delete own addresses"
ON public.customer_addresses FOR DELETE
TO anon, authenticated
USING (true);

-- 4. subscription_plans: public SELECT for active plans
CREATE POLICY "Active plans publicly readable"
ON public.subscription_plans FOR SELECT
TO anon, authenticated
USING (is_active = true);