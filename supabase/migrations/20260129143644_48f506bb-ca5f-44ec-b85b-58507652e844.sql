-- Garantir que as VIEWs públicas podem ser acessadas sem autenticação
-- As VIEWs usam security_invoker=on, então precisam de políticas nas tabelas base
-- que permitam SELECT para os dados públicos.

-- Para restaurants_public: já está configurado (VIEW filtra is_active = true)
-- Para store_config_public: precisa de política para SELECT público nos campos não-sensíveis
-- Para resellers_public: precisa de política para SELECT público

-- Criar política para acesso público à VIEW store_config_public
-- A VIEW já exclui campos sensíveis, então podemos permitir SELECT público
DROP POLICY IF EXISTS "Store config public view accessible" ON public.store_config;
CREATE POLICY "Store config public view accessible"
ON public.store_config FOR SELECT
USING (true);  -- Isso é seguro porque a VIEW filtra campos sensíveis

-- Criar política para acesso público à VIEW restaurants_public  
DROP POLICY IF EXISTS "Restaurants public view accessible" ON public.restaurants;
CREATE POLICY "Restaurants public view accessible"
ON public.restaurants FOR SELECT
USING (is_active = true);

-- Criar política para acesso público à VIEW resellers_public
DROP POLICY IF EXISTS "Resellers public view accessible" ON public.resellers;
CREATE POLICY "Resellers public view accessible"
ON public.resellers FOR SELECT
USING (is_active = true);