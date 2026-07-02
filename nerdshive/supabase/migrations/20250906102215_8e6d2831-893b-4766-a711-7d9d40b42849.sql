-- Add customer photo URL field to users table
ALTER TABLE public.users ADD COLUMN customer_photo_url text;

-- Create storage bucket for customer photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('customer-photos', 'customer-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Add RLS policies for customer photos bucket
CREATE POLICY "Users can view customer photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'customer-photos');

CREATE POLICY "Users can upload their own customer photo" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'customer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);