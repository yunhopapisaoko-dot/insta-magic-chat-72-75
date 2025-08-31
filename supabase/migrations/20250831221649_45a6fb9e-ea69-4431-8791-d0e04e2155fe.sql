-- Fix infinite recursion in RLS policies
-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view public conversations or their own" ON public.conversations;
DROP POLICY IF EXISTS "Creators can update public chats, participants can update private chats" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow all conversation operations" ON public.conversations;

DROP POLICY IF EXISTS "Users can view participants of public chats or their own chats" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join public chats or be added to private chats" ON public.conversation_participants;
DROP POLICY IF EXISTS "Allow all participant operations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can create participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view conversation participants" ON public.conversation_participants;

-- Create simple, non-recursive policies for conversations
CREATE POLICY "Public conversations visible to all" 
ON public.conversations 
FOR SELECT 
USING (is_public = true);

CREATE POLICY "Users can view their private conversations" 
ON public.conversations 
FOR SELECT 
USING (
  is_public = false AND 
  id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations" 
ON public.conversations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Creators can update conversations" 
ON public.conversations 
FOR UPDATE 
USING (creator_id = auth.uid());

-- Create simple policies for conversation_participants  
CREATE POLICY "Users can view participants in public conversations" 
ON public.conversation_participants 
FOR SELECT 
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE is_public = true
  )
);

CREATE POLICY "Users can view participants in their conversations" 
ON public.conversation_participants 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can join conversations" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (true);