-- Fix infinite recursion in group_members RLS policies
-- Issue: Circular dependency between groups and group_members policies
-- Solution: Use security definer function to break the recursion

-- Drop existing circular policies
DROP POLICY IF EXISTS "Users can view own groups and groups they are members of" ON "public"."groups";
DROP POLICY IF EXISTS "Users can view group memberships for accessible groups" ON "public"."group_members";

-- Create security definer function to get user's accessible group IDs
-- This breaks the circular dependency by caching the result
CREATE OR REPLACE FUNCTION get_user_accessible_group_ids(user_id UUID)
RETURNS TABLE(group_id UUID)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  -- Get groups user created OR is a member of
  SELECT DISTINCT g.id
  FROM groups g
  LEFT JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
  WHERE g.created_by = $1 OR gm.user_id IS NOT NULL;
$$;

-- Recreate groups policy using function (breaks recursion)
CREATE POLICY "Users can view own groups and groups they are members of"
ON "public"."groups" FOR SELECT
USING (
  "id" IN (SELECT group_id FROM get_user_accessible_group_ids(auth.uid()))
);

-- Recreate group_members policy using function (breaks recursion)
CREATE POLICY "Users can view group memberships for accessible groups"
ON "public"."group_members" FOR SELECT
USING (
  "group_id" IN (SELECT group_id FROM get_user_accessible_group_ids(auth.uid()))
);

-- Add comment explaining the fix
COMMENT ON FUNCTION get_user_accessible_group_ids IS
'Security definer function to break circular RLS policy dependency between groups and group_members tables. Executes with elevated privileges to avoid triggering RLS policies during execution.';
