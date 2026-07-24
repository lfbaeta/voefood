ALTER TABLE public.agent_safety_limits
  ADD COLUMN IF NOT EXISTS max_messages_per_contact_per_hour integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS nps_after_delivery_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nps_delay_minutes integer DEFAULT 40,
  ADD COLUMN IF NOT EXISTS abandoned_followup_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS abandoned_followup_minutes integer DEFAULT 30;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS agent_nps_scheduled_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.claim_due_outreach(p_limit integer DEFAULT 25)
RETURNS TABLE(id uuid, restaurant_id uuid, conversation_id uuid, contact_id uuid, agent_id uuid, objective text, extra_context text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH picked AS (
    SELECT q.id
    FROM public.ai_outreach_queue q
    WHERE q.status = 'scheduled' AND q.next_run_at <= now()
    ORDER BY q.next_run_at
    LIMIT GREATEST(1, LEAST(p_limit, 100))
    FOR UPDATE SKIP LOCKED
  ), updated AS (
    UPDATE public.ai_outreach_queue q
    SET status = 'sending', updated_at = now()
    FROM picked
    WHERE q.id = picked.id
    RETURNING q.id, q.restaurant_id, q.conversation_id, q.contact_id, q.agent_id, q.objective, q.extra_context
  )
  SELECT * FROM updated;
$$;