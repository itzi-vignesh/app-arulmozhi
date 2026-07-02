-- Function to notify other admins/superusers when an approval happens
CREATE OR REPLACE FUNCTION public.notify_admin_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_id UUID;
  superuser_id UUID;
  approver_name TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Get the name of the person who performed the approval
  approver_name := COALESCE(
    (SELECT full_name FROM public.admins WHERE auth_id = auth.uid()),
    (SELECT full_name FROM public.superuser WHERE auth_id = auth.uid()),
    'Admin'
  );

  -- Determine notification content based on the table
  IF TG_TABLE_NAME = 'users' THEN
    -- User approval notification
    IF OLD.is_approved = false AND NEW.is_approved = true THEN
      notification_title := 'User Approved';
      notification_message := approver_name || ' approved user ' || NEW.full_name || '.';
      
      -- Notify all admins except the one who approved
      FOR admin_id IN SELECT auth_id FROM public.admins WHERE auth_id != auth.uid() LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          admin_id,
          notification_title,
          notification_message,
          'success',
          jsonb_build_object('user_id', NEW.id, 'action', 'user_approved', 'approved_by', auth.uid())
        );
      END LOOP;

      -- Notify all superusers except the one who approved
      FOR superuser_id IN SELECT auth_id FROM public.superuser WHERE auth_id != auth.uid() LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          superuser_id,
          notification_title,
          notification_message,
          'success',
          jsonb_build_object('user_id', NEW.id, 'action', 'user_approved', 'approved_by', auth.uid())
        );
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'checkins' THEN
    -- Check-in approval notification
    IF OLD.checkin_approved = false AND NEW.checkin_approved = true THEN
      -- Get user name
      SELECT full_name INTO notification_message FROM public.users WHERE id = NEW.user_id;
      notification_title := 'Check-in Approved';
      notification_message := approver_name || ' approved check-in for ' || notification_message || '.';
      
      -- Notify all admins except the one who approved
      FOR admin_id IN SELECT auth_id FROM public.admins WHERE auth_id != auth.uid() LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          admin_id,
          notification_title,
          notification_message,
          'success',
          jsonb_build_object('checkin_id', NEW.id, 'action', 'checkin_approved', 'approved_by', auth.uid())
        );
      END LOOP;

      -- Notify all superusers except the one who approved
      FOR superuser_id IN SELECT auth_id FROM public.superuser WHERE auth_id != auth.uid() LOOP
        INSERT INTO public.notifications (user_id, title, message, type, data)
        VALUES (
          superuser_id,
          notification_title,
          notification_message,
          'success',
          jsonb_build_object('checkin_id', NEW.id, 'action', 'checkin_approved', 'approved_by', auth.uid())
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for user approvals
DROP TRIGGER IF EXISTS on_user_approval_notify_admins ON public.users;
CREATE TRIGGER on_user_approval_notify_admins
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_approval();

-- Create trigger for check-in approvals
DROP TRIGGER IF EXISTS on_checkin_approval_notify_admins ON public.checkins;
CREATE TRIGGER on_checkin_approval_notify_admins
  AFTER UPDATE ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_approval();