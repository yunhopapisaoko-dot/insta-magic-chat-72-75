-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  entity_type TEXT,
  entity_id UUID,
  actor_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Add trigger for timestamps
CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id, type, title, message, entity_type, entity_id, actor_id
  ) VALUES (
    p_user_id, p_type, p_title, p_message, p_entity_type, p_entity_id, p_actor_id
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger function for like notifications
CREATE OR REPLACE FUNCTION public.handle_like_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id UUID;
  liker_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Get post owner and liker info
    SELECT p.user_id INTO post_owner_id
    FROM posts p WHERE p.id = NEW.post_id;
    
    SELECT pr.display_name INTO liker_name
    FROM profiles pr WHERE pr.id = NEW.user_id;
    
    -- Don't notify if user likes their own post
    IF post_owner_id != NEW.user_id THEN
      PERFORM create_notification(
        post_owner_id,
        'like',
        'Nova curtida',
        liker_name || ' curtiu seu post',
        'post',
        NEW.post_id,
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function for follow notifications
CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT pr.display_name INTO follower_name
    FROM profiles pr WHERE pr.id = NEW.follower_id;
    
    PERFORM create_notification(
      NEW.following_id,
      'follow',
      'Novo seguidor',
      follower_name || ' começou a te seguir',
      'user',
      NEW.follower_id,
      NEW.follower_id
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_like_notification
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION handle_like_notification();

CREATE TRIGGER trigger_follow_notification
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION handle_follow_notification();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;