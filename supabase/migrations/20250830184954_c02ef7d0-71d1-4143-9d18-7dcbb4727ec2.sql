-- Verificar e corrigir políticas RLS para comment_likes
-- Primeiro, vamos garantir que as políticas estão corretas

-- Remover políticas existentes se houver problemas
DROP POLICY IF EXISTS "Users can create comment likes" ON comment_likes;
DROP POLICY IF EXISTS "Users can delete their own comment likes" ON comment_likes;

-- Recriar política de INSERT mais robusta
CREATE POLICY "Users can create comment likes" 
ON comment_likes 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  auth.uid() = user_id
);

-- Recriar política de DELETE mais robusta  
CREATE POLICY "Users can delete their own comment likes" 
ON comment_likes 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL AND 
  auth.uid() = user_id
);

-- Garantir que a tabela comment_likes tem RLS habilitado
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Adicionar política para UPDATE caso necessário no futuro
CREATE POLICY "Users can update their own comment likes" 
ON comment_likes 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);