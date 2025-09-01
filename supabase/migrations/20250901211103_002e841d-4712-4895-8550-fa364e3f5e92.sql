-- Corrigir as políticas RLS para story_views para funcionar com autenticação customizada
DROP POLICY IF EXISTS "Users can create story views for themselves" ON public.story_views;
DROP POLICY IF EXISTS "Users can view their own story views" ON public.story_views;

-- Permitir criação de visualizações de story para usuários válidos no sistema
CREATE POLICY "Allow creating story views for valid users" 
ON public.story_views 
FOR INSERT 
WITH CHECK (
  user_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = story_views.user_id
  )
);

-- Permitir visualização de story views para todos (necessário para buscar views)
CREATE POLICY "Allow viewing story views" 
ON public.story_views 
FOR SELECT 
USING (true);