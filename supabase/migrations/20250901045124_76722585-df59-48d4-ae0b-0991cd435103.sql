-- Função para criar notificação de marcação em post
CREATE OR REPLACE FUNCTION public.handle_post_tag_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tagger_name TEXT;
  post_content TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Pegar informações do marcador e do post
    SELECT pr.display_name INTO tagger_name
    FROM profiles pr WHERE pr.id = NEW.tagged_by;
    
    SELECT LEFT(p.content, 50) INTO post_content
    FROM posts p WHERE p.id = NEW.post_id;
    
    -- Não notificar se a pessoa marcou ela mesma
    IF NEW.user_id != NEW.tagged_by THEN
      PERFORM create_notification(
        NEW.user_id,
        'post_tag',
        'Você foi marcado',
        tagger_name || ' marcou você em um post: "' || COALESCE(post_content, 'post com imagem') || '..."',
        'post',
        NEW.post_id,
        NEW.tagged_by
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Função para criar notificação de marcação em story  
CREATE OR REPLACE FUNCTION public.handle_story_tag_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tagger_name TEXT;
  story_content TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Pegar informações do marcador e do story
    SELECT pr.display_name INTO tagger_name
    FROM profiles pr WHERE pr.id = NEW.tagged_by;
    
    SELECT LEFT(s.content, 50) INTO story_content
    FROM stories s WHERE s.id = NEW.story_id;
    
    -- Não notificar se a pessoa marcou ela mesma
    IF NEW.user_id != NEW.tagged_by THEN
      PERFORM create_notification(
        NEW.user_id,
        'story_tag', 
        'Você foi marcado',
        tagger_name || ' marcou você em um story' || CASE WHEN story_content IS NOT NULL THEN ': "' || story_content || '..."' ELSE '' END,
        'story',
        NEW.story_id,
        NEW.tagged_by
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar triggers para notificações
CREATE TRIGGER post_tag_notification_trigger
  AFTER INSERT ON post_tags
  FOR EACH ROW EXECUTE FUNCTION handle_post_tag_notification();

CREATE TRIGGER story_tag_notification_trigger  
  AFTER INSERT ON story_tags
  FOR EACH ROW EXECUTE FUNCTION handle_story_tag_notification();