-- Check and fix existing stories storage policies
-- First, let's see what policies exist and clean them up properly

-- Drop existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Allow story uploads for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow story uploads" ON storage.objects; 

-- Create a simple policy that allows any user to upload stories
-- This bypasses the auth.uid() requirement since your app uses custom auth
CREATE POLICY "Stories uploads allowed" 
ON storage.objects 
FOR INSERT 
TO public
WITH CHECK (bucket_id = 'stories');