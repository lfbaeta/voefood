CREATE OR REPLACE FUNCTION public.get_ai_enhancement_quota(p_restaurant_id uuid)
RETURNS TABLE(used integer, quota integer, remaining integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quota integer := 0;
  v_used integer := 0;
  v_period_start timestamptz;
BEGIN
  v_period_start := date_trunc('month', now());

  SELECT COALESCE(sp.ai_image_enhancements_per_month, 0)
    INTO v_quota
  FROM public.restaurants r
  LEFT JOIN public.subscription_plans sp ON sp.id = r.plan_id
  WHERE r.id = p_restaurant_id
  LIMIT 1;

  v_quota := COALESCE(v_quota, 0);

  SELECT COUNT(*)::int INTO v_used
  FROM public.ai_image_enhancements
  WHERE restaurant_id = p_restaurant_id
    AND status = 'success'
    AND created_at >= v_period_start;

  RETURN QUERY SELECT v_used, v_quota, GREATEST(v_quota - v_used, 0);
END;
$$;
