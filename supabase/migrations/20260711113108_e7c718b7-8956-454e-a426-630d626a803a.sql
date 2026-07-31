
-- 1) Fix broken tenant isolation function
CREATE OR REPLACE FUNCTION public.is_reseller_of_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    JOIN public.resellers res ON res.id = r.reseller_id
    WHERE r.id = _restaurant_id
      AND res.user_id = _user_id
      AND res.is_active = true
  );
$$;

-- 2) Resellers: restrict SELECT to own row + platform admins
DROP POLICY IF EXISTS "Resellers can view all resellers" ON public.resellers;
CREATE POLICY "Resellers can view own record"
  ON public.resellers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3) customer_addresses: drop the unrestricted anon UPDATE policy
DROP POLICY IF EXISTS "Customers can update own addresses scoped" ON public.customer_addresses;

-- 4) table_order_items: remove public read
DROP POLICY IF EXISTS "Table order items are publicly readable" ON public.table_order_items;

CREATE POLICY "Admins and resellers can view table order items"
  ON public.table_order_items FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_table_order(auth.uid(), table_order_id)
    OR public.is_reseller_of_restaurant(
         auth.uid(),
         public.get_restaurant_id_from_table(
           (SELECT tor.table_id FROM public.table_orders tor WHERE tor.id = table_order_items.table_order_id LIMIT 1)
         )
       )
  );

CREATE OR REPLACE FUNCTION public.get_kitchen_table_items(p_restaurant_id uuid, p_statuses text[] DEFAULT ARRAY['pending','preparing','ready'])
RETURNS SETOF public.table_order_items
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT toi.*
  FROM public.table_order_items toi
  JOIN public.table_orders tord ON tord.id = toi.table_order_id
  WHERE tord.restaurant_id = p_restaurant_id
    AND tord.status IN ('open','requesting_bill')
    AND toi.status = ANY(p_statuses);
$$;
REVOKE ALL ON FUNCTION public.get_kitchen_table_items(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_kitchen_table_items(uuid, text[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_table_order_items_by_order(p_order_id bigint)
RETURNS SETOF public.table_order_items
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT toi.*
  FROM public.table_order_items toi
  WHERE toi.table_order_id = p_order_id
  ORDER BY toi.ordered_at;
$$;
REVOKE ALL ON FUNCTION public.get_table_order_items_by_order(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_order_items_by_order(bigint) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_table_order_items_batch(p_restaurant_id uuid, p_order_ids bigint[])
RETURNS SETOF public.table_order_items
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT toi.*
  FROM public.table_order_items toi
  JOIN public.table_orders tord ON tord.id = toi.table_order_id
  WHERE tord.restaurant_id = p_restaurant_id
    AND toi.table_order_id = ANY(p_order_ids);
$$;
REVOKE ALL ON FUNCTION public.get_table_order_items_batch(uuid, bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_table_order_items_batch(uuid, bigint[]) TO anon, authenticated;

-- 5) Coupons: remove public read; add lookup RPC
DROP POLICY IF EXISTS "Coupons are publicly readable" ON public.coupons;
CREATE POLICY "Admins and resellers can view coupons"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_admin_of_restaurant(auth.uid(), restaurant_id)
    OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
  );

CREATE OR REPLACE FUNCTION public.validate_coupon_lookup(p_code text, p_restaurant_id uuid, p_order_total numeric)
RETURNS TABLE(
  id uuid, code text, discount_type text, discount_value numeric,
  min_order_value numeric, max_uses integer, current_uses integer,
  is_active boolean, expires_at timestamptz, restaurant_id uuid
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
BEGIN
  SELECT * INTO v_coupon
  FROM public.coupons c
  WHERE lower(c.code) = lower(p_code)
    AND c.is_active = true
    AND (c.restaurant_id = p_restaurant_id OR c.restaurant_id IS NULL)
  LIMIT 1;

  IF v_coupon.id IS NULL THEN
    RAISE EXCEPTION 'coupon_not_found';
  END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
    RAISE EXCEPTION 'coupon_exhausted';
  END IF;
  IF v_coupon.min_order_value IS NOT NULL AND p_order_total < v_coupon.min_order_value THEN
    RAISE EXCEPTION 'coupon_min_order_not_met:%', v_coupon.min_order_value;
  END IF;

  RETURN QUERY SELECT
    v_coupon.id, v_coupon.code, v_coupon.discount_type, v_coupon.discount_value,
    v_coupon.min_order_value, v_coupon.max_uses, v_coupon.current_uses,
    v_coupon.is_active, v_coupon.expires_at, v_coupon.restaurant_id;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_coupon_lookup(text, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon_lookup(text, uuid, numeric) TO anon, authenticated;

-- 6) Storage: drop broad any-authenticated write policies and duplicate public read/listing
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete store assets" ON storage.objects;
DROP POLICY IF EXISTS "Product images are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Store assets are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Product images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Store assets are publicly accessible" ON storage.objects;

-- 7) Revoke EXECUTE on internal helper SECURITY DEFINER functions (RLS/trigger use only)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_of_restaurant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_reseller(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_reseller_of_restaurant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_restaurant_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_of_table_order(uuid, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_restaurant_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_reseller_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_restaurant_id_from_table(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_ai_credential(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_ai_credential(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_bot_debounce(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_outreach(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_agent_knowledge(uuid, extensions.vector, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_reseller_mp_config() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_wa_conversation_last_message() FROM PUBLIC, anon, authenticated;
