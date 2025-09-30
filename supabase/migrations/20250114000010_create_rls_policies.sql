-- Migration: Create Row-Level Security policies
-- Task: T010
-- Description: RLS policies for user data isolation and security
-- Dependencies: T001-T009 (all tables must exist)

-- ============================================================================
-- DROP ALL EXISTING POLICIES FIRST
-- ============================================================================

-- Users table
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS users_self_update ON users;

-- Hugo tables
DROP POLICY IF EXISTS "Users can insert their own memories" ON hugo_collaboration_memory;
DROP POLICY IF EXISTS "Users can update their own memories" ON hugo_collaboration_memory;
DROP POLICY IF EXISTS "Users can view their own memories" ON hugo_collaboration_memory;
DROP POLICY IF EXISTS "Users can view their own profile" ON hugo_user_profiles;
DROP POLICY IF EXISTS context_kb_read_access ON hugo_knowledge_base;
DROP POLICY IF EXISTS context_kb_system_only ON hugo_knowledge_base;

-- ============================================================================
-- USERS TABLE - Users can only see/update their own profile
-- ============================================================================

CREATE POLICY users_select_own ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (id = auth.uid());

-- No INSERT policy - user creation handled by backend auth flow
-- No DELETE policy - account deletion requires backend verification

-- ============================================================================
-- CONVERSATIONS TABLE - Users can only access their own conversations
-- ============================================================================

CREATE POLICY conversations_user_access ON hugo_conversations
  FOR ALL USING (user_id = auth.uid());

-- Allows SELECT, INSERT, UPDATE, DELETE for user's own conversations

-- ============================================================================
-- MESSAGES TABLE - Users can only access hugo_messages in their conversations
-- ============================================================================

CREATE POLICY messages_user_access ON hugo_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT c.id FROM hugo_conversations c
      WHERE c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- USER_PROGRESS TABLE - Users can only access their own progress
-- ============================================================================

CREATE POLICY up_user_access ON hugo_user_progress
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- USER_MEMORIES TABLE - Users can only access their own memories
-- ============================================================================

CREATE POLICY um_user_access ON hugo_user_memories
  FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- PUBLIC READ TABLES (no RLS needed)
-- ============================================================================

-- apps: Public read (all users can see available apps)
-- knowledge_bases: Public read (app-level filtering handled by API)
-- knowledge_entries: Public read (app-level filtering handled by API)
-- personality_schemas: Backend-only access (not exposed to clients)

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY users_select_own ON users IS 'Users can view their own profile';
COMMENT ON POLICY users_update_own ON users IS 'Users can update their own profile';
COMMENT ON POLICY conversations_user_access ON hugo_conversations IS 'Users can CRUD their own conversations';
COMMENT ON POLICY messages_user_access ON hugo_messages IS 'Users can CRUD hugo_messages in their conversations';
COMMENT ON POLICY up_user_access ON hugo_user_progress IS 'Users can CRUD their own progress';
COMMENT ON POLICY um_user_access ON hugo_user_memories IS 'Users can CRUD their own memories';