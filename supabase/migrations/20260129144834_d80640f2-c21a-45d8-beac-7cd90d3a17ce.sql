-- =====================================================
-- FASE 2: CORREÇÕES DE SEGURANÇA
-- =====================================================

-- 1. VIEW PÚBLICA PARA RESELLERS (oculta email/telefone)
-- A view resellers_public já existe, vamos apenas garantir que está correta
DROP VIEW IF EXISTS public.resellers_public;
CREATE VIEW public.resellers_public 
WITH (security_invoker = on) AS
SELECT 
  id,
  slug,
  company_name,
  is_active,
  landing_page_enabled,
  landing_page_title,
  landing_page_subtitle,
  landing_page_logo,
  landing_faq,
  landing_stats,
  landing_testimonials,
  primary_color,
  secondary_color
FROM public.resellers;
-- Campos EXCLUÍDOS: user_id, name, email, phone, mp_access_token, mp_public_key, mp_webhook_secret, landing_page_whatsapp, landing_page_email

-- 2. RESTRINGIR SELECT NA TABELA BASE resellers
-- Drop existing policies
DROP POLICY IF EXISTS "Resellers can view own data" ON public.resellers;
DROP POLICY IF EXISTS "Anyone can check if resellers exist" ON public.resellers;
DROP POLICY IF EXISTS "Resellers can select own data" ON public.resellers;

-- Criar política restritiva - apenas o próprio reseller pode ver seus dados
CREATE POLICY "Resellers can select own data"
ON public.resellers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. FORTALECER ISOLAMENTO DE ORDERS
-- Remover política pública
DROP POLICY IF EXISTS "Orders are publicly readable" ON public.orders;
DROP POLICY IF EXISTS "Admins can view restaurant orders" ON public.orders;
DROP POLICY IF EXISTS "Orders viewable by admin" ON public.orders;

-- Apenas admins do restaurante podem ver pedidos
CREATE POLICY "Admins can view restaurant orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- Criar VIEW pública para tracking de pedidos (sem dados pessoais)
DROP VIEW IF EXISTS public.orders_tracking;
CREATE VIEW public.orders_tracking
WITH (security_invoker = on) AS
SELECT 
  id,
  status,
  total_amount,
  payment_method,
  created_at,
  updated_at,
  restaurant_id
FROM public.orders;
-- Campos EXCLUÍDOS: customer_name, customer_phone, address_*, change_for

-- 4. RESTRINGIR WAITERS
DROP POLICY IF EXISTS "Waiters are publicly readable" ON public.waiters;
DROP POLICY IF EXISTS "Admins can view restaurant waiters" ON public.waiters;
DROP POLICY IF EXISTS "Waiters viewable by admin or reseller" ON public.waiters;

-- Apenas admins/resellers podem ver garçons
CREATE POLICY "Waiters viewable by admin or reseller"
ON public.waiters
FOR SELECT
TO authenticated
USING (
  public.is_admin_of_restaurant(auth.uid(), restaurant_id)
  OR public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- 5. CRIAR FUNÇÃO PARA VALIDAR WAITER PIN (sem expor dados)
CREATE OR REPLACE FUNCTION public.validate_waiter_pin(
  p_restaurant_id uuid,
  p_pin text
)
RETURNS TABLE(waiter_id uuid, waiter_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name
  FROM public.waiters
  WHERE restaurant_id = p_restaurant_id
    AND pin = p_pin
    AND is_active = true
  LIMIT 1;
$$;

-- 6. RESTRINGIR customer_addresses INSERT
DROP POLICY IF EXISTS "Addresses can be created" ON public.customer_addresses;
DROP POLICY IF EXISTS "Addresses can be inserted" ON public.customer_addresses;

-- INSERT apenas para usuários autenticados ou com restaurant_id válido
CREATE POLICY "Addresses can be inserted"
ON public.customer_addresses
FOR INSERT
WITH CHECK (
  restaurant_id IS NOT NULL
);

-- 7. FORTALECER communication_logs
DROP POLICY IF EXISTS "Resellers can view communication logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Communication logs viewable by reseller" ON public.communication_logs;

CREATE POLICY "Communication logs viewable by reseller"
ON public.communication_logs
FOR SELECT
TO authenticated
USING (
  public.is_reseller_of_restaurant(auth.uid(), restaurant_id)
);

-- 8. FORTALECER subscription_payments
DROP POLICY IF EXISTS "Resellers can view subscription payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Subscription payments viewable by reseller" ON public.subscription_payments;

CREATE POLICY "Subscription payments viewable by reseller"
ON public.subscription_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = restaurant_id
    AND public.is_reseller_of_restaurant(auth.uid(), r.id)
  )
);

-- 9. GRANT acesso às novas views
GRANT SELECT ON public.resellers_public TO anon, authenticated;
GRANT SELECT ON public.orders_tracking TO anon, authenticated;