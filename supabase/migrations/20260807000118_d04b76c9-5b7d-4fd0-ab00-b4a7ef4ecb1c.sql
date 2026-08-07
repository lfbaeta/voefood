-- 1) Fix anonymous UPDATE bypass on tables
DROP POLICY IF EXISTS "Admins, restaurant admins and resellers can update tables" ON public.tables;
CREATE POLICY "Admins, restaurant admins and resellers can update tables"
ON public.tables
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- 2) Internal-only SECURITY DEFINER functions: no API execute at all
REVOKE EXECUTE ON FUNCTION public.apply_items_stock_deduction(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_delivery_driver() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_bot_debounce(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_due_outreach(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_ai_credential(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_pending_driver_offers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_product_availability(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_reseller_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_wa_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_deduct_order_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_deduct_table_order_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_order_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_agent_knowledge(uuid, extensions.vector, integer) FROM PUBLIC, anon, authenticated;

-- 3) Admin/staff-only functions: block anonymous execution
REVOKE EXECUTE ON FUNCTION public.adjust_order_item_weight(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_driver_to_order(bigint, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_driver_shift(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_ai_credential(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_ai_enhancement_quota(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_cash_session_summary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_driver_shifts_report(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_drivers_with_location(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_low_stock_items(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_open_cash_session(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_driver_settings(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_driver_settings(uuid, text, integer, numeric, numeric, boolean, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.suggest_nearest_driver(bigint) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_reseller_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_restaurant_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_restaurant_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_reseller(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_of_table_order(uuid, bigint) FROM PUBLIC, anon;