-- Fix admin creation RLS policy and add email sending functionality
-- Update RLS policy for admins table to allow superuser to insert admins
DROP POLICY IF EXISTS "Superuser can manage admins" ON public.admins;

CREATE POLICY "Superuser can manage admins" ON public.admins
FOR ALL
TO authenticated
USING (is_superuser(auth.uid()))
WITH CHECK (is_superuser(auth.uid()));

-- Create edge function to send admin credentials via email
-- This will be called when superuser adds an admin