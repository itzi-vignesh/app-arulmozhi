-- Create plans table for managing user plan subscriptions
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('day', 'week', 'month')),
  amount NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checkins table for managing check-in/check-out flow
CREATE TABLE public.checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  checkin_time TIMESTAMP WITH TIME ZONE NULL,
  checkout_time TIMESTAMP WITH TIME ZONE NULL,
  checkin_approved BOOLEAN DEFAULT false,
  checkin_approved_by UUID NULL,
  checkin_approved_at TIMESTAMP WITH TIME ZONE NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked_in', 'checked_out')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- RLS policies for plans table
CREATE POLICY "Users can view their own plans" ON public.plans
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = plans.user_id AND users.auth_id = auth.uid())
);

CREATE POLICY "Users can insert their own plans" ON public.plans
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = plans.user_id AND users.auth_id = auth.uid())
);

CREATE POLICY "Admins and superusers can view all plans" ON public.plans
FOR SELECT USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

-- RLS policies for checkins table  
CREATE POLICY "Users can view their own checkins" ON public.checkins
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = checkins.user_id AND users.auth_id = auth.uid())
);

CREATE POLICY "Users can insert their own checkins" ON public.checkins
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = checkins.user_id AND users.auth_id = auth.uid())
);

CREATE POLICY "Users can update their own checkins" ON public.checkins
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = checkins.user_id AND users.auth_id = auth.uid())
);

CREATE POLICY "Admins and superusers can manage all checkins" ON public.checkins
FOR ALL USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

-- Function to log plan activities
CREATE OR REPLACE FUNCTION public.log_plan_activity()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_email TEXT;
  action_name TEXT;
BEGIN
  -- Get user details
  SELECT full_name, email INTO user_name, user_email 
  FROM public.users WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    action_name := 'plan_purchased';
  ELSIF TG_OP = 'UPDATE' AND OLD.is_active != NEW.is_active THEN
    action_name := CASE WHEN NEW.is_active THEN 'plan_activated' ELSE 'plan_deactivated' END;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;
  
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
    action_name,
    COALESCE(
      (SELECT auth_id FROM public.users WHERE id = COALESCE(NEW.user_id, OLD.user_id)),
      auth.uid()
    ),
    user_name,
    'user',
    (SELECT auth_id FROM public.users WHERE id = COALESCE(NEW.user_id, OLD.user_id)),
    user_name,
    user_email,
    jsonb_build_object(
      'plan_id', COALESCE(NEW.id, OLD.id),
      'plan_type', COALESCE(NEW.plan_type, OLD.plan_type),
      'amount', COALESCE(NEW.amount, OLD.amount),
      'start_date', COALESCE(NEW.start_date, OLD.start_date),
      'end_date', COALESCE(NEW.end_date, OLD.end_date),
      'is_active', COALESCE(NEW.is_active, OLD.is_active)
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to log checkin activities  
CREATE OR REPLACE FUNCTION public.log_checkin_activity()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
  user_email TEXT;
  action_name TEXT;
  performer_id UUID;
  performer_name TEXT;
  performer_role TEXT;
BEGIN
  -- Get user details
  SELECT full_name, email INTO user_name, user_email 
  FROM public.users WHERE id = NEW.user_id;
  
  -- Determine action and performer
  IF TG_OP = 'INSERT' THEN
    action_name := 'checkin_requested';
    performer_id := (SELECT auth_id FROM public.users WHERE id = NEW.user_id);
    performer_name := user_name;
    performer_role := 'user';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.checkin_approved = false AND NEW.checkin_approved = true THEN
      action_name := 'checkin_approved';
      performer_id := auth.uid();
      performer_name := COALESCE(
        (SELECT full_name FROM public.admins WHERE auth_id = auth.uid()),
        (SELECT full_name FROM public.superuser WHERE auth_id = auth.uid()),
        'System'
      );
      performer_role := CASE 
        WHEN is_superuser(auth.uid()) THEN 'superuser'
        WHEN is_admin(auth.uid()) THEN 'admin'
        ELSE 'system'
      END;
    ELSIF OLD.status = 'checked_in' AND NEW.status = 'checked_out' THEN
      action_name := 'checked_out';
      performer_id := (SELECT auth_id FROM public.users WHERE id = NEW.user_id);
      performer_name := user_name;
      performer_role := 'user';
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;
  
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
    action_name,
    performer_id,
    performer_name,
    performer_role,
    (SELECT auth_id FROM public.users WHERE id = NEW.user_id),
    user_name,
    user_email,
    jsonb_build_object(
      'checkin_id', NEW.id,
      'plan_id', NEW.plan_id,
      'checkin_time', NEW.checkin_time,
      'checkout_time', NEW.checkout_time,
      'status', NEW.status,
      'checkin_approved', NEW.checkin_approved,
      'checkin_approved_by', NEW.checkin_approved_by
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to notify checkin requests
CREATE OR REPLACE FUNCTION public.notify_checkin_request()
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
      'Check-in Request',
      user_name || ' has requested to check-in.',
      'info',
      jsonb_build_object('checkin_id', NEW.id, 'user_id', NEW.user_id, 'action', 'checkin_requested')
    );
  END LOOP;

  -- Notify all superusers
  FOR superuser_id IN SELECT auth_id FROM public.superuser LOOP
    INSERT INTO public.notifications (user_id, title, message, type, data)
    VALUES (
      superuser_id,
      'Check-in Request',
      user_name || ' has requested to check-in.',
      'info',
      jsonb_build_object('checkin_id', NEW.id, 'user_id', NEW.user_id, 'action', 'checkin_requested')
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER log_plan_activity_trigger
  AFTER INSERT OR UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.log_plan_activity();

CREATE TRIGGER log_checkin_activity_trigger
  AFTER INSERT OR UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.log_checkin_activity();

CREATE TRIGGER notify_checkin_request_trigger
  AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.notify_checkin_request();

-- Add updated_at triggers
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_pricing();

CREATE TRIGGER update_checkins_updated_at
  BEFORE UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_pricing();