-- ==============================================================================
-- Migration: LodgeMate Unified In-App Messaging
-- ==============================================================================

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_snippet text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Conversation Participants Table
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 3000),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'inspection_prompt')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. User Blocks Table
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_date ON public.messages(conversation_id, created_at ASC);

-- 6. RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

-- RLS Policies: conversations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'conversations_participant_select') THEN
    CREATE POLICY "conversations_participant_select" ON public.conversations
      FOR SELECT USING (public.is_conversation_participant(id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'conversations_participant_insert') THEN
    CREATE POLICY "conversations_participant_insert" ON public.conversations
      FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;

-- RLS Policies: conversation_participants
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_participants' AND policyname = 'participants_own_select') THEN
    CREATE POLICY "participants_own_select" ON public.conversation_participants
      FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_participants' AND policyname = 'participants_insert_via_rpc') THEN
    CREATE POLICY "participants_insert_via_rpc" ON public.conversation_participants
      FOR INSERT WITH CHECK (
        public.is_conversation_participant(conversation_id, auth.uid())
        OR user_id = auth.uid()
      );
  END IF;
END $$;

-- RLS Policies: messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'messages_participant_select') THEN
    CREATE POLICY "messages_participant_select" ON public.messages
      FOR SELECT USING (public.is_conversation_participant(conversation_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'messages_participant_insert') THEN
    CREATE POLICY "messages_participant_insert" ON public.messages
      FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND public.is_conversation_participant(conversation_id, auth.uid())
      );
  END IF;
END $$;

-- RLS Policies: user_blocks
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_blocks' AND policyname = 'blocks_own_select') THEN
    CREATE POLICY "blocks_own_select" ON public.user_blocks
      FOR SELECT USING (blocker_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_blocks' AND policyname = 'blocks_own_insert') THEN
    CREATE POLICY "blocks_own_insert" ON public.user_blocks
      FOR INSERT WITH CHECK (blocker_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_blocks' AND policyname = 'blocks_own_delete') THEN
    CREATE POLICY "blocks_own_delete" ON public.user_blocks
      FOR DELETE USING (blocker_id = auth.uid());
  END IF;
END $$;

-- 7. Trigger: update conversation on new message
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_snippet = substring(NEW.content from 1 for 100),
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  UPDATE public.conversation_participants
  SET last_read_at = NEW.created_at
  WHERE conversation_id = NEW.conversation_id AND user_id = NEW.sender_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_message_insert ON public.messages;
CREATE TRIGGER trg_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message();

-- 8. get_or_create_conversation RPC
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  _recipient_id uuid,
  _listing_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _conv_id uuid;
BEGIN
  IF auth.uid() = _recipient_id THEN
    RAISE EXCEPTION 'Users cannot initiate conversations with themselves';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = _recipient_id)
       OR (blocker_id = _recipient_id AND blocked_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Messaging is unavailable between these users';
  END IF;

  SELECT cp1.conversation_id INTO _conv_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN public.conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = _recipient_id
    AND (c.listing_id IS NOT DISTINCT FROM _listing_id)
  LIMIT 1;

  IF _conv_id IS NOT NULL THEN
    RETURN _conv_id;
  END IF;

  INSERT INTO public.conversations (listing_id, created_by)
  VALUES (_listing_id, auth.uid())
  RETURNING id INTO _conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_conv_id, auth.uid()), (_conv_id, _recipient_id);

  RETURN _conv_id;
END;
$$;

-- 9. get_total_unread_messages_count RPC
CREATE OR REPLACE FUNCTION public.get_total_unread_messages_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)
  FROM public.messages m
  JOIN public.conversation_participants cp ON cp.conversation_id = m.conversation_id
  WHERE cp.user_id = auth.uid()
    AND m.sender_id != auth.uid()
    AND m.created_at > cp.last_read_at;
$$;

-- 10. Realtime publication
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
