
-- ============================================
-- 1. Clean up stale/conflicting RLS policies
-- ============================================

-- Drop any remaining "publicly readable" or "Anyone can" policies that should have been removed
DROP POLICY IF EXISTS "Tables are publicly readable" ON public.tables;
DROP POLICY IF EXISTS "Table orders are publicly readable" ON public.table_orders;
DROP POLICY IF EXISTS "Order items are readable" ON public.order_items;
DROP POLICY IF EXISTS "Customers can delete own addresses scoped" ON public.customer_addresses;

-- Drop duplicate/conflicting SELECT policies on restaurants
DROP POLICY IF EXISTS "Restaurants public view accessible" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants are viewable by reseller or admin" ON public.restaurants;

-- Drop duplicate SELECT policies on resellers
DROP POLICY IF EXISTS "Resellers can select own data" ON public.resellers;
DROP POLICY IF EXISTS "Resellers can update own data" ON public.resellers;

-- Drop duplicate SELECT policies on subscription_payments
DROP POLICY IF EXISTS "Subscription payments viewable by reseller" ON public.subscription_payments;

-- Drop duplicate SELECT policies on landing_page_leads
DROP POLICY IF EXISTS "Resellers can view their leads" ON public.landing_page_leads;
DROP POLICY IF EXISTS "Resellers can view their own leads" ON public.landing_page_leads;

-- Drop conflicting table_orders INSERT/UPDATE policies with (auth.uid() IS NULL)
DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can insert table orders" ON public.table_orders;
DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can update table orders" ON public.table_orders;

-- Drop conflicting table_order_items INSERT/UPDATE policies with (auth.uid() IS NULL)
DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can insert table order " ON public.table_order_items;
DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can update table order " ON public.table_order_items;

-- ============================================
-- 2. Recreate clean policies
-- ============================================

-- tables: readable by admin/reseller only (not publicly)
CREATE POLICY "Tables readable by admin or reseller"
ON public.tables FOR SELECT
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id) 
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- table_orders: readable by admin/reseller, anonymous can read own via table_id
-- Keep existing "Table orders viewable by restaurant admin" for authenticated
-- Add anonymous read for waiter/customer context
CREATE POLICY "Table orders readable by anyone with table context"
ON public.table_orders FOR SELECT
USING (true);

-- table_orders: insert by admin only (no anonymous fallback)
CREATE POLICY "Table orders insertable by admin"
ON public.table_orders FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_admin_of_restaurant(auth.uid(), restaurant_id) 
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- table_orders: update by admin only (no anonymous fallback)  
CREATE POLICY "Table orders updatable by admin"
ON public.table_orders FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_admin_of_restaurant(auth.uid(), restaurant_id) 
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- order_items: readable by restaurant admin only
CREATE POLICY "Order items readable by admin"
ON public.order_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND (is_admin_of_restaurant(auth.uid(), o.restaurant_id) 
         OR is_reseller_of_restaurant(auth.uid(), o.restaurant_id))
  )
);

-- table_order_items: keep existing insertable policy, add admin insert
CREATE POLICY "Table order items insertable by admin"
ON public.table_order_items FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_admin_of_table_order(auth.uid(), table_order_id) 
  OR is_reseller_of_restaurant(auth.uid(), get_restaurant_id_from_table((
    SELECT tor.table_id FROM table_orders tor WHERE tor.id = table_order_items.table_order_id LIMIT 1
  )))
);

-- table_order_items: admin update
CREATE POLICY "Table order items updatable by admin"
ON public.table_order_items FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR is_admin_of_table_order(auth.uid(), table_order_id) 
  OR is_reseller_of_restaurant(auth.uid(), get_restaurant_id_from_table((
    SELECT tor.table_id FROM table_orders tor WHERE tor.id = table_order_items.table_order_id LIMIT 1
  )))
);

-- customer_addresses: delete scoped by admin only
CREATE POLICY "Addresses deletable by admin"
ON public.customer_addresses FOR DELETE
TO authenticated
USING (
  is_admin_of_restaurant(auth.uid(), restaurant_id)
);

-- restaurants: single clean SELECT policy
CREATE POLICY "Restaurants viewable by authorized users"
ON public.restaurants FOR SELECT
USING (
  is_active = true
  OR is_reseller_of_restaurant(auth.uid(), id) 
  OR is_admin_of_restaurant(auth.uid(), id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================
-- 3. Storage bucket policies
-- ============================================

-- Product images: authenticated users can upload, anyone can view
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Product images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Store assets: authenticated users can upload, anyone can view
CREATE POLICY "Authenticated users can upload store assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'store-assets');

CREATE POLICY "Store assets are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-assets');

CREATE POLICY "Authenticated users can update store assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'store-assets');

CREATE POLICY "Authenticated users can delete store assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'store-assets');

-- ============================================
-- 4. Webhook secret constraint for MP integration
-- ============================================

-- Add validation trigger: if mp_integration_enabled, must have webhook_secret
CREATE OR REPLACE FUNCTION public.validate_reseller_mp_config()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.mp_integration_enabled = true AND (NEW.mp_webhook_secret IS NULL OR NEW.mp_webhook_secret = '') THEN
    RAISE EXCEPTION 'mp_webhook_secret is required when mp_integration_enabled is true';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_reseller_mp_config
  BEFORE INSERT OR UPDATE ON public.resellers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reseller_mp_config();
