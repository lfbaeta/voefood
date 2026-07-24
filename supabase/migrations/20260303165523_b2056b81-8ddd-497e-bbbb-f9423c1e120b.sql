
-- FIX 1: Remove public orders SELECT policy that exposes customer PII
DROP POLICY IF EXISTS "Orders publicly readable by restaurant" ON public.orders;

-- FIX 2: Remove duplicate/old policies on tables with reversed params
DROP POLICY IF EXISTS "Tables deletable by restaurant admin" ON public.tables;
DROP POLICY IF EXISTS "Tables insertable by restaurant admin" ON public.tables;
DROP POLICY IF EXISTS "Tables updatable by restaurant admin" ON public.tables;

-- FIX 3: Remove old table_orders policies with reversed params
DROP POLICY IF EXISTS "Table orders deletable by restaurant admin" ON public.table_orders;
DROP POLICY IF EXISTS "Table orders insertable by restaurant admin" ON public.table_orders;
DROP POLICY IF EXISTS "Table orders updatable by restaurant admin" ON public.table_orders;

-- FIX 4: Create a safe view for resellers that excludes secrets
CREATE OR REPLACE VIEW public.resellers_safe AS
SELECT 
  id, user_id, name, email, phone, company_name, is_active,
  slug, primary_color, secondary_color,
  landing_page_enabled, landing_page_title, landing_page_subtitle,
  landing_page_logo, landing_page_whatsapp, landing_page_email,
  landing_faq, landing_stats, landing_testimonials,
  mp_integration_enabled,
  created_at, updated_at
FROM public.resellers;
-- Deliberately excludes: mp_access_token, mp_public_key, mp_webhook_secret
