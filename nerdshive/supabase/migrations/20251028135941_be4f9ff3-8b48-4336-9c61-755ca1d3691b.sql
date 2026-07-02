-- Check if the update_updated_at_checkins trigger is causing the issue by trying to access updated_by
-- Let's update the trigger function to handle the missing updated_by field gracefully

CREATE OR REPLACE FUNCTION public.update_updated_at_checkins()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  -- Only set updated_by if the column exists and auth.uid() is available
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'checkins' 
    AND column_name = 'updated_by' 
    AND table_schema = 'public'
  ) THEN
    NEW.updated_by = COALESCE(auth.uid(), OLD.updated_by);
  END IF;
  RETURN NEW;
END;
$$;