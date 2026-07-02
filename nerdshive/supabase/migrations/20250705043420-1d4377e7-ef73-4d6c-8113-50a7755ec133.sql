-- Create storage bucket policy for id-proofs
CREATE POLICY "Allow authenticated users to upload their own files"
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'id-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to view their own files"
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'id-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow admins to view all files"
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'id-proofs' AND (
  EXISTS (SELECT 1 FROM public.admins WHERE auth_id = auth.uid()) OR 
  EXISTS (SELECT 1 FROM public.superuser WHERE auth_id = auth.uid())
));