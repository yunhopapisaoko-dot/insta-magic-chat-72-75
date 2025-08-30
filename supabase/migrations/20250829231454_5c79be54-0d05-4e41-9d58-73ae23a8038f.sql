-- Limpar e recriar as políticas RLS corretamente
DROP POLICY IF EXISTS "Public can view non-expired stories" ON public.stories;
DROP POLICY IF EXISTS "Enable story creation for all users" ON public.stories;

-- Política para leitura de stories não expirados
CREATE POLICY "Public can view non-expired stories" 
ON public.stories 
FOR SELECT 
USING (expires_at > now());

-- Política para criação de stories
CREATE POLICY "Enable story creation for all users" 
ON public.stories 
FOR INSERT 
WITH CHECK (true);