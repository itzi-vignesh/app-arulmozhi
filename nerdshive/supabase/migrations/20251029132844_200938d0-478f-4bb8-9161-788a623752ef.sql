-- Create table to track when admins/superusers last viewed different tabs
CREATE TABLE IF NOT EXISTS public.admin_tab_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab_name TEXT NOT NULL,
  last_viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(admin_id, tab_name)
);

-- Enable RLS
ALTER TABLE public.admin_tab_views ENABLE ROW LEVEL SECURITY;

-- Policy: Admins and superusers can view their own tab view records
CREATE POLICY "Admins can view own tab views"
ON public.admin_tab_views
FOR SELECT
USING (
  auth.uid() = admin_id AND 
  (is_admin(auth.uid()) OR is_superuser(auth.uid()))
);

-- Policy: Admins and superusers can insert their own tab view records
CREATE POLICY "Admins can insert own tab views"
ON public.admin_tab_views
FOR INSERT
WITH CHECK (
  auth.uid() = admin_id AND 
  (is_admin(auth.uid()) OR is_superuser(auth.uid()))
);

-- Policy: Admins and superusers can update their own tab view records
CREATE POLICY "Admins can update own tab views"
ON public.admin_tab_views
FOR UPDATE
USING (
  auth.uid() = admin_id AND 
  (is_admin(auth.uid()) OR is_superuser(auth.uid()))
);

-- Create function to update or insert last viewed time
CREATE OR REPLACE FUNCTION public.update_admin_tab_view(p_tab_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.admin_tab_views (admin_id, tab_name, last_viewed_at)
  VALUES (auth.uid(), p_tab_name, now())
  ON CONFLICT (admin_id, tab_name)
  DO UPDATE SET last_viewed_at = now();
END;
$$;