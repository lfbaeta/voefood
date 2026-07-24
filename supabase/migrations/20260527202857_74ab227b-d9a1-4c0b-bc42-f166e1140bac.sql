ALTER TABLE public.evolution_instances
  ADD COLUMN IF NOT EXISTS instance_token text,
  ADD COLUMN IF NOT EXISTS instance_uuid text;