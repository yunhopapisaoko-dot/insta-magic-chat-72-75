-- Enable realtime for conversations table
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Add conversations table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;