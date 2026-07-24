ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS ai_image_enhancements_per_month integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ai_image_enhancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  original_url text,
  enhanced_url text,
  prompt_used text,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_image_enhancements TO authenticated;
GRANT ALL ON public.ai_image_enhancements TO service_role;

ALTER TABLE public.ai_image_enhancements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read own restaurant enhancements" ON public.ai_image_enhancements;
CREATE POLICY "admins read own restaurant enhancements"
  ON public.ai_image_enhancements FOR SELECT TO authenticated
  USING (public.is_admin_of_restaurant(auth.uid(), restaurant_id));

CREATE INDEX IF NOT EXISTS idx_ai_image_enhancements_restaurant_created
  ON public.ai_image_enhancements(restaurant_id, created_at DESC);

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
  LEFT JOIN public.subscription_plans sp ON sp.id = r.subscription_plan_id
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
