-- Create notification triggers (idempotent drops then creates)
DROP TRIGGER IF EXISTS like_notification_trigger ON public.post_likes;
CREATE TRIGGER like_notification_trigger
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_like_notification();

DROP TRIGGER IF EXISTS comment_notification_trigger ON public.post_comments;
CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_notification();

DROP TRIGGER IF EXISTS comment_like_notification_trigger ON public.comment_likes;
CREATE TRIGGER comment_like_notification_trigger
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_like_notification();