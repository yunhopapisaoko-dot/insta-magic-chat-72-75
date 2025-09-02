-- Remove duplicate trigger to fix notification duplication
DROP TRIGGER IF EXISTS post_like_notification_trigger ON post_likes;

-- Keep only the main trigger
-- trigger_post_like_notification should remain active