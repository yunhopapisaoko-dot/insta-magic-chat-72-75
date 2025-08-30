-- Enable realtime for comment_likes table
ALTER TABLE comment_likes REPLICA IDENTITY FULL;

-- Add comment_likes to the realtime publication if not already added
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'comment_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comment_likes;
  END IF;
END $$;