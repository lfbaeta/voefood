-- 1) Public-safe storefront view: definer-owned (default), exposes ONLY non-sensitive
-- storefront columns and stays readable by anonymous visitors regardless of the
-- restaurants table RLS (previously it was security_invoker=on, which would break
-- the public menu once the table policy is restricted).
DROP VIEW IF EXISTS public.restaurants_public;

CREATE VIEW public.restaurants_public
AS
SELECT id, name, slug, is_active
FROM public.restaurants
WHERE is_active = true;

GRANT SELECT ON public.restaurants_public TO anon, authenticated;
GRANT SELECT ON public.restaurants_public TO service_role;

-- 2) Restrict direct reads on restaurants: contact and Mercado Pago payment fields
-- (owner_name, phone, contact_email, mp_payer_email, mp_subscription_id, mp_init_point)
-- are no longer readable by anonymous internet users.
DROP POLICY IF EXISTS "Restaurants viewable by authorized users" ON public.restaurants;

CREATE POLICY "Restaurants readable by owners admins and resellers"
ON public.restaurants
FOR SELECT
TO authenticated
USING (
  public.is_admin_of_restaurant(auth.uid(), id)
  OR public.is_reseller_of_restaurant(auth.uid(), id)
);

-- 3) Tighten EXECUTE privileges on SECURITY DEFINER functions that are NOT part of
-- the intentional public API (guest checkout / PIN-based staff flows).
REVOKE EXECUTE ON FUNCTION public.claim_print_job(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_fiscal_enabled(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_stock_movement(uuid, text, numeric, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.list_active_drivers(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_driver_shift(uuid, text) FROM PUBLIC, anon, authenticated;

-- Keep legitimate callers working explicitly.
GRANT EXECUTE ON FUNCTION public.claim_print_job(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_fiscal_enabled(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_stock_movement(uuid, text, numeric, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_active_drivers(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_driver_shift(uuid, text) TO service_role;