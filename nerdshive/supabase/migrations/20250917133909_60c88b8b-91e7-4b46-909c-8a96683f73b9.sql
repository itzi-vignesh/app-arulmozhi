-- Fix admin dashboard user deletion to use the delete_user_completely function
-- Update the log_user_deletion trigger to be more comprehensive

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS log_user_deletion_trigger ON public.users;

-- Update the log_user_deletion function to be more comprehensive
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
      'occupation', OLD.occupation,
      'govt_id_type', OLD.govt_id_type,
      'reimbursement', OLD.reimbursement,
      'rejected_at', now()
    )
  );
  RETURN OLD;
END;
$$;

-- Create the trigger for user deletion logging
CREATE TRIGGER log_user_deletion_trigger
  BEFORE DELETE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_deletion();

-- Update activity log function for user approval changes
CREATE OR REPLACE FUNCTION public.log_user_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log if approval status changed
  IF OLD.is_approved != NEW.is_approved THEN
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
      CASE WHEN NEW.is_approved THEN 'user_approved' ELSE 'user_unapproved' END,
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
      NEW.auth_id,
      NEW.full_name,
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'previous_status', OLD.is_approved,
        'new_status', NEW.is_approved,
        'approved_at', CASE WHEN NEW.is_approved THEN now() ELSE NULL END
      )
    );
  END IF;
  
  -- Log if user made inactive
  IF (OLD.is_active IS NULL OR OLD.is_active = true) AND NEW.is_active = false THEN
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
      'user_made_inactive',
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
      NEW.auth_id,
      NEW.full_name,
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'reason', 'Made inactive by admin',
        'deactivated_at', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for user approval changes if it doesn't exist
DROP TRIGGER IF EXISTS log_user_approval_change_trigger ON public.users;
CREATE TRIGGER log_user_approval_change_trigger
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_approval_change();