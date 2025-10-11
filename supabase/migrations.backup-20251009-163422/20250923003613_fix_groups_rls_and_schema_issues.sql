-- Fix Groups RLS and Schema Issues
-- Migration: 20250923003613_fix_groups_rls_and_schema_issues.sql
--
-- Fixes:
-- 1. Add missing created_at column to group_members table (aliased to joined_at)
-- 2. Fix circular RLS policy causing infinite recursion
-- 3. Ensure proper group access policies

BEGIN;

-- =====================================================================
-- 1. ADD MISSING created_at COLUMN TO group_members
-- =====================================================================

-- Add created_at column as an alias to joined_at for compatibility
-- This allows the application code to use either column name
ALTER TABLE group_members ADD COLUMN created_at timestamptz;

-- Set created_at to the same value as joined_at for existing records
UPDATE group_members SET created_at = joined_at WHERE created_at IS NULL;

-- Set default for new records
ALTER TABLE group_members ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE group_members ALTER COLUMN created_at SET NOT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_group_members_created_at ON group_members(created_at);

-- =====================================================================
-- 2. FIX CIRCULAR RLS POLICIES
-- =====================================================================

-- Drop the problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view group memberships for accessible groups" ON group_members;
DROP POLICY IF EXISTS "Group admins can manage memberships" ON group_members;

-- Create non-circular RLS policies for group_members
-- Policy 1: Users can view memberships in groups they created
CREATE POLICY "Users can view memberships in own groups" ON group_members
  FOR SELECT
  USING (
    group_id IN (
      SELECT id FROM groups WHERE created_by = auth.uid()
    )
  );

-- Policy 2: Users can view their own memberships
CREATE POLICY "Users can view own memberships" ON group_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy 3: Group creators can manage all memberships in their groups
CREATE POLICY "Group creators can manage memberships" ON group_members
  FOR ALL
  USING (
    group_id IN (SELECT id FROM groups WHERE created_by = auth.uid())
  )
  WITH CHECK (
    group_id IN (SELECT id FROM groups WHERE created_by = auth.uid())
  );

-- Policy 4: Users can join groups (insert their own membership)
CREATE POLICY "Users can join groups" ON group_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy 5: Users can leave groups (delete their own membership)
CREATE POLICY "Users can leave groups" ON group_members
  FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================================
-- 3. IMPROVE GROUPS TABLE RLS POLICIES
-- =====================================================================

-- Drop and recreate the groups SELECT policy to be more efficient
DROP POLICY IF EXISTS "Users can view own groups and groups they are members of" ON groups;

-- Create more efficient SELECT policy for groups
CREATE POLICY "Users can view accessible groups" ON groups
  FOR SELECT
  USING (
    -- Groups they created
    created_by = auth.uid() OR
    -- Public groups (not private)
    is_private = false OR
    -- Private groups they are members of (simplified check)
    (is_private = true AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
    ))
  );

-- =====================================================================
-- 4. CREATE FUNCTION TO SYNC created_at WITH joined_at
-- =====================================================================

-- Function to keep created_at in sync with joined_at
CREATE OR REPLACE FUNCTION sync_group_member_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT, set created_at to joined_at if not explicitly set
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL THEN
      NEW.created_at = NEW.joined_at;
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE, keep created_at in sync with joined_at
  IF TG_OP = 'UPDATE' THEN
    IF OLD.joined_at != NEW.joined_at THEN
      NEW.created_at = NEW.joined_at;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to sync timestamps
DROP TRIGGER IF EXISTS sync_group_member_timestamps_trigger ON group_members;
CREATE TRIGGER sync_group_member_timestamps_trigger
  BEFORE INSERT OR UPDATE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION sync_group_member_timestamps();

-- =====================================================================
-- 5. GRANT ADDITIONAL PERMISSIONS IF NEEDED
-- =====================================================================

-- Ensure authenticated users have proper access
GRANT SELECT, INSERT, UPDATE, DELETE ON group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON groups TO authenticated;

COMMIT;

-- Add comments for documentation
COMMENT ON COLUMN group_members.created_at IS 'Alias for joined_at to maintain application compatibility';
COMMENT ON FUNCTION sync_group_member_timestamps() IS 'Keeps created_at column in sync with joined_at for application compatibility';