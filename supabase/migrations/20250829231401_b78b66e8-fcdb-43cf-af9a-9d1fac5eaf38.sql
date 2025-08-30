-- Ajustar políticas RLS para permitir publicação e leitura enquanto a autenticação não está ativa
-- Remover políticas anteriores específicas que dependiam de auth.uid()
DROP POLICY IF EXISTS "Users can view their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view stories from followed users" ON public.stories;

-- Permitir leitura pública de stories não expirados (temporário até ativarmos auth)
CREATE POLICY "Public can view non-expired stories" 
ON public.stories 
FOR SELECT 
USING (expires_at > now());

-- Reativar política permissiva de inserção (temporária)
CREATE POLICY IF NOT EXISTS "Enable story creation for all users" 
ON public.stories 
FOR INSERT 
WITH CHECK (true);
