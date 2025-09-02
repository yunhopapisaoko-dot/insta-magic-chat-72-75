-- Deduplicate existing likes to avoid constraint violations
WITH ranked_post_likes AS (
  SELECT id, user_id, post_id,
         ROW_NUMBER() OVER (PARTITION BY user_id, post_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.post_likes
)
DELETE FROM public.post_likes
WHERE id IN (SELECT id FROM ranked_post_likes WHERE rn > 1);

WITH ranked_comment_likes AS (
  SELECT id, user_id, comment_id,
         ROW_NUMBER() OVER (PARTITION BY user_id, comment_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.comment_likes
)
DELETE FROM public.comment_likes
WHERE id IN (SELECT id FROM ranked_comment_likes WHERE rn > 1);

-- Clean up duplicate like/comment_like notifications caused by duplicate likes
WITH ranked_notifications AS (
  SELECT id, user_id, type, actor_id, entity_id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, type, actor_id, entity_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM public.notifications
  WHERE type IN ('like','comment_like')
)
DELETE FROM public.notifications
WHERE id IN (SELECT id FROM ranked_notifications WHERE rn > 1);

-- Add unique constraints to prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'post_likes_user_post_unique'
  ) THEN
    ALTER TABLE public.post_likes
    ADD CONSTRAINT post_likes_user_post_unique UNIQUE (user_id, post_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'comment_likes_user_comment_unique'
  ) THEN
    ALTER TABLE public.comment_likes
    ADD CONSTRAINT comment_likes_user_comment_unique UNIQUE (user_id, comment_id);
  END IF;
END$$;