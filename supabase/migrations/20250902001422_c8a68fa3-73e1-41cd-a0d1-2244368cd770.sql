-- Fix notification types constraint to allow story_tag, post_tag, comment_reply, comment_mention
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'follow'::text, 'mention'::text, 'comment_like'::text, 'story_tag'::text, 'post_tag'::text, 'comment_reply'::text, 'comment_mention'::text]));