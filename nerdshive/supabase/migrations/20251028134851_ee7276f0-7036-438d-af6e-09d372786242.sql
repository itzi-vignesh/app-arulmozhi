-- Allow admins and superusers to update plans (e.g., payment_verified)
DROP POLICY IF EXISTS "Admins and superusers can update plans" ON public.plans;

CREATE POLICY "Admins and superusers can update plans"
ON public.plans
FOR UPDATE
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_superuser(auth.uid()));