-- Create trigger for comment notifications
CREATE OR REPLACE FUNCTION public.handle_comment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  post_owner_id UUID;
  commenter_name TEXT;
  post_content TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get post owner and commenter info
    SELECT p.user_id, LEFT(p.content, 50) INTO post_owner_id, post_content
    FROM posts p WHERE p.id = NEW.post_id;
    
    SELECT pr.display_name INTO commenter_name
    FROM profiles pr WHERE pr.id = NEW.user_id;
    
    -- Don't notify if user comments on their own post
    IF post_owner_id != NEW.user_id THEN
      PERFORM create_notification(
        post_owner_id,
        'comment',
        'Novo comentário',
        commenter_name || ' comentou em seu post: "' || post_content || '..."',
        'post',
        NEW.post_id,
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger for comment like notifications
CREATE OR REPLACE FUNCTION public.handle_comment_like_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  comment_owner_id UUID;
  liker_name TEXT;
  comment_content TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get comment owner and liker info
    SELECT c.user_id, LEFT(c.content, 50) INTO comment_owner_id, comment_content
    FROM post_comments c WHERE c.id = NEW.comment_id;
    
    SELECT pr.display_name INTO liker_name
    FROM profiles pr WHERE pr.id = NEW.user_id;
    
    -- Don't notify if user likes their own comment
    IF comment_owner_id != NEW.user_id THEN
      PERFORM create_notification(
        comment_owner_id,
        'comment_like',
        'Curtida em comentário',
        liker_name || ' curtiu seu comentário: "' || comment_content || '..."',
        'comment',
        NEW.comment_id,
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create triggers
CREATE TRIGGER handle_new_comment_notification
  AFTER INSERT ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_notification();

CREATE TRIGGER handle_new_comment_like_notification
  AFTER INSERT ON public.comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_comment_like_notification();