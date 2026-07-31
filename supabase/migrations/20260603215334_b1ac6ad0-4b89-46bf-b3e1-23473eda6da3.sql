
ALTER TABLE public.restaurant_agents
  ADD COLUMN IF NOT EXISTS agent_type           text    NOT NULL DEFAULT 'attendant',
  ADD COLUMN IF NOT EXISTS tone                 text    NOT NULL DEFAULT 'friendly',
  ADD COLUMN IF NOT EXISTS message_length       text    NOT NULL DEFAULT 'short',
  ADD COLUMN IF NOT EXISTS emoji_level          text    NOT NULL DEFAULT 'moderate',
  ADD COLUMN IF NOT EXISTS objective            text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS can_do               text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cannot_do            text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS required_phrases     text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS forbidden_phrases    text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trigger_keywords     text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trigger_phrases      text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS typing_delay_ms      integer NOT NULL DEFAULT 800,
  ADD COLUMN IF NOT EXISTS split_messages       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS proactive_upsell     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS send_photos          boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dedicated_instance_id uuid   REFERENCES public.evolution_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_restaurant_agents_dedicated_instance
  ON public.restaurant_agents(dedicated_instance_id)
  WHERE dedicated_instance_id IS NOT NULL;
