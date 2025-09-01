-- Criar tabela para rastrear visualizações de stories
CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID NOT NULL,
  user_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(story_id, user_id)
);

-- Enable RLS
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Policies para story_views
CREATE POLICY "Users can view their own story views" 
ON public.story_views 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create story views for themselves" 
ON public.story_views 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Habilitar realtime para a tabela profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Habilitar realtime para story_views também
ALTER PUBLICATION supabase_realtime ADD TABLE public.story_views;
ALTER TABLE public.story_views REPLICA IDENTITY FULL;