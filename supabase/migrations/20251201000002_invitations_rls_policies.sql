-- RLS policies for travel_hub.invitations table
-- This migration adds Row-Level Security policies to control access to invitations

-- Enable RLS on the invitations table
ALTER TABLE travel_hub.invitations ENABLE ROW LEVEL SECURITY;

-- Grant basic permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON travel_hub.invitations TO authenticated;

-- Grant usage on the schema (if not already granted)
GRANT USAGE ON SCHEMA travel_hub TO authenticated;

-- Policy: Users can view invitations for organizations they have admin access to
-- Admin access is determined by organization_memberships with role 'admin' or 'org_admin'
CREATE POLICY "org_admins_can_view_invitations"
ON travel_hub.invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM travel_hub.organization_memberships om
    WHERE om.organization_id = invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'org_admin')
      AND om.status = 'active'
  )
  OR
  -- Master admins can view all invitations
  EXISTS (
    SELECT 1 FROM travel_hub.system_users su
    WHERE su.user_id = auth.uid()
      AND su.is_master_admin = true
  )
);

-- Policy: Org admins can create invitations for their organizations
CREATE POLICY "org_admins_can_create_invitations"
ON travel_hub.invitations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM travel_hub.organization_memberships om
    WHERE om.organization_id = organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'org_admin')
      AND om.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM travel_hub.system_users su
    WHERE su.user_id = auth.uid()
      AND su.is_master_admin = true
  )
);

-- Policy: Org admins can update invitations (revoke, etc) for their organizations
CREATE POLICY "org_admins_can_update_invitations"
ON travel_hub.invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM travel_hub.organization_memberships om
    WHERE om.organization_id = invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'org_admin')
      AND om.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM travel_hub.system_users su
    WHERE su.user_id = auth.uid()
      AND su.is_master_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM travel_hub.organization_memberships om
    WHERE om.organization_id = organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'org_admin')
      AND om.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM travel_hub.system_users su
    WHERE su.user_id = auth.uid()
      AND su.is_master_admin = true
  )
);

-- Policy: Org admins can delete invitations (hard delete if needed)
CREATE POLICY "org_admins_can_delete_invitations"
ON travel_hub.invitations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM travel_hub.organization_memberships om
    WHERE om.organization_id = invitations.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('admin', 'org_admin')
      AND om.status = 'active'
  )
  OR
  EXISTS (
    SELECT 1 FROM travel_hub.system_users su
    WHERE su.user_id = auth.uid()
      AND su.is_master_admin = true
  )
);

-- Comments
COMMENT ON POLICY "org_admins_can_view_invitations" ON travel_hub.invitations IS 'Org admins and master admins can view invitations';
COMMENT ON POLICY "org_admins_can_create_invitations" ON travel_hub.invitations IS 'Org admins and master admins can create invitations';
COMMENT ON POLICY "org_admins_can_update_invitations" ON travel_hub.invitations IS 'Org admins and master admins can update invitations';
COMMENT ON POLICY "org_admins_can_delete_invitations" ON travel_hub.invitations IS 'Org admins and master admins can delete invitations';
