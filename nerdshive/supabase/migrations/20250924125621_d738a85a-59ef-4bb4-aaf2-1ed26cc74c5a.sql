-- Add missing updated_by column to checkins table
ALTER TABLE public.checkins ADD COLUMN updated_by uuid;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_checkins_updated_at ON public.checkins;

-- Create trigger function for checkins table
CREATE OR REPLACE FUNCTION public.update_updated_at_checkins()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger for checkins table
CREATE TRIGGER update_checkins_updated_at
  BEFORE UPDATE ON public.checkins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_checkins();