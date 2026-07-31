-- Criar funções RPC para acesso público aos dados do cardápio
-- Estas funções são security definer e retornam apenas dados públicos

-- Função para obter configuração pública da loja por restaurant_id
CREATE OR REPLACE FUNCTION public.get_public_store_config(p_restaurant_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  logo_url text,
  cover_url text,
  is_open boolean,
  delivery_fee numeric,
  delivery_fee_mode text,
  min_order_value numeric,
  delivery_time_min integer,
  delivery_time_max integer,
  address text,
  primary_color text,
  secondary_color text,
  accent_color text,
  pwa_name text,
  pwa_short_name text,
  restaurant_id uuid,
  msg_order_accepted text,
  msg_order_preparing text,
  msg_order_delivery text,
  msg_order_completed text,
  timezone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sc.id,
    sc.name,
    sc.logo_url,
    sc.cover_url,
    sc.is_open,
    sc.delivery_fee,
    sc.delivery_fee_mode,
    sc.min_order_value,
    sc.delivery_time_min,
    sc.delivery_time_max,
    sc.address,
    sc.primary_color,
    sc.secondary_color,
    sc.accent_color,
    sc.pwa_name,
    sc.pwa_short_name,
    sc.restaurant_id,
    sc.msg_order_accepted,
    sc.msg_order_preparing,
    sc.msg_order_delivery,
    sc.msg_order_completed,
    sc.timezone
  FROM public.store_config sc
  WHERE sc.restaurant_id = p_restaurant_id;
$$;

-- Função para obter restaurant_id por slug
CREATE OR REPLACE FUNCTION public.get_restaurant_id_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id 
  FROM public.restaurants 
  WHERE slug = p_slug AND is_active = true;
$$;

-- Função para obter dados públicos do reseller por slug
CREATE OR REPLACE FUNCTION public.get_public_reseller_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  slug text,
  company_name text,
  landing_page_enabled boolean,
  landing_page_title text,
  landing_page_subtitle text,
  landing_page_logo text,
  landing_faq jsonb,
  landing_stats jsonb,
  landing_testimonials jsonb,
  primary_color text,
  secondary_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.slug,
    r.company_name,
    r.landing_page_enabled,
    r.landing_page_title,
    r.landing_page_subtitle,
    r.landing_page_logo,
    r.landing_faq,
    r.landing_stats,
    r.landing_testimonials,
    r.primary_color,
    r.secondary_color
  FROM public.resellers r
  WHERE r.slug = p_slug AND r.is_active = true;
$$;

-- Função para obter primeiro reseller ativo com landing page
CREATE OR REPLACE FUNCTION public.get_default_public_reseller()
RETURNS TABLE (
  id uuid,
  slug text,
  company_name text,
  landing_page_enabled boolean,
  landing_page_title text,
  landing_page_subtitle text,
  landing_page_logo text,
  landing_faq jsonb,
  landing_stats jsonb,
  landing_testimonials jsonb,
  primary_color text,
  secondary_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    r.id,
    r.slug,
    r.company_name,
    r.landing_page_enabled,
    r.landing_page_title,
    r.landing_page_subtitle,
    r.landing_page_logo,
    r.landing_faq,
    r.landing_stats,
    r.landing_testimonials,
    r.primary_color,
    r.secondary_color
  FROM public.resellers r
  WHERE r.is_active = true AND r.landing_page_enabled = true
  ORDER BY r.created_at ASC
  LIMIT 1;
$$;

-- Garantir que as funções podem ser chamadas publicamente
GRANT EXECUTE ON FUNCTION public.get_public_store_config(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_restaurant_id_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_reseller_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_public_reseller() TO anon, authenticated;