-- Remover política duplicada de landing_page_leads
DROP POLICY IF EXISTS "Leads insertable by anyone" ON public.landing_page_leads;