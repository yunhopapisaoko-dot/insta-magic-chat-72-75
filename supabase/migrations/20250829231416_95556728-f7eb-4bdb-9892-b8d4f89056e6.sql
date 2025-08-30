-- Ajustar políticas RLS para permitir publicação e leitura
-- Primeiro, garantir que existe a política de inserção correta
DROP POLICY IF EXISTS "Users can create their own stories" ON public.stories;

-- Permitir leitura pública de stories não expirados
CREATE POLICY "Public can view non-expired stories" 
ON public.stories 
FOR SELECT 
USING (expires_at > now());

-- Política para criação de stories
CREATE POLICY "Enable story creation for all users" 
ON public.stories 
FOR INSERT 
WITH CHECK (true);