-- Fix RLS policy for stories INSERT to allow proper story creation
DROP POLICY IF EXISTS "Users can create their own stories" ON public.stories;

CREATE POLICY "Users can create their own stories" 
ON public.stories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Also ensure storage policies for stories bucket allow authenticated users to upload
-- Create policies for stories storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to stories bucket
CREATE POLICY "Users can upload stories" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view story files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'stories');

CREATE POLICY "Users can delete their own story files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'stories' AND auth.uid()::text = (storage.foldername(name))[1]);