-- Create notification function for comment replies
CREATE OR REPLACE FUNCTION public.handle_comment_reply_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  parent_comment_owner_id UUID;
  replier_name TEXT;
  comment_content TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
    -- Get parent comment owner and replier info
    SELECT c.user_id, LEFT(NEW.content, 50) INTO parent_comment_owner_id, comment_content
    FROM post_comments c WHERE c.id = NEW.parent_comment_id;
    
    SELECT pr.display_name INTO replier_name
    FROM profiles pr WHERE pr.id = NEW.user_id;
    
    -- Don't notify if user replies to their own comment
    IF parent_comment_owner_id != NEW.user_id THEN
      PERFORM create_notification(
        parent_comment_owner_id,
        'comment_reply',
        'Nova resposta',
        replier_name || ' respondeu seu comentário: "' || comment_content || '..."',
        'comment',
        NEW.id,
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger for comment reply notifications
CREATE TRIGGER comment_reply_notification_trigger
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_comment_reply_notification();

-- Create notification function for user mentions in comments
CREATE OR REPLACE FUNCTION public.handle_comment_mention_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  mentioned_username TEXT;
  mentioned_user_id UUID;
  mentioner_name TEXT;
  comment_content TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.content LIKE '%@%' THEN
    -- Extract username from @mentions in content
    -- This is a simple implementation - in production you'd want more robust parsing
    FOR mentioned_username IN 
      SELECT DISTINCT regexp_replace(unnest(regexp_split_to_array(NEW.content, '@')), '^([a-zA-Z0-9_]+).*', '\1') 
      WHERE LENGTH(regexp_replace(unnest(regexp_split_to_array(NEW.content, '@')), '^([a-zA-Z0-9_]+).*', '\1')) > 0
    LOOP
      -- Find the mentioned user
      SELECT id INTO mentioned_user_id
      FROM profiles 
      WHERE LOWER(display_name) LIKE LOWER('%' || mentioned_username || '%') 
         OR LOWER(username) LIKE LOWER('%' || mentioned_username || '%')
      LIMIT 1;
      
      IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
        -- Get mentioner info
        SELECT pr.display_name INTO mentioner_name
        FROM profiles pr WHERE pr.id = NEW.user_id;
        
        SELECT LEFT(NEW.content, 50) INTO comment_content;
        
        -- Create mention notification
        PERFORM create_notification(
          mentioned_user_id,
          'comment_mention',
          'Você foi mencionado',
          mentioner_name || ' mencionou você em um comentário: "' || comment_content || '..."',
          'comment',
          NEW.id,
          NEW.user_id
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger for comment mention notifications
CREATE TRIGGER comment_mention_notification_trigger
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_comment_mention_notification();