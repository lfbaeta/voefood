DROP VIEW IF EXISTS public.resellers_safe;
CREATE VIEW public.resellers_safe
WITH (security_invoker = true) AS
SELECT id, user_id, name, email, phone, company_name, is_active, slug,
       primary_color, secondary_color, landing_page_enabled, landing_page_title,
       landing_page_subtitle, landing_page_logo, landing_page_whatsapp, landing_page_email,
       landing_faq, landing_stats, landing_testimonials, mp_integration_enabled,
       root_domain, created_at, updated_at
FROM public.resellers;

GRANT SELECT ON public.resellers_safe TO authenticated;