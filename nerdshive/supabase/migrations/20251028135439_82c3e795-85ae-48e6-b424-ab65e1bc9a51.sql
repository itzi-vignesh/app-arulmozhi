-- Drop and recreate the verify_payment function with better error handling
DROP FUNCTION IF EXISTS public.verify_payment(uuid, uuid);

CREATE FUNCTION public.verify_payment(p_checkin_id uuid, p_plan_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan_exists boolean;
  checkin_exists boolean;
BEGIN
  -- Check if plan exists
  SELECT EXISTS(SELECT 1 FROM public.plans WHERE id = p_plan_id) INTO plan_exists;
  IF NOT plan_exists THEN
    RETURN json_build_object('success', false, 'error', 'Plan not found');
  END IF;

  -- Check if checkin exists
  SELECT EXISTS(SELECT 1 FROM public.checkins WHERE id = p_checkin_id) INTO checkin_exists;
  IF NOT checkin_exists THEN
    RETURN json_build_object('success', false, 'error', 'Check-in not found');
  END IF;

  -- Update the plan
  UPDATE public.plans 
  SET payment_verified = true,
      updated_at = now()
  WHERE id = p_plan_id;

  -- Update the checkin
  UPDATE public.checkins 
  SET payment_status = 'verified',
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = p_checkin_id;

  -- Return success
  RETURN json_build_object('success', true, 'message', 'Payment verified successfully');
  
EXCEPTION 
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.verify_payment(uuid, uuid) TO authenticated;