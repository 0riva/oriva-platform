-- Migration: Create developer_api_keys table
-- Description: Stores hashed API keys for platform and app authentication
-- Date: 2025-11-14
-- Related: Security Fix #2 - Hashed API Key Storage

-- Create developer_api_keys table in oriva_platform schema
CREATE TABLE IF NOT EXISTS oriva_platform.developer_api_keys (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- App association
  app_id TEXT NOT NULL,

  -- Key metadata
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of the API key
  key_prefix TEXT NOT NULL, -- First 20 chars for identification (e.g., "oriva_pk_live_abc123")

  -- Key status
  is_active BOOLEAN NOT NULL DEFAULT true,
  environment TEXT NOT NULL CHECK (environment IN ('test', 'live')),

  -- Usage tracking
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_key_hash
  ON oriva_platform.developer_api_keys(key_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_developer_api_keys_app_id
  ON oriva_platform.developer_api_keys(app_id)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_developer_api_keys_active
  ON oriva_platform.developer_api_keys(is_active, expires_at)
  WHERE deleted_at IS NULL;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION oriva_platform.update_developer_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_developer_api_keys_updated_at
  BEFORE UPDATE ON oriva_platform.developer_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION oriva_platform.update_developer_api_keys_updated_at();

-- Add comments for documentation
COMMENT ON TABLE oriva_platform.developer_api_keys IS
  'Stores hashed API keys for platform and application authentication. Keys are stored as SHA-256 hashes for security.';

COMMENT ON COLUMN oriva_platform.developer_api_keys.key_hash IS
  'SHA-256 hash of the API key. Never store plaintext keys.';

COMMENT ON COLUMN oriva_platform.developer_api_keys.key_prefix IS
  'First 20 characters of the key for identification purposes (e.g., oriva_pk_live_abc123)';

COMMENT ON COLUMN oriva_platform.developer_api_keys.usage_count IS
  'Number of times this API key has been used for authentication';

COMMENT ON COLUMN oriva_platform.developer_api_keys.last_used_at IS
  'Timestamp of the last successful authentication with this key';

COMMENT ON COLUMN oriva_platform.developer_api_keys.expires_at IS
  'Optional expiration timestamp. Keys cannot be used after this time.';

-- Row Level Security (RLS) Policies
ALTER TABLE oriva_platform.developer_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY service_role_all ON oriva_platform.developer_api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated reads for key validation
-- This allows the API to validate keys without exposing sensitive data
CREATE POLICY api_key_validation ON oriva_platform.developer_api_keys
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND deleted_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Policy: No public access
-- Keys should never be readable by unauthenticated users

-- Grant permissions
GRANT SELECT ON oriva_platform.developer_api_keys TO authenticated;
GRANT ALL ON oriva_platform.developer_api_keys TO service_role;

-- Example: Insert a test key for reference
-- DO NOT use this in production - generate keys using the migration script
/*
INSERT INTO oriva_platform.developer_api_keys (
  app_id,
  name,
  key_hash,
  key_prefix,
  environment,
  is_active
) VALUES (
  'platform',
  'Example Platform Key',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', -- Hash of empty string (DO NOT USE)
  'oriva_pk_test_exampl',
  'test',
  false -- Inactive by default
) ON CONFLICT (key_hash) DO NOTHING;
*/
