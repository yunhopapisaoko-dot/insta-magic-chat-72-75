-- Retry: finalize non-recursive policies with correct syntax
-- Ensure helper function remains correct
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conversation_uuid uuid, user_uuid uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = conversation_uuid AND user_id = user_uuid
  );
END;
$$;

-- Create conversations SELECT policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'conversations_select_non_recursive'
  ) THEN
    EXECUTE 'CREATE POLICY "conversations_select_non_recursive" ON public.conversations FOR SELECT USING (is_public = true OR public.is_conversation_participant(id, auth.uid()))';
  END IF;
END $$;