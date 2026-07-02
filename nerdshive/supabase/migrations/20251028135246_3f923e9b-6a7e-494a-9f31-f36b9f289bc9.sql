-- Create a secure RPC to verify payment atomically
CREATE OR REPLACE FUNCTION public.verify_payment(p_checkin_id uuid, p_plan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the plan payment
  UPDATE public.plans 
  SET payment_verified = true,
      updated_at = now()
  WHERE id = p_plan_id;

  -- Mark the related checkin as payment verified
  UPDATE public.checkins 
  SET payment_status = 'verified',
      updated_at = now()
  WHERE id = p_checkin_id;
END;
$$;

-- Allow authenticated users to call it (RLS still applies inside as per privileges of function owner)
GRANT EXECUTE ON FUNCTION public.verify_payment(uuid, uuid) TO authenticated;