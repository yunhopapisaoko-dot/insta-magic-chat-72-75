-- Enable realtime for messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Add messages table to realtime publication
-- This will enable real-time updates for messages
-- The publication is automatically created by Supabase