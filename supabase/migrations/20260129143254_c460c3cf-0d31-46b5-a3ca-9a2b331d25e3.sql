-- =============================================
-- FASE 1: CORREÇÕES CRÍTICAS DE SEGURANÇA (CONTINUAÇÃO)
-- =============================================

-- 5. RESTRINGIR resellers - apenas o próprio reseller (já existe, pular)
-- A policy "Resellers can view own data" já existe, então vamos apenas garantir que as outras correções sejam aplicadas

-- 6. Criar VIEW pública para resellers (apenas para verificar existência de slug)
CREATE OR REPLACE VIEW public.resellers_public
WITH (security_invoker = on)
AS SELECT
  id,
  slug,
  company_name,
  landing_page_enabled,
  landing_page_title,
  landing_page_subtitle,
  landing_page_logo,
  landing_faq,
  landing_stats,
  landing_testimonials,
  primary_color,
  secondary_color,
  is_active
FROM public.resellers
WHERE is_active = true;

-- 7. RESTRINGIR orders - apenas admins do restaurante
DROP POLICY IF EXISTS "Orders are publicly readable" ON public.orders;
DROP POLICY IF EXISTS "Orders readable by restaurant admin" ON public.orders;

CREATE POLICY "Orders readable by restaurant admin"
ON public.orders FOR SELECT
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
  OR public.is_reseller_of_restaurant(restaurant_id, auth.uid())
);

-- 8. Criar VIEW pública para orders (sem dados sensíveis, para tracking por ID)
CREATE OR REPLACE VIEW public.orders_tracking
WITH (security_invoker = on)
AS SELECT
  id,
  status,
  total_amount,
  payment_method,
  created_at,
  updated_at,
  restaurant_id
FROM public.orders;

-- 9. RESTRINGIR restaurants - criar VIEW pública
DROP POLICY IF EXISTS "Restaurants are viewable by reseller or if active" ON public.restaurants;
DROP POLICY IF EXISTS "Restaurants viewable by owner reseller or admin" ON public.restaurants;

CREATE POLICY "Restaurants viewable by owner reseller or admin"
ON public.restaurants FOR SELECT
USING (
  public.is_reseller_of_restaurant(id, auth.uid())
  OR public.is_admin_of_restaurant(id, auth.uid())
);

-- VIEW pública de restaurantes (apenas dados não sensíveis)
CREATE OR REPLACE VIEW public.restaurants_public
WITH (security_invoker = on)
AS SELECT
  id,
  name,
  slug,
  is_active
FROM public.restaurants
WHERE is_active = true;

-- 10. RESTRINGIR landing_page_leads
DROP POLICY IF EXISTS "Leads are insertable by anyone" ON public.landing_page_leads;
DROP POLICY IF EXISTS "Leads are readable by reseller" ON public.landing_page_leads;
DROP POLICY IF EXISTS "Leads insertable by anyone" ON public.landing_page_leads;
DROP POLICY IF EXISTS "Leads readable by owner reseller" ON public.landing_page_leads;

CREATE POLICY "Leads insertable by anyone"
ON public.landing_page_leads FOR INSERT
WITH CHECK (true);

CREATE POLICY "Leads readable by owner reseller"
ON public.landing_page_leads FOR SELECT
USING (
  reseller_id IN (
    SELECT id FROM public.resellers WHERE user_id = auth.uid()
  )
);

-- 11. Corrigir table_orders - remover permissões anônimas
DROP POLICY IF EXISTS "Table orders are manageable" ON public.table_orders;
DROP POLICY IF EXISTS "Table orders are viewable" ON public.table_orders;
DROP POLICY IF EXISTS "Table orders viewable by restaurant admin" ON public.table_orders;
DROP POLICY IF EXISTS "Table orders manageable by restaurant admin" ON public.table_orders;

CREATE POLICY "Table orders viewable by restaurant admin"
ON public.table_orders FOR SELECT
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
  OR public.is_reseller_of_restaurant(restaurant_id, auth.uid())
);

CREATE POLICY "Table orders insertable by restaurant admin"
ON public.table_orders FOR INSERT
WITH CHECK (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
);

CREATE POLICY "Table orders updatable by restaurant admin"
ON public.table_orders FOR UPDATE
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
);

CREATE POLICY "Table orders deletable by restaurant admin"
ON public.table_orders FOR DELETE
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
);

-- 12. Corrigir tables - remover permissões anônimas
DROP POLICY IF EXISTS "Tables are manageable by admin" ON public.tables;
DROP POLICY IF EXISTS "Tables are viewable" ON public.tables;
DROP POLICY IF EXISTS "Tables viewable by restaurant admin" ON public.tables;
DROP POLICY IF EXISTS "Tables manageable by restaurant admin" ON public.tables;

CREATE POLICY "Tables viewable by restaurant admin"
ON public.tables FOR SELECT
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
  OR public.is_reseller_of_restaurant(restaurant_id, auth.uid())
);

CREATE POLICY "Tables insertable by restaurant admin"
ON public.tables FOR INSERT
WITH CHECK (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
);

CREATE POLICY "Tables updatable by restaurant admin"
ON public.tables FOR UPDATE
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
);

CREATE POLICY "Tables deletable by restaurant admin"
ON public.tables FOR DELETE
USING (
  public.is_admin_of_restaurant(restaurant_id, auth.uid())
);