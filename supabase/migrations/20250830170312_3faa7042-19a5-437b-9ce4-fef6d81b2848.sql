-- Políticas RLS para permitir conversas
-- Remove políticas existentes que podem estar conflitando
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can create messages" ON messages;
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;

-- Permite que usuários autenticados criem conversas
CREATE POLICY "Authenticated users can create conversations" ON conversations 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Permite que usuários vejam conversas onde são participantes
CREATE POLICY "Users can view their conversations" ON conversations 
  FOR SELECT 
  TO authenticated 
  USING (
    id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Permite que usuários atualizem conversas onde são participantes
CREATE POLICY "Users can update their conversations" ON conversations 
  FOR UPDATE 
  TO authenticated 
  USING (
    id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Políticas para conversation_participants
CREATE POLICY "Authenticated users can create participants" ON conversation_participants 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "Users can view participants of their conversations" ON conversation_participants 
  FOR SELECT 
  TO authenticated 
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Políticas para messages
CREATE POLICY "Authenticated users can create messages" ON messages 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view messages from their conversations" ON messages 
  FOR SELECT 
  TO authenticated 
  USING (
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own messages" ON messages 
  FOR UPDATE 
  TO authenticated 
  USING (sender_id = auth.uid());