ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS root_domain text;

CREATE OR REPLACE VIEW public.resellers_safe
WITH (security_invoker = true) AS
SELECT id, user_id, name, email, phone, company_name, is_active, slug,
       primary_color, secondary_color, landing_page_enabled, landing_page_title,
       landing_page_subtitle, landing_page_logo, landing_page_whatsapp, landing_page_email,
       landing_faq, landing_stats, landing_testimonials, mp_integration_enabled,
       created_at, updated_at, root_domain
FROM public.resellers;
GRANT SELECT ON public.resellers_safe TO authenticated;

CREATE TABLE IF NOT EXISTS public.business_type_defaults (
  business_type TEXT NOT NULL PRIMARY KEY,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.business_type_defaults TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_type_defaults TO authenticated;
GRANT ALL ON public.business_type_defaults TO service_role;
ALTER TABLE public.business_type_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read business type defaults" ON public.business_type_defaults;
CREATE POLICY "Anyone can read business type defaults"
ON public.business_type_defaults FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Super admins manage business type defaults" ON public.business_type_defaults;
CREATE POLICY "Super admins manage business type defaults"
ON public.business_type_defaults FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_business_type_defaults_updated_at ON public.business_type_defaults;
CREATE TRIGGER update_business_type_defaults_updated_at
BEFORE UPDATE ON public.business_type_defaults
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();