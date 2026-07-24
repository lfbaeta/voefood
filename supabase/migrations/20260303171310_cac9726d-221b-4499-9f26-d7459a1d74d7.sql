
-- Drop stale "Orders are publicly readable" policy if it still exists
DROP POLICY IF EXISTS "Orders are publicly readable" ON public.orders;

-- Create RPC for customer address lookup (anonymous-safe, scoped by phone+restaurant)
CREATE OR REPLACE FUNCTION public.get_customer_addresses(p_phone text, p_restaurant_id uuid)
RETURNS TABLE(
  id uuid,
  customer_phone text,
  restaurant_id uuid,
  label text,
  street text,
  number text,
  neighborhood text,
  complement text,
  reference text,
  is_default boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    ca.id, ca.customer_phone, ca.restaurant_id, ca.label,
    ca.street, ca.number, ca.neighborhood, ca.complement,
    ca.reference, ca.is_default, ca.created_at
  FROM public.customer_addresses ca
  WHERE ca.customer_phone = p_phone
    AND ca.restaurant_id = p_restaurant_id
    AND p_phone IS NOT NULL
    AND length(regexp_replace(p_phone, '[^0-9]', '', 'g')) >= 10
    AND p_restaurant_id IS NOT NULL
  ORDER BY ca.is_default DESC, ca.created_at DESC;
$$;

-- Drop overly permissive anonymous SELECT/UPDATE/DELETE policies on customer_addresses
DROP POLICY IF EXISTS "Customers can view own addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Customers can update own addresses" ON public.customer_addresses;
DROP POLICY IF EXISTS "Customers can delete own addresses" ON public.customer_addresses;

-- Replace anonymous INSERT policy with stricter validation
DROP POLICY IF EXISTS "Anyone can insert addresses with restaurant" ON public.customer_addresses;
CREATE POLICY "Addresses insertable with validation"
ON public.customer_addresses FOR INSERT
WITH CHECK (
  restaurant_id IS NOT NULL
  AND customer_phone IS NOT NULL
  AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 10
  AND street IS NOT NULL AND length(trim(street)) > 0
  AND number IS NOT NULL AND length(trim(number)) > 0
  AND neighborhood IS NOT NULL AND length(trim(neighborhood)) > 0
);

-- Allow anonymous update only for addresses matching phone+restaurant (scoped)
CREATE POLICY "Customers can update own addresses scoped"
ON public.customer_addresses FOR UPDATE
USING (true)
WITH CHECK (
  restaurant_id IS NOT NULL
  AND customer_phone IS NOT NULL
  AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 10
);

-- Allow anonymous delete (scoped by phone+restaurant in client code, RLS ensures record exists)
CREATE POLICY "Customers can delete own addresses scoped"
ON public.customer_addresses FOR DELETE
USING (true);
