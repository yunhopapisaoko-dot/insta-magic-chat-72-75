-- Fix the security warning by setting search_path
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conversation_uuid uuid, user_uuid uuid)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM conversation_participants 
    WHERE conversation_id = conversation_uuid AND user_id = user_uuid
  );
END;
$$;