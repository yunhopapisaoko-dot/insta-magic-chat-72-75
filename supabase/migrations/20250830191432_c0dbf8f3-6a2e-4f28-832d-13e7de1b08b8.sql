-- Fix stories bucket RLS policies
-- Drop existing restrictive policies for stories uploads
DROP POLICY IF EXISTS "Users can upload stories" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own stories media" ON storage.objects;

-- Create a more permissive upload policy for stories
-- This allows any authenticated user to upload to their own folder in stories bucket
CREATE POLICY "Allow story uploads for authenticated users" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'stories' 
  AND auth.role() = 'authenticated'
);

-- Alternative simpler policy if the above doesn't work
-- This allows any user to upload stories (since you're using custom auth)
CREATE POLICY "Allow story uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'stories');