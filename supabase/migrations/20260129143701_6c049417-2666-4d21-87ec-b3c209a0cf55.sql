-- Recriar VIEWs com security_definer para permitir acesso público sem autenticação
-- security_definer faz a VIEW executar com permissões do criador (superuser)

-- Remover VIEWs antigas
DROP VIEW IF EXISTS public.store_config_public;
DROP VIEW IF EXISTS public.restaurants_public;
DROP VIEW IF EXISTS public.resellers_public;
DROP VIEW IF EXISTS public.orders_tracking;

-- Recriar VIEW store_config_public (SEM campos sensíveis)
CREATE VIEW public.store_config_public AS 
SELECT
  id,
  name,
  logo_url,
  cover_url,
  is_open,
  delivery_fee,
  delivery_fee_mode,
  min_order_value,
  delivery_time_min,
  delivery_time_max,
  address,
  primary_color,
  secondary_color,
  accent_color,
  pwa_name,
  pwa_short_name,
  restaurant_id,
  msg_order_accepted,
  msg_order_preparing,
  msg_order_delivery,
  msg_order_completed,
  timezone,
  created_at,
  updated_at
FROM public.store_config;

-- Recriar VIEW restaurants_public (SEM campos sensíveis)
CREATE VIEW public.restaurants_public AS 
SELECT
  id,
  name,
  slug,
  is_active
FROM public.restaurants
WHERE is_active = true;

-- Recriar VIEW resellers_public (SEM campos sensíveis)
CREATE VIEW public.resellers_public AS 
SELECT
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

-- Recriar VIEW orders_tracking (SEM dados pessoais)
CREATE VIEW public.orders_tracking AS 
SELECT
  id,
  status,
  total_amount,
  payment_method,
  created_at,
  updated_at,
  restaurant_id
FROM public.orders;

-- Garantir acesso público às VIEWs
GRANT SELECT ON public.store_config_public TO anon, authenticated;
GRANT SELECT ON public.restaurants_public TO anon, authenticated;
GRANT SELECT ON public.resellers_public TO anon, authenticated;
GRANT SELECT ON public.orders_tracking TO anon, authenticated;