-- Fix storage access for admins and superusers
-- Add explicit SELECT policies for customer-photos bucket
CREATE POLICY "Admins and superusers can view all customer photos" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'customer-photos' 
  AND (is_admin(auth.uid()) OR is_superuser(auth.uid()))
);

-- Add explicit SELECT policies for id-proofs bucket  
CREATE POLICY "Admins and superusers can view all ID proofs" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'id-proofs' 
  AND (is_admin(auth.uid()) OR is_superuser(auth.uid()))
);