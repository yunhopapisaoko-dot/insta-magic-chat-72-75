-- Habilitar realtime para a tabela post_comments
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;