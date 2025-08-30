-- Enable realtime for stories table
ALTER TABLE public.stories REPLICA IDENTITY FULL;

-- Add stories table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;