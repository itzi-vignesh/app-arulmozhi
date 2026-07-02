-- Fix function search path for security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;