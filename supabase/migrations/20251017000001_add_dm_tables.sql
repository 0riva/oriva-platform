-- Direct Messaging Tables
-- Stores 1-to-1 DM conversations and messages
-- Used by DMChatPanel and dmChatService

-- ============================================================================
-- DM CONVERSATIONS TABLE
-- ============================================================================
-- Stores conversations between two users (1-to-1 DMs)
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Participant IDs (exactly 2 for 1-to-1 DM)
  participant_ids uuid[] NOT NULL,

  -- Metadata
  last_message_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Indexes
  CONSTRAINT dm_conversations_participants_length CHECK (array_length(participant_ids, 1) = 2)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dm_conversations_participant_ids
  ON public.dm_conversations USING gin (participant_ids);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_last_message_at
  ON public.dm_conversations (last_message_at DESC);

-- ============================================================================
-- DM MESSAGES TABLE
-- ============================================================================
-- Stores individual messages in DM conversations
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign key to conversation
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations (id) ON DELETE CASCADE,

  -- Message details
  sender_id uuid NOT NULL,
  content text NOT NULL,

  -- Read status tracking (array of user IDs who have read this message)
  read_by uuid[] NOT NULL DEFAULT '{}',

  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT dm_messages_content_not_empty CHECK (length(trim(content)) > 0)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_id
  ON public.dm_messages (conversation_id);

CREATE INDEX IF NOT EXISTS idx_dm_messages_sender_id
  ON public.dm_messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_dm_messages_created_at
  ON public.dm_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dm_messages_read_by
  ON public.dm_messages USING gin (read_by);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;

-- DM_CONVERSATIONS RLS POLICIES
-- Users can only see conversations where they own at least one participant profile
CREATE POLICY dm_conversations_select_policy
  ON public.dm_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = ANY(dm_conversations.participant_ids)
      AND profiles.account_id = auth.uid()
    )
  );

-- Users can only create conversations where they own at least one participant profile
CREATE POLICY dm_conversations_insert_policy
  ON public.dm_conversations
  FOR INSERT
  WITH CHECK (
    array_length(participant_ids, 1) = 2
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = ANY(participant_ids)
      AND profiles.account_id = auth.uid()
    )
  );

-- Users can update conversations where they own at least one participant profile
CREATE POLICY dm_conversations_update_policy
  ON public.dm_conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = ANY(dm_conversations.participant_ids)
      AND profiles.account_id = auth.uid()
    )
  );

-- DM_MESSAGES RLS POLICIES
-- Users can only see messages from conversations where they own a participant profile
CREATE POLICY dm_messages_select_policy
  ON public.dm_messages
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.dm_conversations dc
      WHERE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = ANY(dc.participant_ids)
        AND profiles.account_id = auth.uid()
      )
    )
  );

-- Users can only insert messages to conversations where they own the sender profile
CREATE POLICY dm_messages_insert_policy
  ON public.dm_messages
  FOR INSERT
  WITH CHECK (
    -- Sender must be a profile owned by the authenticated user
    sender_id IN (SELECT id FROM public.profiles WHERE account_id = auth.uid())
    AND
    -- Message's conversation must include the sender profile in participants
    conversation_id IN (
      SELECT id FROM public.dm_conversations dc
      WHERE dm_messages.sender_id = ANY(dc.participant_ids)
    )
  );

-- Users can update messages in conversations where they own a participant profile
CREATE POLICY dm_messages_update_policy
  ON public.dm_messages
  FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM public.dm_conversations dc
      WHERE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = ANY(dc.participant_ids)
        AND profiles.account_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.dm_conversations dc
      WHERE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = ANY(dc.participant_ids)
        AND profiles.account_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- HELPER FUNCTION: Get user's conversations
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_conversations(user_id uuid)
RETURNS TABLE (
  id uuid,
  participant_ids uuid[],
  last_message_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.participant_ids,
    dc.last_message_at,
    dc.created_at,
    dc.updated_at
  FROM public.dm_conversations dc
  WHERE user_id = ANY(dc.participant_ids)
  ORDER BY dc.last_message_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Get conversation messages
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_conversation_messages(
  conversation_id uuid,
  limit_count int DEFAULT 50,
  offset_count int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  read_by uuid[],
  created_at timestamp with time zone,
  updated_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dm.id,
    dm.conversation_id,
    dm.sender_id,
    dm.content,
    dm.read_by,
    dm.created_at,
    dm.updated_at
  FROM public.dm_messages dm
  WHERE dm.conversation_id = $1
  ORDER BY dm.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: Mark messages as read
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(
  message_ids uuid[],
  user_id uuid
)
RETURNS void AS $$
BEGIN
  UPDATE public.dm_messages
  SET
    read_by = CASE
      WHEN user_id = ANY(read_by) THEN read_by
      ELSE array_append(read_by, user_id)
    END,
    updated_at = now()
  WHERE id = ANY(message_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE public.dm_conversations IS 'Stores 1-to-1 DM conversations between two users';
COMMENT ON TABLE public.dm_messages IS 'Stores individual messages in DM conversations';
COMMENT ON COLUMN public.dm_conversations.participant_ids IS 'Array of exactly 2 UUID participant IDs';
COMMENT ON COLUMN public.dm_messages.read_by IS 'Array of user IDs who have read this message';
COMMENT ON FUNCTION public.get_user_conversations IS 'Get all conversations for a user, ordered by most recent';
COMMENT ON FUNCTION public.get_conversation_messages IS 'Get paginated messages for a conversation';
COMMENT ON FUNCTION public.mark_messages_as_read IS 'Mark specific messages as read by a user';
