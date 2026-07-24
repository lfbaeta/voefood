
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS meta_pixel_id text,
  ADD COLUMN IF NOT EXISTS meta_capi_token text,
  ADD COLUMN IF NOT EXISTS meta_test_event_code text,
  ADD COLUMN IF NOT EXISTS google_ads_id text,
  ADD COLUMN IF NOT EXISTS google_ads_conversion_label_purchase text,
  ADD COLUMN IF NOT EXISTS google_analytics_id text,
  ADD COLUMN IF NOT EXISTS tracking_enabled boolean NOT NULL DEFAULT true;

DROP FUNCTION IF EXISTS public.get_public_store_config(uuid);

CREATE OR REPLACE FUNCTION public.get_public_store_config(p_restaurant_id uuid)
 RETURNS TABLE(
   id uuid, name text, logo_url text, cover_url text, is_open boolean,
   delivery_fee numeric, delivery_fee_mode text, min_order_value numeric,
   delivery_time_min integer, delivery_time_max integer, address text,
   primary_color text, secondary_color text, accent_color text,
   pwa_name text, pwa_short_name text, restaurant_id uuid,
   msg_order_accepted text, msg_order_preparing text,
   msg_order_delivery text, msg_order_completed text,
   timezone text, phone_whatsapp text,
   meta_pixel_id text, google_ads_id text,
   google_ads_conversion_label_purchase text, google_analytics_id text,
   tracking_enabled boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    sc.id, sc.name, sc.logo_url, sc.cover_url, sc.is_open,
    sc.delivery_fee, sc.delivery_fee_mode, sc.min_order_value,
    sc.delivery_time_min, sc.delivery_time_max, sc.address,
    sc.primary_color, sc.secondary_color, sc.accent_color,
    sc.pwa_name, sc.pwa_short_name, sc.restaurant_id,
    sc.msg_order_accepted, sc.msg_order_preparing,
    sc.msg_order_delivery, sc.msg_order_completed,
    sc.timezone, sc.phone_whatsapp,
    sc.meta_pixel_id, sc.google_ads_id,
    sc.google_ads_conversion_label_purchase, sc.google_analytics_id,
    sc.tracking_enabled
  FROM public.store_config sc
  WHERE sc.restaurant_id = p_restaurant_id;
$function$;
