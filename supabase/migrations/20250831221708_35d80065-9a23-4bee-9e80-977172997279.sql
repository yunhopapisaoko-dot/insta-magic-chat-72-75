-- Drop ALL policies from conversations and conversation_participants
DROP POLICY IF EXISTS "Public conversations visible to all" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their private conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Creators can update conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view participants in public conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_participants;

-- Turn off RLS temporarily to reset
ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Create a simple security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conversation_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = conversation_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Simple policies for conversations
CREATE POLICY "conversations_select_policy" 
ON public.conversations 
FOR SELECT 
USING (
  is_public = true OR 
  public.is_conversation_participant(id, auth.uid())
);

CREATE POLICY "conversations_insert_policy" 
ON public.conversations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "conversations_update_policy" 
ON public.conversations 
FOR UPDATE 
USING (creator_id = auth.uid());

-- Simple policies for conversation_participants
CREATE POLICY "participants_select_policy" 
ON public.conversation_participants 
FOR SELECT 
USING (true);

CREATE POLICY "participants_insert_policy" 
ON public.conversation_participants 
FOR INSERT 
WITH CHECK (true);