-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;  
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comment_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;

-- Create triggers for existing functions
DROP TRIGGER IF EXISTS like_notification_trigger ON post_likes;
CREATE TRIGGER like_notification_trigger
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_like_notification();

DROP TRIGGER IF EXISTS comment_notification_trigger ON post_comments;
CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_comment_notification();

DROP TRIGGER IF EXISTS comment_like_notification_trigger ON comment_likes;
CREATE TRIGGER comment_like_notification_trigger
  AFTER INSERT ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_comment_like_notification();