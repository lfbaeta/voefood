
-- Fix: Replace the overly permissive UPDATE policy on customer_addresses
-- The "Customers can update own addresses scoped" policy has USING(true) which is too broad
DROP POLICY IF EXISTS "Customers can update own addresses scoped" ON public.customer_addresses;

CREATE POLICY "Customers can update own addresses scoped"
ON public.customer_addresses
FOR UPDATE
TO anon, authenticated
USING (
  restaurant_id IS NOT NULL
  AND customer_phone IS NOT NULL
  AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 10
)
WITH CHECK (
  restaurant_id IS NOT NULL
  AND customer_phone IS NOT NULL
  AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 10
);
