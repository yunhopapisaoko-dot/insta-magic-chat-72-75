-- Add message_type column to messages table for system messages
ALTER TABLE public.messages 
ADD COLUMN message_type TEXT DEFAULT 'user';