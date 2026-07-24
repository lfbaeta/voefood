-- Phase 2: WhatsApp bot infrastructure

-- 1) Extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) RLS on bot_debounce (service-role only)
ALTER TABLE public.bot_debounce ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.bot_debounce TO service_role;

-- 3) Default ai_enabled true for new conversations (IA sempre ativa)
ALTER TABLE public.wa_conversations
  ALTER COLUMN ai_enabled SET DEFAULT true;

-- 4) Index to find pending debounces
CREATE INDEX IF NOT EXISTS idx_bot_debounce_fire_at
  ON public.bot_debounce (fire_at);
