-- Migration: Create OAuth Authorization Codes Table
-- Purpose: Temporary storage for OAuth authorization codes during the authorization code flow
-- Pattern: Short-lived (10 minutes), one-time use

CREATE TABLE IF NOT EXISTS hugo_love.oauth_authorization_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- OAuth identifiers
    code TEXT NOT NULL UNIQUE, -- Authorization code (random, unguessable)
    client_id TEXT NOT NULL REFERENCES hugo_love.oauth_clients(client_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- PKCE support
    code_challenge TEXT,
    code_challenge_method TEXT CHECK (code_challenge_method IN ('plain', 'S256')),

    -- State parameter (CSRF protection)
    state TEXT,

    -- Scopes requested
    scope TEXT,

    -- Redirect URI used in request (must match client registration)
    redirect_uri TEXT NOT NULL,

    -- Code status
    is_used BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),

    -- Authorization details
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance and cleanup
CREATE INDEX idx_oauth_codes_code ON hugo_love.oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_client_id ON hugo_love.oauth_authorization_codes(client_id);
CREATE INDEX idx_oauth_codes_user_id ON hugo_love.oauth_authorization_codes(user_id);
CREATE INDEX idx_oauth_codes_expires_at ON hugo_love.oauth_authorization_codes(expires_at);
CREATE INDEX idx_oauth_codes_is_used ON hugo_love.oauth_authorization_codes(is_used);

-- Enable RLS
ALTER TABLE hugo_love.oauth_authorization_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role can read (for backend token exchange)
CREATE POLICY "oauth_codes_service_role_read" ON hugo_love.oauth_authorization_codes
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- RLS Policy: Only service role can update
CREATE POLICY "oauth_codes_service_role_update" ON hugo_love.oauth_authorization_codes
    FOR UPDATE
    USING (auth.role() = 'authenticated');

-- RLS Policy: Only service role can insert
CREATE POLICY "oauth_codes_service_role_insert" ON hugo_love.oauth_authorization_codes
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Add comment for documentation
COMMENT ON TABLE hugo_love.oauth_authorization_codes IS 'Temporary OAuth 2.0 authorization codes for the authorization code flow';
COMMENT ON COLUMN hugo_love.oauth_authorization_codes.code IS 'Authorization code (typically 256 bits, random, cryptographically secure)';
COMMENT ON COLUMN hugo_love.oauth_authorization_codes.code_challenge IS 'PKCE code challenge (S256: SHA256(code_verifier))';
COMMENT ON COLUMN hugo_love.oauth_authorization_codes.state IS 'CSRF protection state parameter';
COMMENT ON COLUMN hugo_love.oauth_authorization_codes.expires_at IS 'Authorization code expiry (10 minutes after creation)';
COMMENT ON COLUMN hugo_love.oauth_authorization_codes.is_used IS 'Flag indicating if this code has been exchanged for tokens';
