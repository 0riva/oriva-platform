-- Fix DM Chat RLS Policies for Profile-Based Access Control
--
-- ROOT CAUSE: Original RLS policies checked auth.uid() directly against participant_ids array.
-- PROBLEM: participant_ids contains PROFILE IDs, but auth.uid() is the ACCOUNT ID.
-- These are completely different UUIDs!
--
-- RESULT: Users could never create conversations because RLS rejected all inserts.
-- RLS check: auth.uid() = ANY(participant_ids)
-- Reality: ['profile-uuid-1', 'profile-uuid-2'] never contains the account UUID
--
-- SOLUTION: Use profile lookups to verify user ownership of participant profiles

-- Drop old incorrect policies
DROP POLICY IF EXISTS dm_conversations_select_policy ON public.dm_conversations;
DROP POLICY IF EXISTS dm_conversations_insert_policy ON public.dm_conversations;
DROP POLICY IF EXISTS dm_conversations_update_policy ON public.dm_conversations;

DROP POLICY IF EXISTS dm_messages_select_policy ON public.dm_messages;
DROP POLICY IF EXISTS dm_messages_insert_policy ON public.dm_messages;
DROP POLICY IF EXISTS dm_messages_update_policy ON public.dm_messages;

-- ============================================================================
-- FIXED DM_CONVERSATIONS RLS POLICIES
-- ============================================================================

-- SELECT: Users can see conversations where they own at least one participant profile
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

-- INSERT: Users can create conversations where they own at least one participant profile
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

-- UPDATE: Users can update conversations where they own at least one participant profile
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

-- ============================================================================
-- FIXED DM_MESSAGES RLS POLICIES
-- ============================================================================

-- SELECT: Users can see messages from conversations where they own a participant profile
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

-- INSERT: Users can send messages where they own the sender profile
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

-- UPDATE: Users can update messages in conversations where they own a participant profile
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
-- COMMENT: Explain the fix
-- ============================================================================
COMMENT ON POLICY dm_conversations_insert_policy ON public.dm_conversations IS
'Users can create conversations where they own at least one participant profile.
This requires joining with the profiles table to map profile IDs to account IDs.
Direct comparison of auth.uid() to participant_ids would fail because:
- auth.uid() returns the account UUID from auth.users
- participant_ids contains profile UUIDs from public.profiles
These are different tables with different UUIDs!';
