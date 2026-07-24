-- Remover policy duplicada de landing_page_leads
DROP POLICY IF EXISTS "Anyone can create leads" ON public.landing_page_leads;