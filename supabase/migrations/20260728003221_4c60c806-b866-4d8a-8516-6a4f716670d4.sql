DROP POLICY IF EXISTS "Leads readable by resellers" ON public.landing_page_leads;
CREATE POLICY "Leads readable by owning reseller"
ON public.landing_page_leads FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (reseller_id IS NOT NULL AND reseller_id = public.get_user_reseller_id(auth.uid()))
);

DROP POLICY IF EXISTS "Resellers can update leads" ON public.landing_page_leads;
CREATE POLICY "Owning reseller can update leads"
ON public.landing_page_leads FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (reseller_id IS NOT NULL AND reseller_id = public.get_user_reseller_id(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (reseller_id IS NOT NULL AND reseller_id = public.get_user_reseller_id(auth.uid()))
);