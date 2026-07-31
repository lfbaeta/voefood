
-- Drop and recreate function with new return type (adding phone_whatsapp)
DROP FUNCTION IF EXISTS public.get_public_store_config(uuid);

CREATE OR REPLACE FUNCTION public.get_public_store_config(p_restaurant_id uuid)
 RETURNS TABLE(id uuid, name text, logo_url text, cover_url text, is_open boolean, delivery_fee numeric, delivery_fee_mode text, min_order_value numeric, delivery_time_min integer, delivery_time_max integer, address text, primary_color text, secondary_color text, accent_color text, pwa_name text, pwa_short_name text, restaurant_id uuid, msg_order_accepted text, msg_order_preparing text, msg_order_delivery text, msg_order_completed text, timezone text, phone_whatsapp text)
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
    sc.timezone, sc.phone_whatsapp
  FROM public.store_config sc
  WHERE sc.restaurant_id = p_restaurant_id;
$function$;

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
