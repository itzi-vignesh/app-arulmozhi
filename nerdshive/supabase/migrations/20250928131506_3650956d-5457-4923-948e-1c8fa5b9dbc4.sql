-- Fix trigger to fire on plans table instead of usage_logs
DROP TRIGGER IF EXISTS on_plan_booked ON public.usage_logs;

-- Create new trigger on plans table  
CREATE TRIGGER on_plan_purchased
  AFTER INSERT ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.log_plan_activity();

-- Also ensure we have the trigger on checkins table for activity logging
DROP TRIGGER IF EXISTS on_checkin_activity ON public.checkins;
CREATE TRIGGER on_checkin_activity
  AFTER INSERT OR UPDATE ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.log_checkin_activity();