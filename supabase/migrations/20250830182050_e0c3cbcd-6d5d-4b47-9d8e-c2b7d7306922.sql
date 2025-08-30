-- Corrigir a política de INSERT para post_comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.post_comments;

CREATE POLICY "Authenticated users can create comments" 
ON public.post_comments 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);