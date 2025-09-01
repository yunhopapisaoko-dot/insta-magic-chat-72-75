-- Create function to create notifications for post likes
CREATE OR REPLACE FUNCTION create_post_like_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification if user is not liking their own post
  IF NEW.user_id != (SELECT user_id FROM posts WHERE id = NEW.post_id) THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      actor_id
    )
    SELECT 
      posts.user_id,
      'like',
      (SELECT display_name FROM profiles WHERE user_id = NEW.user_id) || ' curtiu seu post',
      'Alguém curtiu seu post',
      'post',
      NEW.post_id,
      NEW.user_id
    FROM posts 
    WHERE posts.id = NEW.post_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to create notifications for comments
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification if user is not commenting on their own post
  IF NEW.user_id != (SELECT user_id FROM posts WHERE id = NEW.post_id) THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      actor_id
    )
    SELECT 
      posts.user_id,
      'comment',
      (SELECT display_name FROM profiles WHERE user_id = NEW.user_id) || ' comentou em seu post',
      NEW.content,
      'post',
      NEW.post_id,
      NEW.user_id
    FROM posts 
    WHERE posts.id = NEW.post_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to create notifications for comment likes
CREATE OR REPLACE FUNCTION create_comment_like_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create notification if user is not liking their own comment
  IF NEW.user_id != (SELECT user_id FROM comments WHERE id = NEW.comment_id) THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      entity_type,
      entity_id,
      actor_id
    )
    SELECT 
      comments.user_id,
      'comment_like',
      (SELECT display_name FROM profiles WHERE user_id = NEW.user_id) || ' curtiu seu comentário',
      'Alguém curtiu seu comentário',
      'comment',
      NEW.comment_id,
      NEW.user_id
    FROM comments 
    WHERE comments.id = NEW.comment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS post_like_notification_trigger ON post_likes;
CREATE TRIGGER post_like_notification_trigger
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION create_post_like_notification();

DROP TRIGGER IF EXISTS comment_notification_trigger ON comments;
CREATE TRIGGER comment_notification_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_notification();

DROP TRIGGER IF EXISTS comment_like_notification_trigger ON comment_likes;
CREATE TRIGGER comment_like_notification_trigger
  AFTER INSERT ON comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION create_comment_like_notification();

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Enable realtime for post_likes to update likes in real time
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;

-- Enable realtime for posts to update counts in real time
ALTER PUBLICATION supabase_realtime ADD TABLE posts;