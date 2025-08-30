-- Create public chat messages table
CREATE TABLE public.public_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.public_chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for public chat
CREATE POLICY "Anyone can view public messages" 
ON public.public_chat_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create public messages" 
ON public.public_chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_public_chat_messages_updated_at
BEFORE UPDATE ON public.public_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();