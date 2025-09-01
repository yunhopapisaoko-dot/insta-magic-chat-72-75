-- Remove duplicate triggers for like notifications
DROP TRIGGER IF EXISTS trigger_like_notification ON public.post_likes;
DROP TRIGGER IF EXISTS like_notification_trigger ON public.post_likes;

-- Keep only one trigger for like notifications
CREATE TRIGGER post_like_notification_trigger
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_like_notification();

-- Remove duplicate triggers for comment like notifications  
DROP TRIGGER IF EXISTS handle_new_comment_like_notification ON public.comment_likes;
DROP TRIGGER IF EXISTS comment_like_notification_trigger ON public.comment_likes;

-- Keep only one trigger for comment like notifications
CREATE TRIGGER comment_like_notification_trigger
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_like_notification();