DROP POLICY IF EXISTS "Reseller owner can update own data" ON public.resellers;
DROP POLICY IF EXISTS "Resellers can update own data" ON public.resellers;

CREATE POLICY "Resellers and admins can update reseller data"
ON public.resellers
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);