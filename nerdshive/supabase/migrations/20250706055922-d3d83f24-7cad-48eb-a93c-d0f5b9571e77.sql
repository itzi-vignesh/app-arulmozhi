-- Create pricing table for dynamic plan pricing
CREATE TABLE public.pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_type TEXT NOT NULL UNIQUE CHECK (plan_type IN ('day', 'week', 'month')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  gst_rate NUMERIC NOT NULL DEFAULT 18 CHECK (gst_rate >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default pricing
INSERT INTO public.pricing (plan_type, amount, gst_rate) VALUES
  ('day', 299, 18),
  ('week', 1400, 18),
  ('month', 4600, 18);

-- Enable RLS
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;

-- Everyone can view pricing
CREATE POLICY "Everyone can view pricing" 
ON public.pricing 
FOR SELECT 
USING (true);

-- Admins and superusers can update pricing
CREATE POLICY "Admins and superusers can update pricing" 
ON public.pricing 
FOR UPDATE 
USING (is_admin(auth.uid()) OR is_superuser(auth.uid()));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_pricing()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
NEW.updated_by = auth.uid();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_pricing_updated_at
BEFORE UPDATE ON public.pricing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_pricing();