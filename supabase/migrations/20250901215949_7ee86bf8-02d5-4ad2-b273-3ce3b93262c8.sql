-- Add parent_comment_id to post_comments table for threaded replies
ALTER TABLE public.post_comments 
ADD COLUMN parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- Create index for better performance when fetching threaded comments
CREATE INDEX idx_post_comments_parent ON public.post_comments(parent_comment_id);
CREATE INDEX idx_post_comments_post_parent ON public.post_comments(post_id, parent_comment_id);

-- Update RLS policies to handle replies
DROP POLICY IF EXISTS "Anyone can create comments with valid user_id" ON public.post_comments;
CREATE POLICY "Anyone can create comments with valid user_id" 
ON public.post_comments 
FOR INSERT 
WITH CHECK (
  (user_id IS NOT NULL) AND 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = post_comments.user_id)) AND
  -- If it's a reply, make sure parent comment exists and belongs to same post
  (parent_comment_id IS NULL OR EXISTS (
    SELECT 1 FROM post_comments pc 
    WHERE pc.id = post_comments.parent_comment_id 
    AND pc.post_id = post_comments.post_id
  ))
);