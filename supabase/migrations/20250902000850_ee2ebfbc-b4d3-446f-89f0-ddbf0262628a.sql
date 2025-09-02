-- Fix notification types constraint to allow comment_like
ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'follow'::text, 'mention'::text, 'comment_like'::text]));