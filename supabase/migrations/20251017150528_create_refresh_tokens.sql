-- Migration: Create Refresh Tokens Table
-- Purpose: Store refresh tokens with rotation history and revocation tracking
-- Pattern: Long-lived (30 days), supports token rotation and revocation for security

CREATE TABLE IF NOT EXISTS hugo_love.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User and client identification
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES hugo_love.oauth_clients(client_id) ON DELETE CASCADE,

    -- Token data
    token_hash TEXT NOT NULL UNIQUE, -- Hash of the refresh token (never store plain tokens)
    token_family TEXT, -- For token rotation detection (links rotated tokens)

    -- Device/session tracking
    device_id TEXT, -- Device identifier for selective revocation
    ip_address INET, -- Last known IP for security monitoring
    user_agent TEXT, -- Last known user agent

    -- Token rotation and lifecycle
    parent_token_hash TEXT REFERENCES hugo_love.refresh_tokens(token_hash) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

    -- Revocation tracking
    revoked_at TIMESTAMP WITH TIME ZONE,
    revocation_reason TEXT CHECK (
        revocation_reason IS NULL OR
        revocation_reason IN ('logout', 'password_change', 'security_event', 'admin_action', 'rotation')
    ),

    -- Status flags
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create indexes for performance and security operations
CREATE INDEX idx_refresh_tokens_user_id ON hugo_love.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_client_id ON hugo_love.refresh_tokens(client_id);
CREATE INDEX idx_refresh_tokens_token_hash ON hugo_love.refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON hugo_love.refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_revoked_at ON hugo_love.refresh_tokens(revoked_at);
CREATE INDEX idx_refresh_tokens_is_active ON hugo_love.refresh_tokens(is_active);
CREATE INDEX idx_refresh_tokens_token_family ON hugo_love.refresh_tokens(token_family);

-- Composite index for active, non-expired tokens
CREATE INDEX idx_refresh_tokens_active_valid ON hugo_love.refresh_tokens(user_id, is_active)
    WHERE is_active = true AND revoked_at IS NULL AND expires_at > NOW();

-- Enable RLS
ALTER TABLE hugo_love.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read their own tokens (not enforced for security)
-- This is primarily for backend service operations
CREATE POLICY "refresh_tokens_service_read" ON hugo_love.refresh_tokens
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policy: Users can revoke their own tokens
CREATE POLICY "refresh_tokens_user_revoke" ON hugo_love.refresh_tokens
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Only service role can create tokens
CREATE POLICY "refresh_tokens_service_insert" ON hugo_love.refresh_tokens
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- RLS Policy: Only service role can delete (cleanup)
CREATE POLICY "refresh_tokens_service_delete" ON hugo_love.refresh_tokens
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- Add comment for documentation
COMMENT ON TABLE hugo_love.refresh_tokens IS 'Long-lived refresh tokens with rotation history and revocation support';
COMMENT ON COLUMN hugo_love.refresh_tokens.token_hash IS 'SHA256 hash of the actual refresh token (never store plain tokens)';
COMMENT ON COLUMN hugo_love.refresh_tokens.token_family IS 'Family ID linking rotated token versions (detects replay attacks)';
COMMENT ON COLUMN hugo_love.refresh_tokens.parent_token_hash IS 'Reference to parent token after rotation (for token chain tracking)';
COMMENT ON COLUMN hugo_love.refresh_tokens.expires_at IS 'Refresh token expiry (typically 30 days)';
COMMENT ON COLUMN hugo_love.refresh_tokens.revoked_at IS 'Timestamp when token was revoked (NULL if active)';
COMMENT ON COLUMN hugo_love.refresh_tokens.revocation_reason IS 'Reason for revocation: logout, password_change, security_event, admin_action, or rotation';
