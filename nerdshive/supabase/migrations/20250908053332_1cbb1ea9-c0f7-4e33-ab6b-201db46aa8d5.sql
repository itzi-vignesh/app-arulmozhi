-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, success, warning, error
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data JSONB DEFAULT NULL -- additional data for the notification
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins and superusers can view all notifications" 
ON public.notifications 
FOR SELECT 
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Function to create notification for admins and superusers when user registers
CREATE OR REPLACE FUNCTION public.notify_user_registration()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
  superuser_id UUID;
BEGIN
  -- Notify all admins
  FOR admin_id IN SELECT auth_id FROM public.admins LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      admin_id,
      'New User Registration',
      'A new user ' || NEW.full_name || ' has registered and needs approval.',
      'info',
      jsonb_build_object('user_id', NEW.id, 'action', 'user_registered')
    );
  END LOOP;

  -- Notify all superusers
  FOR superuser_id IN SELECT auth_id FROM public.superuser LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      superuser_id,
      'New User Registration',
      'A new user ' || NEW.full_name || ' has registered and needs approval.',
      'info',
      jsonb_build_object('user_id', NEW.id, 'action', 'user_registered')
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to notify user when approved/rejected
CREATE OR REPLACE FUNCTION public.notify_user_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if approval status changed
  IF OLD.is_approved != NEW.is_approved THEN
    IF NEW.is_approved = true THEN
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        NEW.auth_id,
        'Account Approved',
        'Congratulations! Your account has been approved. You can now book workspace plans.',
        'success',
        jsonb_build_object('action', 'account_approved')
      );
    ELSE
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        NEW.auth_id,
        'Account Status Update',
        'Your account approval status has been updated. Please contact support for more information.',
        'info',
        jsonb_build_object('action', 'account_rejected')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to notify admins/superusers when user books a plan
CREATE OR REPLACE FUNCTION public.notify_plan_booking()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
  superuser_id UUID;
  user_name TEXT;
BEGIN
  -- Get user's name
  SELECT full_name INTO user_name FROM public.users WHERE id = NEW.user_id;
  
  -- Notify all admins
  FOR admin_id IN SELECT auth_id FROM public.admins LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      admin_id,
      'New Plan Booking',
      user_name || ' has booked a ' || NEW.plan_type || ' plan for ₹' || NEW.amount || ' on ' || NEW.date_selected || '.',
      'info',
      jsonb_build_object('user_id', NEW.user_id, 'plan_type', NEW.plan_type, 'amount', NEW.amount, 'action', 'plan_booked')
    );
  END LOOP;

  -- Notify all superusers
  FOR superuser_id IN SELECT auth_id FROM public.superuser LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      superuser_id,
      'New Plan Booking',
      user_name || ' has booked a ' || NEW.plan_type || ' plan for ₹' || NEW.amount || ' on ' || NEW.date_selected || '.',
      'info',
      jsonb_build_object('user_id', NEW.user_id, 'plan_type', NEW.plan_type, 'amount', NEW.amount, 'action', 'plan_booked')
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER on_user_registered
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_registration();

CREATE TRIGGER on_user_approval_changed
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_approval();

CREATE TRIGGER on_plan_booked
  AFTER INSERT ON public.usage_logs
  FOR EACH ROW EXECUTE FUNCTION public.notify_plan_booking();

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;