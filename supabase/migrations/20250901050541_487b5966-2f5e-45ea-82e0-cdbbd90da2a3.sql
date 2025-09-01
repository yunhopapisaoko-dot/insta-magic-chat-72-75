-- Atualizar políticas RLS para stories para funcionar com autenticação customizada
DROP POLICY IF EXISTS "Users can delete their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view their own stories" ON public.stories;
DROP POLICY IF EXISTS "Users can view stories from followed users" ON public.stories;

-- Criar políticas mais simples que permitem acesso baseado na aplicação
CREATE POLICY "Allow all story operations" 
ON public.stories 
FOR ALL 
TO public
USING (true)
WITH CHECK (true);