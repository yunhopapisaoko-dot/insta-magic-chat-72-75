-- Enable real-time updates for the story_views table
ALTER TABLE public.story_views REPLICA IDENTITY FULL;

-- Add the story_views table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;