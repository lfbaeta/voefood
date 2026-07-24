CREATE TABLE IF NOT EXISTS public.bot_response_claims (
  conversation_id UUID NOT NULL,
  inbound_message_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, inbound_message_id)
);

GRANT ALL ON public.bot_response_claims TO service_role;

ALTER TABLE public.bot_response_claims ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bot_response_claims_created_at
  ON public.bot_response_claims(created_at);

CREATE OR REPLACE FUNCTION public.claim_due_bot_debounce(p_limit INTEGER DEFAULT 25)
RETURNS TABLE(conversation_id UUID, restaurant_id UUID, fire_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH picked AS (
    SELECT bd.conversation_id
    FROM public.bot_debounce bd
    WHERE bd.fire_at <= now()
    ORDER BY bd.fire_at
    LIMIT GREATEST(1, LEAST(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  ), deleted AS (
    DELETE FROM public.bot_debounce bd
    USING picked
    WHERE bd.conversation_id = picked.conversation_id
    RETURNING bd.conversation_id, bd.restaurant_id, bd.fire_at
  )
  SELECT deleted.conversation_id, deleted.restaurant_id, deleted.fire_at
  FROM deleted;
$$;

GRANT EXECUTE ON FUNCTION public.claim_due_bot_debounce(INTEGER) TO service_role;