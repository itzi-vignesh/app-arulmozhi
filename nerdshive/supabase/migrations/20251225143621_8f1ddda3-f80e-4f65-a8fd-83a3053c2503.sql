-- Add new columns for bulk enrollment and extended user profile
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS joining_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS requires_parking BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_type TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_brand_model TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_color TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vehicle_registration TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS customer_id TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS enrollment_source TEXT DEFAULT 'self_registered';

-- Create sequence for customer ID generation
CREATE SEQUENCE IF NOT EXISTS customer_id_seq START WITH 1;

-- Create function to generate customer ID
CREATE OR REPLACE FUNCTION generate_customer_id()
RETURNS TEXT AS $$
DECLARE
  next_val INTEGER;
  year_str TEXT;
BEGIN
  next_val := nextval('customer_id_seq');
  year_str := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  RETURN 'NH-' || year_str || '-' || LPAD(next_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON COLUMN public.users.duration IS 'permanent or temporary';
COMMENT ON COLUMN public.users.enrollment_source IS 'self_registered, bulk_enrolled, or admin_created';