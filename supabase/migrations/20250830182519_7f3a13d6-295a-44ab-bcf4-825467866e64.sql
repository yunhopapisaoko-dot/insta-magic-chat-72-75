-- Ajustar política de comentários para trabalhar com o sistema de auth personalizado
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.post_comments;

CREATE POLICY "Anyone can create comments with valid user_id" 
ON public.post_comments 
FOR INSERT 
WITH CHECK (
  user_id IS NOT NULL AND 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id)
);