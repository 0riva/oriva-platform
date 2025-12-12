-- Add system_user_invitations table for system-level admin invitations
-- This table tracks pending, accepted, expired, and revoked invitations for system users
-- Unlike org invitations, these are for system-wide access (master admin or system admin)

CREATE TABLE IF NOT EXISTS travel_hub.system_user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    is_master_admin BOOLEAN NOT NULL DEFAULT FALSE,
    token TEXT NOT NULL UNIQUE,
    invited_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_system_user_invitations_email ON travel_hub.system_user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_system_user_invitations_token ON travel_hub.system_user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_system_user_invitations_status ON travel_hub.system_user_invitations(status);

-- Comments
COMMENT ON TABLE travel_hub.system_user_invitations IS 'Invitations to become a system user (master admin or regular system admin)';
COMMENT ON COLUMN travel_hub.system_user_invitations.token IS 'Unique secure token for invitation acceptance';
COMMENT ON COLUMN travel_hub.system_user_invitations.is_master_admin IS 'Whether the invitee will become a master admin when accepted';

-- RLS Policies
ALTER TABLE travel_hub.system_user_invitations ENABLE ROW LEVEL SECURITY;

-- Master admins can view all system user invitations
CREATE POLICY "Master admins can view all system user invitations"
    ON travel_hub.system_user_invitations
    FOR SELECT
    USING (travel_hub.is_master_admin());

-- Master admins can create system user invitations
CREATE POLICY "Master admins can create system user invitations"
    ON travel_hub.system_user_invitations
    FOR INSERT
    WITH CHECK (travel_hub.is_master_admin());

-- Master admins can update system user invitations (for revoke, resend, etc.)
CREATE POLICY "Master admins can update system user invitations"
    ON travel_hub.system_user_invitations
    FOR UPDATE
    USING (travel_hub.is_master_admin());

-- Service role bypass for public accept endpoint
-- Note: The accept endpoint uses service role key, so it bypasses RLS
