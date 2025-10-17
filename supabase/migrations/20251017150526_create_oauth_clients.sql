-- Migration: Create OAuth Clients Table
-- Purpose: Store OAuth client applications that can authenticate with Hugo Love
-- Pattern: Supabase-compatible with RLS policies

CREATE TABLE IF NOT EXISTS hugo_love.oauth_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Client identification
    client_id TEXT NOT NULL UNIQUE,
    client_secret TEXT NOT NULL, -- Should be hashed in production
    client_name TEXT NOT NULL,

    -- Redirect URI for OAuth callback
    redirect_uri TEXT NOT NULL,

    -- Client type (e.g., 'public' for mobile, 'confidential' for backend)
    client_type TEXT NOT NULL DEFAULT 'public' CHECK (client_type IN ('public', 'confidential')),

    -- Client status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Metadata
    description TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_oauth_clients_client_id ON hugo_love.oauth_clients(client_id);
CREATE INDEX idx_oauth_clients_is_active ON hugo_love.oauth_clients(is_active);
CREATE INDEX idx_oauth_clients_owner_id ON hugo_love.oauth_clients(owner_id);

-- Enable RLS
ALTER TABLE hugo_love.oauth_clients ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public access for client lookups (by client_id only)
CREATE POLICY "oauth_clients_public_read_by_client_id" ON hugo_love.oauth_clients
    FOR SELECT
    USING (true);

-- RLS Policy: Only owner can update their client
CREATE POLICY "oauth_clients_owner_update" ON hugo_love.oauth_clients
    FOR UPDATE
    USING (auth.uid() = owner_id);

-- RLS Policy: Only owner can delete their client
CREATE POLICY "oauth_clients_owner_delete" ON hugo_love.oauth_clients
    FOR DELETE
    USING (auth.uid() = owner_id);

-- RLS Policy: Authenticated users can create clients
CREATE POLICY "oauth_clients_authenticated_insert" ON hugo_love.oauth_clients
    FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

-- Add comment for documentation
COMMENT ON TABLE hugo_love.oauth_clients IS 'OAuth 2.0 client applications for Hugo Love authentication';
COMMENT ON COLUMN hugo_love.oauth_clients.client_id IS 'Public client identifier (e.g., hugo_love_ios)';
COMMENT ON COLUMN hugo_love.oauth_clients.client_secret IS 'Client secret for confidential clients (should be hashed)';
COMMENT ON COLUMN hugo_love.oauth_clients.redirect_uri IS 'Authorized redirect URI for OAuth callbacks (e.g., hugolove://auth/callback)';
