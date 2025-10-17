-- Apply DM RLS Policies (Deferred)
--
-- This migration applies RLS policies to dm_conversations and dm_messages tables.
-- These policies were skipped in the initial migration because the public.profiles
-- table did not yet exist. Now that profiles table exists, we can apply them.
--
-- If profiles table still doesn't exist, this migration will fail gracefully.
-- It can be re-run once profiles table is available.

-- Check if profiles table exists before applying policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    -- Profiles table exists, apply policies

    -- ============================================================================
    -- DM_CONVERSATIONS RLS POLICIES
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
    -- DM_MESSAGES RLS POLICIES
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
        sender_id IN (SELECT id FROM public.profiles WHERE account_id = auth.uid())
        AND
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

    RAISE NOTICE 'Successfully applied DM RLS policies';
  ELSE
    RAISE EXCEPTION 'public.profiles table does not exist. RLS policies cannot be applied. Run this migration after profiles table is created.';
  END IF;
END $$;
