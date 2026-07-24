DROP POLICY IF EXISTS "Orders insertable with validation" ON public.orders;

CREATE POLICY "Orders insertable by anyone with restaurant"
ON public.orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  restaurant_id IS NOT NULL
  AND customer_name IS NOT NULL
  AND length(trim(customer_name)) > 0
  AND customer_phone IS NOT NULL
  AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 8
  AND total_amount >= 0
  AND payment_method IS NOT NULL
);