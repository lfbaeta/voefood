-- 1) Permitir leitura pública apenas das colunas não sensíveis de restaurants
GRANT SELECT (id, name, slug, is_active, plan_id, business_subtype, capabilities_override)
  ON public.restaurants TO anon, authenticated;

-- 2) Política de leitura pública restrita a estabelecimentos ativos
DROP POLICY IF EXISTS "Public can read active restaurants (limited columns)" ON public.restaurants;
CREATE POLICY "Public can read active restaurants (limited columns)"
ON public.restaurants
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 3) View passa a usar as permissões de quem consulta
ALTER VIEW public.restaurants_public SET (security_invoker = on);
GRANT SELECT ON public.restaurants_public TO anon, authenticated;