-- Add payment_verified column to plans table
ALTER TABLE public.plans
ADD COLUMN payment_verified boolean DEFAULT false;

-- Add expired column to checkins table
ALTER TABLE public.checkins
ADD COLUMN expired boolean DEFAULT false;

-- Function to mark old check-ins as expired
CREATE OR REPLACE FUNCTION public.mark_expired_checkins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark check-ins older than today as expired if still pending
  UPDATE public.checkins
  SET expired = true
  WHERE status = 'pending'
    AND checkin_approved = false
    AND DATE(created_at) < CURRENT_DATE
    AND expired = false;
END;
$$;

-- Function to delete expired check-ins older than 2 days
CREATE OR REPLACE FUNCTION public.delete_old_expired_checkins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete check-ins that are expired and older than 2 days from creation
  DELETE FROM public.checkins
  WHERE expired = true
    AND DATE(created_at) < CURRENT_DATE - INTERVAL '1 day';
END;
$$;

-- Notify user when payment verification is rejected
CREATE OR REPLACE FUNCTION public.notify_payment_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_auth_id UUID;
BEGIN
  -- Get user's auth_id
  SELECT auth_id INTO user_auth_id FROM public.users WHERE id = OLD.user_id;
  
  -- Send notification to user
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES (
    user_auth_id,
    'Payment Verification Failed',
    'Your payment for the plan could not be verified. Please contact support or try again.',
    'error',
    jsonb_build_object('checkin_id', OLD.id, 'plan_id', OLD.plan_id, 'action', 'payment_rejected')
  );
  
  RETURN OLD;
END;
$$;

-- Trigger for payment rejection notification
CREATE TRIGGER on_checkin_payment_rejected
AFTER DELETE ON public.checkins
FOR EACH ROW
WHEN (OLD.status = 'pending' AND OLD.checkin_approved = false)
EXECUTE FUNCTION public.notify_payment_rejection();