-- Corrigir as políticas RLS para public_chat_messages
-- Primeiro, remover as políticas existentes
DROP POLICY IF EXISTS "Anyone can view public messages" ON public_chat_messages;
DROP POLICY IF EXISTS "Authenticated users can create public messages" ON public_chat_messages;

-- Criar novas políticas mais permissivas
CREATE POLICY "Anyone can view public chat messages" 
ON public_chat_messages 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can send public chat messages" 
ON public_chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Também corrigir o problema de recursão infinita na tabela conversation_participants
-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations they're in" ON conversation_participants;

-- Criar políticas mais simples para conversation_participants
CREATE POLICY "Users can view conversation participants" 
ON conversation_participants 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add participants" 
ON conversation_participants 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);