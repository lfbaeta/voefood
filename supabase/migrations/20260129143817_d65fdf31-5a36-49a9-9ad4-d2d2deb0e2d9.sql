-- LIMPEZA FINAL: Remover políticas problemáticas e garantir segurança

-- 1. customer_addresses - Remover políticas com OR true
DROP POLICY IF EXISTS "Addresses viewable by phone or admin" ON public.customer_addresses;
DROP POLICY IF EXISTS "Addresses can be updated" ON public.customer_addresses;
DROP POLICY IF EXISTS "Addresses can be deleted" ON public.customer_addresses;

-- Verificar se existem as políticas corrigidas, senão criar
DROP POLICY IF EXISTS "Addresses viewable by owner or restaurant admin" ON public.customer_addresses;
DROP POLICY IF EXISTS "Addresses updatable by restaurant admin" ON public.customer_addresses;
DROP POLICY IF EXISTS "Addresses deletable by restaurant admin" ON public.customer_addresses;

CREATE POLICY "Addresses viewable by restaurant admin"
ON public.customer_addresses FOR SELECT
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
  OR public.is_reseller_of_restaurant(restaurant_id, auth.uid())
);

CREATE POLICY "Addresses updatable by restaurant admin"
ON public.customer_addresses FOR UPDATE
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
);

CREATE POLICY "Addresses deletable by restaurant admin"
ON public.customer_addresses FOR DELETE
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
);

-- 2. resellers - Remover SELECT público
DROP POLICY IF EXISTS "Anyone can check if resellers exist" ON public.resellers;

-- 3. store_config - Remover SELECT público com USING (true)
DROP POLICY IF EXISTS "Store config is publicly readable" ON public.store_config;
DROP POLICY IF EXISTS "Store config public view accessible" ON public.store_config;
DROP POLICY IF EXISTS "Store config readable by restaurant admin only" ON public.store_config;

-- Recriar política que permite SELECT apenas para admins
CREATE POLICY "Store config readable by admins"
ON public.store_config FOR SELECT
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
  OR public.is_reseller_of_restaurant(restaurant_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);