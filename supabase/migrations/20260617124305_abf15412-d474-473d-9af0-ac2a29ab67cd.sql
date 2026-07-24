
ALTER TABLE public.restaurant_agents
  ADD COLUMN IF NOT EXISTS custom_instructions text DEFAULT '',
  ADD COLUMN IF NOT EXISTS knowledge_faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS example_conversations jsonb NOT NULL DEFAULT '[]'::jsonb;
