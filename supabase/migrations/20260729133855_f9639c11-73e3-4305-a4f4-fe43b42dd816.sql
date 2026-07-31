CREATE TABLE public.business_type_defaults (
  business_type TEXT NOT NULL PRIMARY KEY,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.business_type_defaults TO anon;
GRANT SELECT ON public.business_type_defaults TO authenticated;
GRANT ALL ON public.business_type_defaults TO service_role;

ALTER TABLE public.business_type_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read business type defaults"
ON public.business_type_defaults FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Super admins manage business type defaults"
ON public.business_type_defaults FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.business_type_defaults TO authenticated;

CREATE TRIGGER update_business_type_defaults_updated_at
BEFORE UPDATE ON public.business_type_defaults
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();