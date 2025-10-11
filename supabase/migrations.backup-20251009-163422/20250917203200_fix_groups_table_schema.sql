-- Fix groups table schema and RLS policies
-- Migration: 20250917203200_fix_groups_table_schema.sql

BEGIN;

-- =====================================================================
-- 1. DROP AND RECREATE GROUPS TABLE WITH PROPER SCHEMA
-- =====================================================================

-- Drop existing groups table if it exists with wrong schema
DROP TABLE IF EXISTS groups CASCADE;

-- Create groups table with proper UUID columns
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text DEFAULT 'personal' CHECK (category IN ('work', 'community', 'personal')),
  is_private boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- 2. CREATE GROUP_MEMBERS TABLE
-- =====================================================================

-- Drop existing group_members table if it exists
DROP TABLE IF EXISTS group_members CASCADE;

-- Create group_members table
CREATE TABLE group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ensure unique membership
  UNIQUE(group_id, user_id)
);

-- =====================================================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- =====================================================================

-- Groups indexes
CREATE INDEX idx_groups_created_by ON groups(created_by);
CREATE INDEX idx_groups_category ON groups(category);
CREATE INDEX idx_groups_is_private ON groups(is_private);
CREATE INDEX idx_groups_created_at ON groups(created_at);

-- Group members indexes
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_role ON group_members(role);

-- =====================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- =====================================================================

-- Enable RLS on both tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 5. CREATE RLS POLICIES FOR GROUPS TABLE
-- =====================================================================

-- Allow users to view groups they created or are members of
CREATE POLICY "Users can view own groups and groups they are members of" ON groups
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    id IN (
      SELECT group_id FROM group_members
      WHERE user_id = auth.uid()
    )
  );

-- Allow users to create groups
CREATE POLICY "Users can create groups" ON groups
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Allow group creators to update their groups
CREATE POLICY "Group creators can update their groups" ON groups
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Allow group creators to delete their groups
CREATE POLICY "Group creators can delete their groups" ON groups
  FOR DELETE
  USING (created_by = auth.uid());

-- =====================================================================
-- 6. CREATE RLS POLICIES FOR GROUP_MEMBERS TABLE
-- =====================================================================

-- Allow users to view memberships for groups they can see
CREATE POLICY "Users can view group memberships for accessible groups" ON group_members
  FOR SELECT
  USING (
    group_id IN (
      SELECT id FROM groups
      WHERE created_by = auth.uid() OR
      id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    )
  );

-- Allow group admins and the user themselves to manage memberships
CREATE POLICY "Group admins can manage memberships" ON group_members
  FOR ALL
  USING (
    -- Group creator (admin)
    group_id IN (SELECT id FROM groups WHERE created_by = auth.uid()) OR
    -- User managing their own membership
    user_id = auth.uid()
  )
  WITH CHECK (
    -- Group creator (admin)
    group_id IN (SELECT id FROM groups WHERE created_by = auth.uid()) OR
    -- User managing their own membership (join only)
    user_id = auth.uid()
  );

-- =====================================================================
-- 7. CREATE FUNCTIONS FOR AUTOMATED TASKS
-- =====================================================================

-- Function to automatically add group creator as admin member
CREATE OR REPLACE FUNCTION add_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically add creator as admin
CREATE TRIGGER add_creator_as_admin_trigger
  AFTER INSERT ON groups
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_as_admin();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on groups
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================================
-- 8. GRANT PERMISSIONS
-- =====================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON group_members TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMIT;

-- Add helpful comments
COMMENT ON TABLE groups IS 'User-created groups for organizing discussions and content';
COMMENT ON TABLE group_members IS 'Membership tracking for groups with roles';
COMMENT ON COLUMN groups.created_by IS 'UUID of the user who created this group (references auth.users.id)';
COMMENT ON COLUMN group_members.role IS 'Member role: admin (full control), moderator (manage content), member (participate)';