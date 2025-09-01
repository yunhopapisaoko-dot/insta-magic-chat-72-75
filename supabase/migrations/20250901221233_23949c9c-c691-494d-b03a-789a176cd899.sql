-- Add replied_to_message_id column to messages table for message replies
ALTER TABLE public.messages 
ADD COLUMN replied_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

-- Add index for better performance when querying replied messages
CREATE INDEX idx_messages_replied_to ON public.messages(replied_to_message_id);