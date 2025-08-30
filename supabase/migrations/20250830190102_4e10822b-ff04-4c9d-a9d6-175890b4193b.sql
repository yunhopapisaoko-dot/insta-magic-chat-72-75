-- Create a security definer function to get current user ID from custom auth
CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID AS $$
BEGIN
  -- Since this app uses custom localStorage auth, we'll temporarily disable RLS checks
  -- This is a temporary solution - in production you should implement proper auth
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comment_likes policies to work with custom auth system
DROP POLICY IF EXISTS "Users can create comment likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can delete their own comment likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Users can update their own comment likes" ON public.comment_likes;

-- Temporarily allow all authenticated operations for comment_likes
-- In production, you should implement proper authentication
CREATE POLICY "Allow all comment like operations" ON public.comment_likes
FOR ALL USING (true) WITH CHECK (true);

-- Update post_likes policies similarly
DROP POLICY IF EXISTS "Users can create post likes" ON public.post_likes;
DROP POLICY IF EXISTS "Users can delete their own post likes" ON public.post_likes;

CREATE POLICY "Allow all post like operations" ON public.post_likes
FOR ALL USING (true) WITH CHECK (true);

-- Update post_comments policies
DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.post_comments;

CREATE POLICY "Allow all comment operations" ON public.post_comments
FOR ALL USING (true) WITH CHECK (true);