-- Fix the update_updated_at_pricing function - plans table doesn't have updated_by column
CREATE OR REPLACE FUNCTION public.update_updated_at_pricing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  -- Only set updated_by if the column exists in this specific table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = TG_TABLE_NAME 
    AND column_name = 'updated_by' 
    AND table_schema = TG_TABLE_SCHEMA
  ) THEN
    NEW.updated_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;