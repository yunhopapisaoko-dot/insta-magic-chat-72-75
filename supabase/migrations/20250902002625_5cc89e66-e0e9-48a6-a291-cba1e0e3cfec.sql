-- Check and fix duplicate triggers for post_likes notifications

-- Drop any existing triggers first to avoid duplicates
DROP TRIGGER IF EXISTS trigger_post_like_notification ON public.post_likes;
DROP TRIGGER IF EXISTS handle_like_notification_trigger ON public.post_likes;
DROP TRIGGER IF EXISTS like_notification_trigger ON public.post_likes;

-- Create a single trigger for like notifications
CREATE TRIGGER trigger_post_like_notification
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_like_notification();

-- Also ensure the update likes count trigger exists (without duplicates)
DROP TRIGGER IF EXISTS trigger_update_likes_count ON public.post_likes;
DROP TRIGGER IF EXISTS update_likes_count_trigger ON public.post_likes;

CREATE TRIGGER trigger_update_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_likes_count();