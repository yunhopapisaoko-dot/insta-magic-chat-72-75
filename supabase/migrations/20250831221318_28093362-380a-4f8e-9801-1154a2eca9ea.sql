-- Add creator_id to conversations table to track chat owners
ALTER TABLE public.conversations 
ADD COLUMN creator_id uuid REFERENCES profiles(id);

-- Add is_public column to mark public chats
ALTER TABLE public.conversations 
ADD COLUMN is_public boolean DEFAULT false;

-- Add chat metadata columns
ALTER TABLE public.conversations 
ADD COLUMN name text,
ADD COLUMN description text,
ADD COLUMN photo_url text;

-- Update RLS policies for conversations
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON public.conversations;

-- Allow viewing public conversations or conversations user participates in
CREATE POLICY "Users can view public conversations or their own" 
ON public.conversations 
FOR SELECT 
USING (
  is_public = true OR 
  id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

-- Only creators can update public conversations, participants can update private ones
CREATE POLICY "Creators can update public chats, participants can update private chats" 
ON public.conversations 
FOR UPDATE 
USING (
  (is_public = true AND creator_id = auth.uid()) OR 
  (is_public = false AND id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  ))
);

-- Anyone can create conversations
CREATE POLICY "Anyone can create conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (true);

-- Update conversation_participants policies for public chats
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;

-- Allow viewing participants of public chats or chats user is in
CREATE POLICY "Users can view participants of public chats or their own chats" 
ON public.conversation_participants 
FOR SELECT 
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE is_public = true
  ) OR 
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants cp2 
    WHERE cp2.user_id = auth.uid()
  )
);

-- Anyone can join public chats, only participants can add to private chats
CREATE POLICY "Users can join public chats or be added to private chats" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (
  conversation_id IN (
    SELECT id FROM conversations WHERE is_public = true
  ) OR 
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants cp2 
    WHERE cp2.user_id = auth.uid()
  )
);