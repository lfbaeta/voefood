DROP VIEW IF EXISTS public.restaurants_public;

CREATE OR REPLACE FUNCTION public.get_public_restaurant(p_slug text DEFAULT NULL, p_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  is_active boolean,
  plan_id uuid,
  business_subtype text,
  capabilities_override jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT r.id, r.name, r.slug, r.is_active, r.plan_id, r.business_subtype, r.capabilities_override
  FROM public.restaurants r
  WHERE r.is_active = true
    AND (p_slug IS NOT NULL OR p_id IS NOT NULL)
    AND (p_slug IS NULL OR r.slug = p_slug)
    AND (p_id IS NULL OR r.id = p_id)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_restaurant(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_restaurant(text, uuid) TO anon, authenticated, service_role;
