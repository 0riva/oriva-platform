-- Migration: Create Row-Level Security policies
-- Task: T010
-- Description: RLS policies for user data isolation and security
-- Dependencies: T001-T009 (all tables must exist)

-- ============================================================================
-- DROP ALL EXISTING POLICIES FIRST (old and new names)
-- ============================================================================

-- Users table (drop all variants)
DROP POLICY IF EXISTS "Users can insert own profile" ON oriva_platform.users;
DROP POLICY IF EXISTS "Users can update own profile" ON oriva_platform.users;
DROP POLICY IF EXISTS "Users can view own profile" ON oriva_platform.users;
DROP POLICY IF EXISTS users_self_update ON oriva_platform.users;
DROP POLICY IF EXISTS users_select_own ON oriva_platform.users;
DROP POLICY IF EXISTS users_update_own ON oriva_platform.users;

-- Hugo Love tables (created by earlier migrations in this batch)
DROP POLICY IF EXISTS conversations_user_access ON hugo_conversations;
DROP POLICY IF EXISTS messages_user_access ON hugo_messages;
DROP POLICY IF EXISTS up_user_access ON hugo_user_progress;
DROP POLICY IF EXISTS um_user_access ON hugo_user_memories;

-- Note: Hugo AI Vision tables (hugo_collaboration_memory, hugo_user_profiles, hugo_knowledge_base)
-- are created by later migration 20250929044708_hugo_ai_tables.sql and have their own RLS policies

-- ============================================================================
-- USERS TABLE - Users can only see/update their own profile
-- ============================================================================

CREATE POLICY users_select_own ON oriva_platform.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_update_own ON oriva_platform.users
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

COMMENT ON POLICY users_select_own ON oriva_platform.users IS 'Users can view their own profile';
COMMENT ON POLICY users_update_own ON oriva_platform.users IS 'Users can update their own profile';
COMMENT ON POLICY conversations_user_access ON hugo_conversations IS 'Users can CRUD their own conversations';
COMMENT ON POLICY messages_user_access ON hugo_messages IS 'Users can CRUD hugo_messages in their conversations';
COMMENT ON POLICY up_user_access ON hugo_user_progress IS 'Users can CRUD their own progress';
COMMENT ON POLICY um_user_access ON hugo_user_memories IS 'Users can CRUD their own memories';