-- Add additional activity log actions for comprehensive tracking
-- Update activity logs to include settings changes and user rejections

-- Add trigger for user deletion (when rejected)
CREATE OR REPLACE FUNCTION public.log_user_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    'user_rejected_and_deleted',
    auth.uid(),
    COALESCE(
      (SELECT full_name FROM public.admins WHERE auth_id = auth.uid()),
      (SELECT full_name FROM public.superuser WHERE auth_id = auth.uid()),
      'System'
    ),
    CASE WHEN is_superuser(auth.uid()) THEN 'superuser'
         WHEN is_admin(auth.uid()) THEN 'admin'
         ELSE 'system'
    END,
    OLD.auth_id,
    OLD.full_name,
    OLD.email,
    jsonb_build_object(
      'user_id', OLD.id,
      'reason', 'User application rejected and account deleted',
      'city', OLD.city,
      'occupation', OLD.occupation
    )
  );
  RETURN OLD;
END;
$$;

-- Create trigger for user deletion logging
DROP TRIGGER IF EXISTS log_user_deletion_trigger ON public.users;
CREATE TRIGGER log_user_deletion_trigger
  BEFORE DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_deletion();

-- Add function to delete user completely (including auth)
CREATE OR REPLACE FUNCTION public.delete_user_completely(user_auth_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Only admins and superusers can delete users
  IF NOT (is_admin(auth.uid()) OR is_superuser(auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins and superusers can delete users';
  END IF;

  -- Get user record for logging
  SELECT * INTO user_record FROM public.users WHERE auth_id = user_auth_id;
  
  IF user_record IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Delete user data from public tables first (triggers activity log)
  DELETE FROM public.users WHERE auth_id = user_auth_id;
  
  -- Delete from auth.users (this will cascade to related auth tables)
  DELETE FROM auth.users WHERE id = user_auth_id;
END;
$$;