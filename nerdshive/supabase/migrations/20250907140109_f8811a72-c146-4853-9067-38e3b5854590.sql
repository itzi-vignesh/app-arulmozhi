-- Make buckets private and implement secure RLS policies
UPDATE storage.buckets 
SET public = false 
WHERE id IN ('customer-photos', 'id-proofs');

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Public can view customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view ID proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload customer photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload ID proofs" ON storage.objects;

-- Create secure RLS policies for customer-photos bucket
CREATE POLICY "Users can upload their own customer photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'customer-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own customer photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'customer-photos' AND 
    (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()) OR is_superuser(auth.uid()))
  );

CREATE POLICY "Users can update their own customer photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'customer-photos' AND 
    (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()) OR is_superuser(auth.uid()))
  );

CREATE POLICY "Users can delete their own customer photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'customer-photos' AND 
    (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()) OR is_superuser(auth.uid()))
  );

-- Create secure RLS policies for id-proofs bucket
CREATE POLICY "Users can upload their own ID proofs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'id-proofs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own ID proofs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'id-proofs' AND 
    (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()) OR is_superuser(auth.uid()))
  );

CREATE POLICY "Users can update their own ID proofs" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'id-proofs' AND 
    (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()) OR is_superuser(auth.uid()))
  );

CREATE POLICY "Users can delete their own ID proofs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'id-proofs' AND 
    (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid()) OR is_superuser(auth.uid()))
  );