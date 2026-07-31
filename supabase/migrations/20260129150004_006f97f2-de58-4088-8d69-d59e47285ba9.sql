-- Fix customer_addresses INSERT policy to require authentication
-- This prevents spam and unauthorized data injection

DROP POLICY IF EXISTS "Addresses can be inserted" ON customer_addresses;

CREATE POLICY "Authenticated users can insert addresses"
ON customer_addresses FOR INSERT
TO authenticated
WITH CHECK (restaurant_id IS NOT NULL);

-- Ensure resellers table has proper restrictions
-- Only reseller owner can see their own data, public view is via RPC only

DROP POLICY IF EXISTS "Resellers public view accessible" ON resellers;
DROP POLICY IF EXISTS "Resellers are publicly readable" ON resellers;
DROP POLICY IF EXISTS "Reseller can view own data" ON resellers;

-- Only the reseller owner can view their own data
CREATE POLICY "Reseller owner can view own data"
ON resellers FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Reseller owner can update their own data
DROP POLICY IF EXISTS "Reseller can update own data" ON resellers;

CREATE POLICY "Reseller owner can update own data"
ON resellers FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Ensure customer_addresses hook works properly by updating it
-- The hook uses phone number to filter, but now requires authentication
-- This is acceptable for logged-in checkout flow

-- Add index for better performance on customer_addresses queries
CREATE INDEX IF NOT EXISTS idx_customer_addresses_phone_restaurant 
ON customer_addresses(customer_phone, restaurant_id);
