-- Create trigger for story tag notifications
CREATE TRIGGER story_tag_notification_trigger
  AFTER INSERT ON public.story_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_story_tag_notification();