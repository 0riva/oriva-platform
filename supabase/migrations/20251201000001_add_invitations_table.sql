-- Add invitations table for organization member invitations
-- This table tracks pending, accepted, expired, and revoked invitations

CREATE TABLE IF NOT EXISTS travel_hub.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES travel_hub.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'concierge_agent')),
    token TEXT NOT NULL UNIQUE,
    invited_by UUID REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_invitations_org ON travel_hub.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON travel_hub.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON travel_hub.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON travel_hub.invitations(status);

-- Comments
COMMENT ON TABLE travel_hub.invitations IS 'Invitations to join organizations as admin or concierge';
COMMENT ON COLUMN travel_hub.invitations.token IS 'Unique secure token for invitation acceptance';
COMMENT ON COLUMN travel_hub.invitations.role IS 'Role to assign when invitation is accepted';
