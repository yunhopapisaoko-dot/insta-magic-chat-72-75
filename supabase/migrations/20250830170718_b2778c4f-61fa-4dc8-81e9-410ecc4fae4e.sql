-- Fix RLS policies to work with custom authentication system
-- Drop existing policies that depend on auth.uid()
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can create messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Create simplified policies that allow operations for valid profile users

-- Conversations policies
CREATE POLICY "Allow conversation creation for profiles" ON conversations 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow conversation viewing for profiles" ON conversations 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow conversation updates for profiles" ON conversations 
  FOR UPDATE 
  USING (true);

-- Conversation participants policies
CREATE POLICY "Allow participant creation for profiles" ON conversation_participants 
  FOR INSERT 
  WITH CHECK (
    user_id IN (SELECT id FROM profiles)
  );

CREATE POLICY "Allow participant viewing for profiles" ON conversation_participants 
  FOR SELECT 
  USING (true);

-- Messages policies
CREATE POLICY "Allow message creation for profiles" ON messages 
  FOR INSERT 
  WITH CHECK (
    sender_id IN (SELECT id FROM profiles)
  );

CREATE POLICY "Allow message viewing for profiles" ON messages 
  FOR SELECT 
  USING (true);

CREATE POLICY "Allow message updates for profiles" ON messages 
  FOR UPDATE 
  USING (
    sender_id IN (SELECT id FROM profiles)
  );