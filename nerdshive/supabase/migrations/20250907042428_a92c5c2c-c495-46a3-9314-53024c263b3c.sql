-- Fix RLS policies for storage buckets to allow uploads during registration

-- Drop existing restrictive policies for customer-photos bucket
DROP POLICY IF EXISTS "Users can upload their own customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own customer photos" ON storage.objects;

-- Drop existing restrictive policies for id-proofs bucket  
DROP POLICY IF EXISTS "Users can upload their own ID proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own ID proofs" ON storage.objects;

-- Create new policies that work during registration
-- Allow authenticated users to upload to customer-photos bucket
CREATE POLICY "Allow uploads to customer-photos during registration" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'customer-photos' AND 
  auth.role() = 'authenticated'
);

-- Allow authenticated users to upload to id-proofs bucket
CREATE POLICY "Allow uploads to id-proofs during registration" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'id-proofs' AND 
  auth.role() = 'authenticated'
);

-- Allow public read access to customer photos (since bucket is public)
CREATE POLICY "Public access to customer photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'customer-photos');

-- Allow public read access to id proofs (since bucket is public)
CREATE POLICY "Public access to id proofs" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'id-proofs');