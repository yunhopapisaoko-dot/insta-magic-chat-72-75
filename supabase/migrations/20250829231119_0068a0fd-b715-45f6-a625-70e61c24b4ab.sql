-- Verificar e corrigir as políticas RLS da tabela stories
-- O problema é que o usuário não consegue ver seus próprios stories após criar

-- Primeiro, dropar a política existente que pode estar causando o problema
DROP POLICY IF EXISTS "Users can view stories from people they follow and their own" ON public.stories;

-- Criar uma política mais clara para visualizar stories próprios
CREATE POLICY "Users can view their own stories" 
ON public.stories 
FOR SELECT 
USING (
  expires_at > now() 
  AND user_id = auth.uid()
);

-- Criar uma política separada para ver stories de pessoas que seguem
CREATE POLICY "Users can view stories from followed users" 
ON public.stories 
FOR SELECT 
USING (
  expires_at > now() 
  AND user_id IN (
    SELECT following_id 
    FROM public.follows 
    WHERE follower_id = auth.uid()
  )
);

-- Garantir que a política de inserção esteja correta
DROP POLICY IF EXISTS "Enable story creation for all users" ON public.stories;

CREATE POLICY "Users can create their own stories" 
ON public.stories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Manter a política de delete
-- (já existe: "Users can delete their own stories")