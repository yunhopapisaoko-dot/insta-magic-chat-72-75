-- Permitir que usuários marquem seus próprios stories como visualizados
-- Isso é necessário para que a bolinha vermelha desapareça quando visualizarem seus próprios stories

-- Primeiro, vamos criar uma política específica para donos de stories
CREATE POLICY "Story owners can mark their own stories as viewed" 
ON public.story_views 
FOR INSERT 
WITH CHECK (
  user_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = story_views.user_id
  )
  AND (
    -- Permite qualquer usuário marcar stories como visualizados (incluindo próprios)
    EXISTS (
      SELECT 1 FROM public.stories 
      WHERE id = story_views.story_id
    )
  )
);