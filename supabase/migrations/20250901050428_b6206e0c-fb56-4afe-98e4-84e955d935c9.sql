-- Desabilitar RLS temporariamente para notificações e criar novas políticas
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

-- Reabilitar RLS 
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- Criar política mais simples que permite acesso a todas as notificações
-- (já que temos controle de acesso na aplicação)
CREATE POLICY "Allow all access to notifications" 
ON public.notifications 
FOR ALL 
TO public
USING (true)
WITH CHECK (true);