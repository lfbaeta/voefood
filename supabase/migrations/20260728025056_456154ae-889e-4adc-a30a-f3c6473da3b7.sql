REVOKE SELECT ON public.restaurants FROM anon, authenticated;

GRANT SELECT (id, name, slug, is_active, plan_id, business_subtype, capabilities_override)
  ON public.restaurants TO anon;

GRANT SELECT (id, name, slug, is_active, plan_id, business_subtype, capabilities_override)
  ON public.restaurants TO authenticated;