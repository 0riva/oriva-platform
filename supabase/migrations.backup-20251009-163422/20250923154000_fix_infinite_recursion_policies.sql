-- Fix Infinite Recursion in Groups Policies
-- Migration: 20250923154000_fix_infinite_recursion_policies.sql
--
-- This migration addresses the "infinite recursion detected in policy for relation 'groups'" error
-- by completely dropping and recreating all RLS policies with non-recursive logic

BEGIN;

-- =====================================================================
-- 1. DISABLE RLS TEMPORARILY TO AVOID RECURSION ISSUES
-- =====================================================================

ALTER TABLE groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_members DISABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 2. DROP ALL EXISTING POLICIES (CLEAN SLATE)
-- =====================================================================

-- Drop all policies on groups table
DROP POLICY IF EXISTS "Users can view accessible groups" ON groups;
DROP POLICY IF EXISTS "Users can view own groups and groups they are members of" ON groups;
DROP POLICY IF EXISTS "Users can view public groups and own groups" ON groups;
DROP POLICY IF EXISTS "Users can view groups they created or joined" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Group creators can manage their groups" ON groups;
DROP POLICY IF EXISTS "Users can manage own groups" ON groups;

-- Drop all policies on group_members table
DROP POLICY IF EXISTS "Users can view accessible memberships" ON group_members;
DROP POLICY IF EXISTS "Users can view memberships in accessible groups" ON group_members;
DROP POLICY IF EXISTS "Users can view group memberships for accessible groups" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage memberships" ON group_members;
DROP POLICY IF EXISTS "Users can view memberships in own groups" ON group_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON group_members;
DROP POLICY IF EXISTS "Group creators can manage memberships" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- =====================================================================
-- 3. CREATE SIMPLE, NON-RECURSIVE POLICIES
-- =====================================================================

-- Groups policies (simple, no circular references)
CREATE POLICY "groups_select_policy" ON groups
  FOR SELECT 
  USING (
    -- Public groups (anyone can see)
    is_private = false OR
    -- Groups created by current user
    created_by = auth.uid()
  );

CREATE POLICY "groups_insert_policy" ON groups
  FOR INSERT 
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "groups_update_policy" ON groups
  FOR UPDATE 
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "groups_delete_policy" ON groups
  FOR DELETE 
  USING (created_by = auth.uid());

-- Group members policies (simple, no circular references)
CREATE POLICY "group_members_select_own" ON group_members
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "group_members_select_created_groups" ON group_members
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "group_members_insert_policy" ON group_members
  FOR INSERT 
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND (g.is_private = false OR g.created_by = auth.uid())
    )
  );

CREATE POLICY "group_members_update_policy" ON group_members
  FOR UPDATE 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "group_members_delete_policy" ON group_members
  FOR DELETE 
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM groups g 
      WHERE g.id = group_members.group_id 
      AND g.created_by = auth.uid()
    )
  );

-- =====================================================================
-- 4. RE-ENABLE RLS
-- =====================================================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 5. VERIFY POLICIES WORK
-- =====================================================================

-- Test query to ensure no recursion (should not cause infinite loop)
-- This is commented out as it would run during migration
-- SELECT COUNT(*) FROM groups;

COMMIT;

-- Add helpful comments
COMMENT ON POLICY "groups_select_policy" ON groups IS 'Allow viewing public groups and own created groups - no recursion';
COMMENT ON POLICY "group_members_select_own" ON group_members IS 'Users can see their own memberships - no recursion';
COMMENT ON POLICY "group_members_select_created_groups" ON group_members IS 'Group creators can see all memberships in their groups - no recursion';