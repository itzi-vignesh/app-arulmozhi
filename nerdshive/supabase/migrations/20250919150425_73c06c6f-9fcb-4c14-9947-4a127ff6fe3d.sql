-- Fix RLS policies for admins and superuser tables to allow updates

-- Update admin table policies to allow self-updates
DROP POLICY IF EXISTS "Admins can update their own profile" ON public.admins;
CREATE POLICY "Admins can update their own profile" 
ON public.admins 
FOR UPDATE 
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());

-- Update superuser table policies to allow self-updates  
DROP POLICY IF EXISTS "Superuser can update their own profile" ON public.superuser;
CREATE POLICY "Superuser can update their own profile"
ON public.superuser 
FOR UPDATE 
USING (auth_id = auth.uid())
WITH CHECK (auth_id = auth.uid());