CREATE TABLE public.evolution_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  instance_id uuid,
  instance_name text,
  event text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  conversation_id uuid,
  wa_message_id text,
  direction text,
  error text,
  payload_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_evo_webhook_events_restaurant ON public.evolution_webhook_events (restaurant_id, created_at DESC);
CREATE INDEX idx_evo_webhook_events_conversation ON public.evolution_webhook_events (conversation_id, created_at DESC);

GRANT SELECT ON public.evolution_webhook_events TO authenticated;
GRANT ALL ON public.evolution_webhook_events TO service_role;
ALTER TABLE public.evolution_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook events"
ON public.evolution_webhook_events FOR SELECT TO authenticated
USING (
  restaurant_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.restaurant_admins ra WHERE ra.restaurant_id = evolution_webhook_events.restaurant_id AND ra.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.resellers rs ON rs.id = r.reseller_id
      WHERE r.id = evolution_webhook_events.restaurant_id AND rs.user_id = auth.uid()
    )
  )
);

CREATE TABLE public.evolution_send_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  instance_id uuid,
  instance_name text,
  conversation_id uuid,
  message_id uuid,
  order_id bigint,
  source text NOT NULL DEFAULT 'unknown',
  target text,
  endpoint text,
  http_status integer,
  key_source text,
  ok boolean NOT NULL DEFAULT false,
  error text,
  preview text,
  attempts jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_evo_send_attempts_restaurant ON public.evolution_send_attempts (restaurant_id, created_at DESC);
CREATE INDEX idx_evo_send_attempts_conversation ON public.evolution_send_attempts (conversation_id, created_at DESC);
CREATE INDEX idx_evo_send_attempts_order ON public.evolution_send_attempts (order_id, created_at DESC);

GRANT SELECT ON public.evolution_send_attempts TO authenticated;
GRANT ALL ON public.evolution_send_attempts TO service_role;
ALTER TABLE public.evolution_send_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view send attempts"
ON public.evolution_send_attempts FOR SELECT TO authenticated
USING (
  restaurant_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.restaurant_admins ra WHERE ra.restaurant_id = evolution_send_attempts.restaurant_id AND ra.user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.resellers rs ON rs.id = r.reseller_id
      WHERE r.id = evolution_send_attempts.restaurant_id AND rs.user_id = auth.uid()
    )
  )
);