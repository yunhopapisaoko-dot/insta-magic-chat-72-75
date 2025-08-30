-- Fix the main RLS policy issue for stories creation
DROP POLICY IF EXISTS "Users can create their own stories" ON public.stories;

CREATE POLICY "Users can create their own stories" 
ON public.stories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);