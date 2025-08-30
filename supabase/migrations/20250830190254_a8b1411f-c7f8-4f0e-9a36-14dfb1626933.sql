-- Tighten comment_likes policies to work with custom (non-Supabase) auth while remaining safe
-- Remove overly permissive policy if it exists
DROP POLICY IF EXISTS "Allow all comment like operations" ON public.comment_likes;

-- Keep/ensure read access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'comment_likes' AND policyname = 'Anyone can view comment likes'
  ) THEN
    CREATE POLICY "Anyone can view comment likes"
    ON public.comment_likes
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Allow inserts if the provided user_id exists in profiles and comment exists
DROP POLICY IF EXISTS "Users can create comment likes" ON public.comment_likes;
CREATE POLICY "Anyone can create comment likes with valid user and comment"
ON public.comment_likes
FOR INSERT
WITH CHECK (
  user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = comment_likes.user_id)
  AND EXISTS (SELECT 1 FROM public.post_comments c WHERE c.id = comment_likes.comment_id)
);

-- Allow deletes when the like row's user_id is a valid profile (the app filters by user_id in the query)
DROP POLICY IF EXISTS "Users can delete their own comment likes" ON public.comment_likes;
CREATE POLICY "Allow deleting comment likes with valid user_id"
ON public.comment_likes
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = comment_likes.user_id)
);

-- Remove update policy (not needed). If exists, drop it
DROP POLICY IF EXISTS "Users can update their own comment likes" ON public.comment_likes;