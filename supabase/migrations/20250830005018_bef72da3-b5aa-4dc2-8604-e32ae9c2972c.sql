-- Fix RLS policy for public_chat_messages to work with custom auth system
-- Drop the existing policy that checks auth.uid()
DROP POLICY IF EXISTS "Authenticated users can send public chat messages" ON public_chat_messages;

-- Create new policy that checks if sender_id exists in profiles table
CREATE POLICY "Users can send public chat messages" 
ON public_chat_messages 
FOR INSERT 
WITH CHECK (
  sender_id IS NOT NULL AND 
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = sender_id)
);