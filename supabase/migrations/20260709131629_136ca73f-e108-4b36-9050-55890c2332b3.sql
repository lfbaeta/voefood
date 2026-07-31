
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK (audience IN ('staff','customer')),
  event_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text NULL,
  order_id bigint NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  table_order_id bigint NULL REFERENCES public.table_orders(id) ON DELETE CASCADE,
  customer_phone text NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_restaurant_audience_created ON public.notifications(restaurant_id, audience, created_at DESC);
CREATE INDEX idx_notif_order ON public.notifications(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_notif_unread_staff ON public.notifications(restaurant_id, read_at) WHERE audience = 'staff' AND read_at IS NULL;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read restaurant notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (audience = 'staff' AND public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Staff mark restaurant notifications as read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (audience = 'staff' AND public.is_admin_of_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (audience = 'staff' AND public.is_admin_of_restaurant(auth.uid(), restaurant_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Customer RPCs (anonymous flows validate phone against the order)
CREATE OR REPLACE FUNCTION public.list_customer_notifications(
  p_order_id bigint,
  p_customer_phone text
) RETURNS SETOF public.notifications
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_db text;
  v_digits_in text;
  v_digits_db text;
BEGIN
  SELECT customer_phone INTO v_phone_db FROM public.orders WHERE id = p_order_id;
  IF v_phone_db IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  v_digits_in := regexp_replace(COALESCE(p_customer_phone,''),'[^0-9]','','g');
  v_digits_db := regexp_replace(v_phone_db,'[^0-9]','','g');
  IF length(v_digits_in) < 8 OR right(v_digits_db,8) <> right(v_digits_in,8) THEN
    RAISE EXCEPTION 'phone_mismatch';
  END IF;

  RETURN QUERY
    SELECT n.* FROM public.notifications n
    WHERE n.audience = 'customer' AND n.order_id = p_order_id
    ORDER BY n.created_at DESC
    LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_customer_notification_read(
  p_notification_id uuid,
  p_order_id bigint,
  p_customer_phone text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_db text;
  v_digits_in text;
  v_digits_db text;
BEGIN
  SELECT customer_phone INTO v_phone_db FROM public.orders WHERE id = p_order_id;
  IF v_phone_db IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  v_digits_in := regexp_replace(COALESCE(p_customer_phone,''),'[^0-9]','','g');
  v_digits_db := regexp_replace(v_phone_db,'[^0-9]','','g');
  IF length(v_digits_in) < 8 OR right(v_digits_db,8) <> right(v_digits_in,8) THEN
    RAISE EXCEPTION 'phone_mismatch';
  END IF;

  UPDATE public.notifications
     SET read_at = now()
   WHERE id = p_notification_id
     AND audience = 'customer'
     AND order_id = p_order_id
     AND read_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_customer_notifications_all_read(
  p_order_id bigint,
  p_customer_phone text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone_db text;
  v_digits_in text;
  v_digits_db text;
BEGIN
  SELECT customer_phone INTO v_phone_db FROM public.orders WHERE id = p_order_id;
  IF v_phone_db IS NULL THEN RAISE EXCEPTION 'order_not_found'; END IF;
  v_digits_in := regexp_replace(COALESCE(p_customer_phone,''),'[^0-9]','','g');
  v_digits_db := regexp_replace(v_phone_db,'[^0-9]','','g');
  IF length(v_digits_in) < 8 OR right(v_digits_db,8) <> right(v_digits_in,8) THEN
    RAISE EXCEPTION 'phone_mismatch';
  END IF;

  UPDATE public.notifications
     SET read_at = now()
   WHERE audience = 'customer'
     AND order_id = p_order_id
     AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_customer_notifications(bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_notification_read(uuid, bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_customer_notifications_all_read(bigint, text) TO anon, authenticated;
