-- Create trigger function to log check-in rejection and notify user
CREATE OR REPLACE FUNCTION public.log_checkin_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name TEXT;
  user_email TEXT;
  user_auth_id UUID;
  performer_name TEXT;
BEGIN
  -- Get user details
  SELECT full_name, email, auth_id INTO user_name, user_email, user_auth_id
  FROM public.users WHERE id = OLD.user_id;
  
  -- Get performer name
  performer_name := COALESCE(
    (SELECT full_name FROM public.admins WHERE auth_id = auth.uid()),
    (SELECT full_name FROM public.superuser WHERE auth_id = auth.uid()),
    'Admin'
  );
  
  -- Log the rejection activity
  INSERT INTO public.activity_logs (
    action,
    performed_by,
    performed_by_name,
    performed_by_role,
    target_user_id,
    target_user_name,
    target_user_email,
    details
  ) VALUES (
    'checkin_rejected',
    auth.uid(),
    performer_name,
    CASE 
      WHEN is_superuser(auth.uid()) THEN 'superuser'
      WHEN is_admin(auth.uid()) THEN 'admin'
      ELSE 'system'
    END,
    user_auth_id,
    user_name,
    user_email,
    jsonb_build_object(
      'checkin_id', OLD.id,
      'plan_id', OLD.plan_id,
      'reason', 'Check-in request rejected by ' || performer_name
    )
  );
  
  -- Notify the user about rejection
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (
    user_auth_id,
    'Check-in Request Rejected',
    'Your check-in request has been rejected by ' || performer_name || '. Please contact support for more information.',
    'error',
    jsonb_build_object('checkin_id', OLD.id, 'action', 'checkin_rejected')
  );
  
  RETURN OLD;
END;
$$;

-- Create trigger for check-in deletion (rejection)
DROP TRIGGER IF EXISTS trigger_log_checkin_rejection ON public.checkins;
CREATE TRIGGER trigger_log_checkin_rejection
BEFORE DELETE ON public.checkins
FOR EACH ROW
WHEN (OLD.status = 'pending' AND OLD.checkin_approved = false)
EXECUTE FUNCTION public.log_checkin_rejection();