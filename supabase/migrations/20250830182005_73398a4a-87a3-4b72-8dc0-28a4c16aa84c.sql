-- Drop existing policies for post_comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can view comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;

-- Create new policies that allow proper access
CREATE POLICY "Anyone can view comments" 
ON public.post_comments 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create comments" 
ON public.post_comments 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own comments" 
ON public.post_comments 
FOR DELETE 
USING (auth.uid() = user_id);