
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('staff','customer')),
  user_id uuid NULL,
  customer_phone text NULL,
  order_id bigint NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  topics text[] NOT NULL DEFAULT '{}',
  user_agent text NULL,
  last_success_at timestamptz NULL,
  failure_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_sub_restaurant_role ON public.push_subscriptions(restaurant_id, role);
CREATE INDEX idx_push_sub_order ON public.push_subscriptions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_push_sub_topics ON public.push_subscriptions USING gin(topics);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read own restaurant subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (role = 'staff' AND user_id = auth.uid() AND public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Staff insert own subscription"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (role = 'staff' AND user_id = auth.uid() AND public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Staff update own subscription"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (role = 'staff' AND user_id = auth.uid())
  WITH CHECK (role = 'staff' AND user_id = auth.uid());

CREATE POLICY "Staff delete own subscription"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (role = 'staff' AND user_id = auth.uid());

CREATE TRIGGER trg_push_sub_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC used by anonymous customers to register a push subscription for a specific order.
CREATE OR REPLACE FUNCTION public.save_customer_push_subscription(
  p_order_id bigint,
  p_customer_phone text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_topics text[] DEFAULT ARRAY['order_status','payment']::text[],
  p_user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_id uuid;
  v_phone_db text;
  v_id uuid;
  v_digits_in text;
  v_digits_db text;
BEGIN
  IF p_order_id IS NULL OR p_endpoint IS NULL OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'missing_fields';
  END IF;

  SELECT restaurant_id, customer_phone INTO v_restaurant_id, v_phone_db
  FROM public.orders WHERE id = p_order_id;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  v_digits_in := regexp_replace(COALESCE(p_customer_phone,''), '[^0-9]', '', 'g');
  v_digits_db := regexp_replace(COALESCE(v_phone_db,''), '[^0-9]', '', 'g');
  IF length(v_digits_in) < 8 OR right(v_digits_db, 8) <> right(v_digits_in, 8) THEN
    RAISE EXCEPTION 'phone_mismatch';
  END IF;

  INSERT INTO public.push_subscriptions
    (restaurant_id, role, customer_phone, order_id, endpoint, p256dh, auth, topics, user_agent)
  VALUES
    (v_restaurant_id, 'customer', v_digits_in, p_order_id, p_endpoint, p_p256dh, p_auth, COALESCE(p_topics, ARRAY['order_status','payment']::text[]), p_user_agent)
  ON CONFLICT (endpoint) DO UPDATE
    SET restaurant_id = EXCLUDED.restaurant_id,
        role = 'customer',
        customer_phone = EXCLUDED.customer_phone,
        order_id = EXCLUDED.order_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        topics = EXCLUDED.topics,
        user_agent = EXCLUDED.user_agent,
        updated_at = now(),
        failure_count = 0
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_customer_push_subscription(bigint, text, text, text, text, text[], text) TO anon, authenticated;
