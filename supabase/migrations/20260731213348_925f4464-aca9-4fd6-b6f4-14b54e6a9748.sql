-- 1) Recria a view pública como SECURITY DEFINER, expondo somente colunas seguras
DROP VIEW IF EXISTS public.restaurants_public;

CREATE VIEW public.restaurants_public
WITH (security_invoker = off) AS
SELECT
  r.id,
  r.name,
  r.slug,
  r.is_active,
  r.plan_id,
  r.business_subtype,
  r.capabilities_override
FROM public.restaurants r
WHERE r.is_active = true;

ALTER VIEW public.restaurants_public OWNER TO postgres;
GRANT SELECT ON public.restaurants_public TO anon, authenticated;

-- 2) Remove qualquer acesso anônimo direto à tabela base
DROP POLICY IF EXISTS "Public can read active restaurants (limited columns)" ON public.restaurants;
REVOKE ALL ON public.restaurants FROM anon;
