-- Painéis logados precisam do acesso completo (as regras de linha continuam limitando quem vê o quê)
GRANT SELECT ON public.restaurants TO authenticated;

-- A leitura pública ampla vale apenas para visitantes não logados
DROP POLICY IF EXISTS "Public can read active restaurants (limited columns)" ON public.restaurants;
CREATE POLICY "Public can read active restaurants (limited columns)"
ON public.restaurants
FOR SELECT
TO anon
USING (is_active = true);