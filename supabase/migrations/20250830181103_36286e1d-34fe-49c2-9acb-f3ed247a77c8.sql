-- Fix the RLS policy for post_comments to allow authenticated users to create comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.post_comments;

CREATE POLICY "Authenticated users can create comments" 
ON public.post_comments 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);