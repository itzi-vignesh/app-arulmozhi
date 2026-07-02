-- Add missing columns to tables

-- Add is_active column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add missing columns to admins table
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS occupation text;

-- Add missing columns to superuser table
ALTER TABLE public.superuser ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.superuser ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE public.superuser ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.superuser ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.superuser ADD COLUMN IF NOT EXISTS occupation text;

-- Update existing triggers to handle the new is_active field
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
      target_user_id,
      target_user_name,
      target_user_email,
      details
    ) VALUES (
      CASE WHEN NEW.is_approved THEN 'user_approved' ELSE 'user_unapproved' END,
      NEW.auth_id,
      NEW.full_name,
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'previous_status', OLD.is_approved,
        'new_status', NEW.is_approved
      )
    );
  END IF;
  
  -- Log if user made inactive
  IF (OLD.is_active IS NULL OR OLD.is_active = true) AND NEW.is_active = false THEN
    INSERT INTO public.activity_logs (
      action,
      target_user_id,
      target_user_name,
      target_user_email,
      details
    ) VALUES (
      'user_made_inactive',
      NEW.auth_id,
      NEW.full_name,
      NEW.email,
      jsonb_build_object(
        'user_id', NEW.id,
        'reason', 'Made inactive by admin'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for user approval changes
DROP TRIGGER IF EXISTS log_user_approval_change_trigger ON public.users;
CREATE TRIGGER log_user_approval_change_trigger
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_approval_change();