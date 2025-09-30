-- Migration: Create prepared statements for hot paths
-- Task: T011
-- Description: Optimized prepared statements for critical performance paths
-- Dependencies: T001-T009 (all tables must exist)

-- ============================================================================
-- HOT PATH 1: Get Chat Context (executed for every message)
-- Performance requirement: <500ms (FR-026, FR-028)
-- ============================================================================

PREPARE get_chat_context(text, uuid) AS
SELECT
  a.app_id,
  a.display_name,
  a.domain,
  ps.schema as personality_schema,
  array_agg(DISTINCT kb.kb_id) as knowledge_bases,
  (
    SELECT json_agg(
      json_build_object(
        'id', m.id,
        'role', m.role,
        'content', m.content,
        'created_at', m.created_at
      ) ORDER BY m.created_at DESC
    )
    FROM hugo_messages m
    JOIN hugo_conversations c ON c.id = m.conversation_id
    WHERE c.user_id = $2 AND c.app_id = a.id
    ORDER BY m.created_at DESC
    LIMIT 10
  ) as recent_messages,
  up.progress_data,
  up.current_focus_area,
  up.milestones_reached
FROM hugo_apps a
LEFT JOIN personality_schemas ps ON ps.id = a.personality_schema_id
LEFT JOIN knowledge_bases kb ON kb.kb_id = ANY(a.knowledge_base_ids)
LEFT JOIN user_progress up ON up.user_id = $2 AND up.app_id = a.id
WHERE a.app_id = $1
  AND a.is_active = true
GROUP BY a.id, ps.id, up.id;

COMMENT ON TEXT SEARCH CONFIGURATION pg_catalog."english" IS 'Prepared statement: get_chat_context($1=app_id, $2=user_id) - retrieves full context for chat message';

-- ============================================================================
-- HOT PATH 2: Search Knowledge Base (executed for every message)
-- Performance requirement: <1s (FR-028)
-- ============================================================================

PREPARE search_knowledge(text, text, int) AS
SELECT
  ke.id,
  ke.title,
  ke.content,
  ke.category,
  ke.tags,
  ts_rank(ke.search_vector, websearch_to_tsquery('english', $1)) as relevance,
  kb.kb_id
FROM knowledge_entries ke
JOIN knowledge_bases kb ON kb.id = ke.knowledge_base_id
WHERE
  kb.kb_id = ANY(
    SELECT unnest(knowledge_base_ids)
    FROM apps
    WHERE app_id = $2
      AND is_active = true
  )
  AND kb.is_active = true
  AND ke.search_vector @@ websearch_to_tsquery('english', $1)
ORDER BY relevance DESC
LIMIT $3;

COMMENT ON TEXT SEARCH CONFIGURATION pg_catalog."english" IS 'Prepared statement: search_knowledge($1=query, $2=app_id, $3=limit) - full-text search in knowledge base';

-- ============================================================================
-- HOT PATH 3: Get User Context (user profile, progress, memories)
-- Performance requirement: <200ms
-- ============================================================================

PREPARE get_user_context(uuid, text) AS
SELECT
  u.id,
  u.email,
  u.preferences,
  u.subscription_tier,
  up.progress_data,
  up.milestones_reached,
  up.current_focus_area,
  up.total_conversations,
  up.total_messages,
  (
    SELECT json_agg(
      json_build_object(
        'memory_type', um.memory_type,
        'content', um.content,
        'importance', um.importance,
        'created_at', um.created_at
      ) ORDER BY um.importance DESC
    )
    FROM user_memories um
    WHERE um.user_id = u.id
      AND um.app_id = (SELECT id FROM hugo_apps WHERE app_id = $2)
      AND (um.expires_at IS NULL OR um.expires_at > now())
    LIMIT 20
  ) as memories
FROM users u
LEFT JOIN user_progress up ON up.user_id = u.id
  AND up.app_id = (SELECT id FROM hugo_apps WHERE app_id = $2)
WHERE u.id = $1;

COMMENT ON TEXT SEARCH CONFIGURATION pg_catalog."english" IS 'Prepared statement: get_user_context($1=user_id, $2=app_id) - retrieves user profile, progress, and memories';

-- ============================================================================
-- HOT PATH 4: Get Recent Conversations (for conversation history UI)
-- Performance requirement: <300ms
-- ============================================================================

PREPARE get_recent_conversations(uuid, text, int) AS
SELECT
  c.id,
  c.session_id,
  c.title,
  c.message_count,
  c.created_at,
  c.last_message_at,
  c.closed_at,
  (
    SELECT json_build_object(
      'role', m.role,
      'content', m.content,
      'created_at', m.created_at
    )
    FROM hugo_messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) as last_message
FROM hugo_conversations c
WHERE c.user_id = $1
  AND c.app_id = (SELECT id FROM hugo_apps WHERE app_id = $2)
ORDER BY c.last_message_at DESC
LIMIT $3;

COMMENT ON TEXT SEARCH CONFIGURATION pg_catalog."english" IS 'Prepared statement: get_recent_conversations($1=user_id, $2=app_id, $3=limit) - retrieves recent hugo_conversations with last message';

-- ============================================================================
-- HELPER FUNCTIONS for prepared statements
-- ============================================================================

-- Function to execute get_chat_context with error handling
CREATE OR REPLACE FUNCTION execute_get_chat_context(app_id_param text, user_id_param uuid)
RETURNS TABLE (
  app_id text,
  display_name text,
  domain text,
  personality_schema jsonb,
  knowledge_bases text[],
  recent_messages jsonb,
  progress_data jsonb,
  current_focus_area text,
  milestones_reached text[]
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('EXECUTE get_chat_context(%L, %L)', app_id_param, user_id_param);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in get_chat_context: %', SQLERRM;
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION execute_get_chat_context IS 'Wrapper function for get_chat_context prepared statement with error handling';

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- These prepared statements are designed for the critical path:
-- 1. Client sends message to chat endpoint
-- 2. Backend calls get_chat_context (app config + user history)
-- 3. Backend calls search_knowledge (retrieve relevant KB entries)
-- 4. Backend calls get_user_context (user profile + memories)
-- 5. Backend composes AI prompt and calls LLM
-- 6. Backend saves response and returns to client
--
-- Target performance: Steps 2-4 must complete in <1s combined (FR-028)