-- Fix security warnings by setting search_path on all functions

-- Fix is_superuser function
CREATE OR REPLACE FUNCTION public.is_superuser(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.superuser 
    WHERE auth_id = user_id
  );
$function$;

-- Fix is_admin function  
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admins 
    WHERE auth_id = user_id
  );
$function$;

-- Fix update_updated_at_pricing function
CREATE OR REPLACE FUNCTION public.update_updated_at_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$function$;

-- Fix create_usage_update function
CREATE OR REPLACE FUNCTION public.create_usage_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  user_name text;
BEGIN
  -- Get user's full name
  SELECT full_name INTO user_name FROM public.users WHERE id = NEW.user_id;
  
  -- Create update message
  INSERT INTO public.updates (message, type, user_id, created_at)
  VALUES (
    user_name || ' booked ' || NEW.plan_type || ' plan on ' || NEW.date_selected,
    'booking',
    NEW.user_id,
    NEW.created_at
  );
  
  RETURN NEW;
END;
$function$;