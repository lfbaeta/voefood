
-- 1) customer_addresses: bind insert to active restaurant
DROP POLICY IF EXISTS "Addresses insertable with validation" ON public.customer_addresses;
CREATE POLICY "Addresses insertable with validation"
ON public.customer_addresses FOR INSERT TO anon, authenticated
WITH CHECK (
  restaurant_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.is_active = true)
  AND customer_phone IS NOT NULL
  AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 10
  AND street IS NOT NULL AND length(trim(street)) > 0
  AND number IS NOT NULL AND length(trim(number)) > 0
  AND neighborhood IS NOT NULL AND length(trim(neighborhood)) > 0
);

-- 2) orders: bind insert to active restaurant
DROP POLICY IF EXISTS "Orders insertable by anyone with restaurant" ON public.orders;
CREATE POLICY "Orders insertable by anyone with restaurant"
ON public.orders FOR INSERT TO anon, authenticated
WITH CHECK (
  restaurant_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.is_active = true)
  AND customer_name IS NOT NULL AND length(trim(customer_name)) > 0
  AND customer_phone IS NOT NULL AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 8
  AND total_amount >= 0
  AND payment_method IS NOT NULL
);

-- 3) table_orders: bind restaurant_id to table's restaurant
DROP POLICY IF EXISTS "Table orders insertable anonymously with valid table" ON public.table_orders;
CREATE POLICY "Table orders insertable anonymously with valid table"
ON public.table_orders FOR INSERT TO anon
WITH CHECK (
  table_id IS NOT NULL
  AND restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.id = table_id AND t.restaurant_id = table_orders.restaurant_id
  )
);

-- 4) table_order_items: bind insert to items whose table_order belongs to an open order at the right restaurant
DROP POLICY IF EXISTS "Table order items insertable" ON public.table_order_items;
CREATE POLICY "Table order items insertable"
ON public.table_order_items FOR INSERT TO anon, authenticated
WITH CHECK (
  table_order_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.table_orders tord
    WHERE tord.id = table_order_id
      AND tord.status IN ('open','requesting_bill')
  )
  AND unit_price >= 0
  AND quantity > 0
);

-- 5) waiters: drop overly broad "any global admin can read PIN" policy
DROP POLICY IF EXISTS "Waiters are readable by admins" ON public.waiters;

-- 6) SECURITY DEFINER lockdown: revoke EXECUTE from anon where not required.
-- Keep public-facing anonymous RPCs (storefront + tracking + push + kitchen/waiter PIN).
REVOKE EXECUTE ON FUNCTION public.adjust_order_item_weight(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_active_waiters(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_ai_enhancement_quota(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cash_session_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_open_cash_session(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_open_table_orders(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_kitchen_table_items(uuid, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_table_order_items_batch(uuid, bigint[]) FROM anon;

-- Revoke from PUBLIC on internal-only definer helpers (idempotent no-ops if already revoked)
DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'encrypt_ai_credential(text,text)',
    'decrypt_ai_credential(text,text)',
    'claim_due_bot_debounce(integer)',
    'claim_due_outreach(integer)',
    'sync_wa_conversation_last_message()',
    'validate_reseller_mp_config()',
    'update_updated_at_column()',
    'update_landing_leads_updated_at()',
    'is_admin_of_restaurant(uuid,uuid)',
    'is_admin_of_table_order(uuid,bigint)',
    'is_reseller_of_restaurant(uuid,uuid)',
    'is_reseller(uuid)',
    'is_restaurant_admin(uuid)',
    'get_user_reseller_id(uuid)',
    'get_user_restaurant_id(uuid)',
    'get_restaurant_id_from_table(uuid)',
    'has_role(uuid,app_role)',
    'match_agent_knowledge(uuid,extensions.vector,integer)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- 7) Payment abuse tracking on orders (support card-testing mitigation in edge fn)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_attempts integer NOT NULL DEFAULT 0;
