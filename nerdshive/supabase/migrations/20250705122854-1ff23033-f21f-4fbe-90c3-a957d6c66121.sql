-- Fix storage bucket for government documents
UPDATE storage.buckets 
SET public = true 
WHERE id = 'id-proofs';

-- Create storage policies for id-proofs bucket
CREATE POLICY "Anyone can view ID documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'id-proofs');

CREATE POLICY "Authenticated users can upload ID documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'id-proofs' AND auth.role() = 'authenticated');

-- Add pricing section to content_sections if not exists
INSERT INTO content_sections (section, content) 
VALUES ('pricing', 'Default pricing information will go here.')
ON CONFLICT (section) DO NOTHING;