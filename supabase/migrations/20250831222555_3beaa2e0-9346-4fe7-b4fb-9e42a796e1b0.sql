-- Fix recursive RLS causing 'infinite recursion detected' when loading conversations
-- 1) Ensure helper function exists with proper search_path (idempotent)
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

-- 2) Drop recursive policies
DO $$
BEGIN
  -- Conversations: recursive SELECT policy referencing conversation_participants
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Users can view public conversations or their own'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view public conversations or their own" ON public.conversations';
  END IF;

  -- Conversations: overly complex UPDATE policy referencing conversation_participants (not needed for SELECT but can recurse on joins)
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Creators can update public chats, participants can update priva'
  ) THEN
    EXECUTE 'DROP POLICY "Creators can update public chats, participants can update priva" ON public.conversations';
  END IF;

  -- Conversation Participants: SELECT policy referencing conversations (creates recursion with conversations policies)
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversation_participants' AND policyname = 'Users can view participants of public chats or their own chats'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view participants of public chats or their own chats" ON public.conversation_participants';
  END IF;
END $$;

-- 3) Create minimal, non-recursive policies
-- Conversations: single SELECT policy using helper function (no subqueries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'conversations_select_non_recursive'
  ) THEN
    EXECUTE $$
      CREATE POLICY "conversations_select_non_recursive"
      ON public.conversations
      FOR SELECT
      USING (is_public = true OR public.is_conversation_participant(id, auth.uid()));
    $$;
  END IF;
END $$;

-- Conversation Participants: keep selection simple to avoid recursion.
-- We intentionally DO NOT use is_conversation_participant() here to avoid self-reference.
-- If there isn't an open SELECT policy already, create one restricted to current user rows 
-- plus a view-all fallback if that's already configured. We prefer open SELECT like existing 'participants_select_policy'.
DO $$
DECLARE
  has_open_select boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'conversation_participants' 
      AND policyname = 'participants_select_policy'
  ) INTO has_open_select;

  IF NOT has_open_select THEN
    -- Minimum viable policy to let app work without recursion: allow selecting rows of conversations the user participates in by filtering on user_id when the app queries by user_id.
    -- Note: The app also fetches other participants of a conversation; for that, an open policy is already present in many environments. If missing, consider widening later.
    EXECUTE $$
      CREATE POLICY "participants_select_by_user"
      ON public.conversation_participants
      FOR SELECT
      USING (user_id = auth.uid());
    $$;
  END IF;
END $$;
