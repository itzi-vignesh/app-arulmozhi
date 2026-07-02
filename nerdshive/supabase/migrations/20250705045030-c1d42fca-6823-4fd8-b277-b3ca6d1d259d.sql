-- Update RLS policies to allow superusers access to admin-level data

-- Update users table policies to include superuser access
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update user approval status" ON public.users;

CREATE POLICY "Admins and superusers can view all users" 
ON public.users 
FOR SELECT 
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

CREATE POLICY "Admins and superusers can update user approval status" 
ON public.users 
FOR UPDATE 
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

-- Update queries table policies
DROP POLICY IF EXISTS "Admins can view and respond to all queries" ON public.queries;

CREATE POLICY "Admins and superusers can view and respond to all queries" 
ON public.queries 
FOR ALL 
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

-- Update usage_logs table policies  
DROP POLICY IF EXISTS "Admins can view all usage logs" ON public.usage_logs;

CREATE POLICY "Admins and superusers can view all usage logs" 
ON public.usage_logs 
FOR SELECT 
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

-- Update updates table policies
DROP POLICY IF EXISTS "Admins can manage updates" ON public.updates;

CREATE POLICY "Admins and superusers can manage updates" 
ON public.updates 
FOR ALL 
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

-- Update content_sections table policies
DROP POLICY IF EXISTS "Admins can manage content sections" ON public.content_sections;

CREATE POLICY "Admins and superusers can manage content sections" 
ON public.content_sections 
FOR ALL 
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));