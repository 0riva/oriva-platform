-- Fix type mismatch in create_mention_notifications_for_entry
-- Issue: entries.content is jsonb but extract_mentions_from_content expects text
-- Solution: Add explicit cast to text

CREATE OR REPLACE FUNCTION "public"."create_mention_notifications_for_entry"("entry_uuid" "uuid")
RETURNS integer
LANGUAGE "plpgsql"
SECURITY DEFINER
AS $$
DECLARE
  entry_record RECORD;
  mention_username TEXT;
  mentioned_user_uuid UUID;
  notifications_created INTEGER := 0;
BEGIN
  -- Get entry details
  SELECT * INTO entry_record
  FROM entries
  WHERE id = entry_uuid;

  -- SECURITY: Verify caller is entry creator or service role
  IF entry_record.user_id != auth.uid() AND auth.jwt()->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only entry creator can trigger mention notifications';
  END IF;

  -- Only process if entry is published (FR-015, clarification Q3)
  IF entry_record.status != 'published' THEN
    RETURN 0;
  END IF;

  -- Extract mentions from content
  -- FIX: Cast jsonb to text before passing to extract_mentions_from_content
  FOR mention_username IN
    SELECT unnest(extract_mentions_from_content(entry_record.content::text))
  LOOP
    -- Find user by username in public.users table
    -- FR-017: Only active users receive notifications
    SELECT id INTO mentioned_user_uuid
    FROM users
    WHERE username = mention_username
      AND is_active = true; -- FR-017: Only active users

    -- Create notification if user found and active
    IF mentioned_user_uuid IS NOT NULL THEN
      -- Check if notification already exists (prevent duplicates)
      IF NOT EXISTS (
        SELECT 1 FROM mention_notifications
        WHERE mentioned_user_id = mentioned_user_uuid
          AND entry_id = entry_uuid
      ) THEN
        -- Create the mention notification
        INSERT INTO mention_notifications (
          mentioned_user_id,
          entry_id,
          mentioning_user_id,
          notification_type
        ) VALUES (
          mentioned_user_uuid,
          entry_uuid,
          entry_record.user_id,
          'mention'
        );

        notifications_created := notifications_created + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN notifications_created;
END;
$$;

-- Preserve ownership
ALTER FUNCTION "public"."create_mention_notifications_for_entry"("entry_uuid" "uuid") OWNER TO "postgres";

-- Add comment documenting the fix
COMMENT ON FUNCTION "public"."create_mention_notifications_for_entry"("entry_uuid" "uuid")
IS 'Creates mention notifications for an entry. Fixed: Added explicit cast from jsonb to text when calling extract_mentions_from_content.';
