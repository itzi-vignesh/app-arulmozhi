-- Add payment status tracking to checkins
ALTER TABLE public.checkins 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_rejection_date timestamp with time zone;

-- Update the delete_old_expired_checkins function to also handle rejected payments after 2 days
CREATE OR REPLACE FUNCTION public.delete_old_expired_checkins()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete check-ins that are expired and older than 1 day from creation
  DELETE FROM public.checkins
  WHERE expired = true
    AND DATE(created_at) < CURRENT_DATE - INTERVAL '1 day';
  
  -- Delete check-ins with rejected payment older than 2 days
  DELETE FROM public.checkins
  WHERE payment_status = 'rejected'
    AND payment_rejection_date IS NOT NULL
    AND payment_rejection_date < NOW() - INTERVAL '2 days';
END;
$function$;

-- Update notify_payment_rejection to only trigger when payment_status changes to rejected
DROP TRIGGER IF EXISTS on_checkin_payment_rejected ON public.checkins;

CREATE TRIGGER on_checkin_payment_status_rejected
  AFTER UPDATE ON public.checkins
  FOR EACH ROW
  WHEN (OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'rejected')
  EXECUTE FUNCTION public.notify_payment_rejection();