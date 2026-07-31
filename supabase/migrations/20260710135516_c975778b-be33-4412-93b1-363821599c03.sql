
CREATE TABLE public.global_ai_config (
  id boolean PRIMARY KEY DEFAULT true,
  gemini_api_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT singleton CHECK (id = true)
);

GRANT ALL ON public.global_ai_config TO service_role;
-- No grants to anon/authenticated: only edge functions (service role) access it.

ALTER TABLE public.global_ai_config ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: table is fully locked from the Data API.

INSERT INTO public.global_ai_config (id) VALUES (true) ON CONFLICT DO NOTHING;
