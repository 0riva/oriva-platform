-- Fix groups INSERT policy to properly allow authenticated users to create groups
-- Issue: Policy was not explicitly specifying roles, causing RLS check to fail
-- Solution: Explicitly specify authenticated and anon roles with proper grants

-- Drop existing policy
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;

-- Recreate with explicit roles
CREATE POLICY "Users can create groups"
ON public.groups
FOR INSERT
TO authenticated, anon
WITH CHECK (
  created_by = auth.uid()
);

-- Ensure roles have INSERT permission
GRANT INSERT ON public.groups TO authenticated, anon;
