CREATE OR REPLACE FUNCTION public.is_admin_of_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.restaurant_admins
      WHERE user_id = _user_id AND restaurant_id = _restaurant_id
    )
$function$;