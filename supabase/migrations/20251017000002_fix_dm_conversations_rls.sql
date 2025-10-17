-- Fix DM Conversations RLS Policies
-- Issue: participant_ids are PROFILE UUIDs but RLS was checking against USER UUIDs (auth.uid())
-- Solution: Join with profiles table to verify user ownership
--
-- This migration drops and recreates the RLS policies to correctly handle the profile-based chat model

-- ============================================================================
-- DROP OLD RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS dm_conversations_select_policy ON public.dm_conversations;
DROP POLICY IF EXISTS dm_conversations_insert_policy ON public.dm_conversations;
DROP POLICY IF EXISTS dm_conversations_update_policy ON public.dm_conversations;

-- ============================================================================
-- CREATE FIXED RLS POLICIES
-- ============================================================================

-- SELECT: Users can see conversations where any participant profile belongs to them
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

-- INSERT: Users can only create conversations where they own at least one participant profile
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
-- DM_MESSAGES RLS POLICIES - Also need fixing
-- ============================================================================

DROP POLICY IF EXISTS dm_messages_select_policy ON public.dm_messages;
DROP POLICY IF EXISTS dm_messages_insert_policy ON public.dm_messages;
DROP POLICY IF EXISTS dm_messages_update_policy ON public.dm_messages;

-- SELECT: Users can see messages from conversations they own a profile in
CREATE POLICY dm_messages_select_policy
  ON public.dm_messages
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = ANY(dm_conversations.participant_ids)
        AND profiles.account_id = auth.uid()
      )
    )
  );

-- INSERT: Users can only insert messages to conversations where they own the sender profile
CREATE POLICY dm_messages_insert_policy
  ON public.dm_messages
  FOR INSERT
  WITH CHECK (
    -- Sender must be a profile owned by the authenticated user
    sender_id IN (SELECT id FROM public.profiles WHERE account_id = auth.uid())
    AND
    -- Sender profile must be a participant in the conversation
    conversation_id IN (
      SELECT id FROM public.dm_conversations dc
      WHERE dm_messages.sender_id = ANY(dc.participant_ids)
    )
  );

-- UPDATE: Users can update messages in conversations they own a profile in
CREATE POLICY dm_messages_update_policy
  ON public.dm_messages
  FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = ANY(dm_conversations.participant_ids)
        AND profiles.account_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = ANY(dm_conversations.participant_ids)
        AND profiles.account_id = auth.uid()
      )
    )
  );
