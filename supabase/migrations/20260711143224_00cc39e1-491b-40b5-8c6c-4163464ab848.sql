-- Fix reseller dashboard RLS after internal helper functions were locked down.
-- Do not re-grant execute on public SECURITY DEFINER helpers to anon/authenticated.
-- Instead, replace policies that called get_user_reseller_id() with inline EXISTS checks.

DROP POLICY IF EXISTS "Resellers can view own plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Resellers can insert own plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Resellers can update own plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Resellers can delete own plans" ON public.subscription_plans;

CREATE POLICY "Resellers can view own plans"
ON public.subscription_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = subscription_plans.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can insert own plans"
ON public.subscription_plans
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = subscription_plans.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can update own plans"
ON public.subscription_plans
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = subscription_plans.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = subscription_plans.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can delete own plans"
ON public.subscription_plans
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.resellers r
    WHERE r.id = subscription_plans.reseller_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

DROP POLICY IF EXISTS "Payments viewable by reseller" ON public.subscription_payments;
DROP POLICY IF EXISTS "Resellers can insert payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Resellers can update payments" ON public.subscription_payments;

CREATE POLICY "Payments viewable by reseller"
ON public.subscription_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = subscription_payments.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can insert payments"
ON public.subscription_payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = subscription_payments.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can update payments"
ON public.subscription_payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = subscription_payments.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = subscription_payments.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

DROP POLICY IF EXISTS "Resellers can insert store config for own restaurants" ON public.store_config;
DROP POLICY IF EXISTS "Resellers can update store config for own restaurants" ON public.store_config;

CREATE POLICY "Resellers can insert store config for own restaurants"
ON public.store_config
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = store_config.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Resellers can update store config for own restaurants"
ON public.store_config
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = store_config.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.restaurants rest
    JOIN public.resellers r ON r.id = rest.reseller_id
    WHERE rest.id = store_config.restaurant_id
      AND r.user_id = auth.uid()
      AND r.is_active = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'::public.app_role
  )
);