-- Migration: Add verification_codes table for customer self-service authentication
-- This enables customers to verify their identity via email without passwords

-- Create the verification_codes table
CREATE TABLE IF NOT EXISTS limohawk.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by email (most common query)
CREATE INDEX IF NOT EXISTS idx_verification_codes_email
  ON limohawk.verification_codes(email);

-- Index for code lookup during verification
CREATE INDEX IF NOT EXISTS idx_verification_codes_code
  ON limohawk.verification_codes(code);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at
  ON limohawk.verification_codes(expires_at);

-- Function to clean up old/expired verification codes (run periodically)
CREATE OR REPLACE FUNCTION limohawk.cleanup_verification_codes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM limohawk.verification_codes
  WHERE expires_at < NOW() - INTERVAL '24 hours'
     OR used_at IS NOT NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON limohawk.verification_codes TO service_role;
GRANT EXECUTE ON FUNCTION limohawk.cleanup_verification_codes() TO service_role;

COMMENT ON TABLE limohawk.verification_codes IS 'Stores temporary verification codes for customer email authentication';
COMMENT ON COLUMN limohawk.verification_codes.code IS '6-digit verification code sent to customer email';
COMMENT ON COLUMN limohawk.verification_codes.expires_at IS 'Code expires 15 minutes after creation';
COMMENT ON COLUMN limohawk.verification_codes.used_at IS 'Timestamp when code was successfully used (prevents reuse)';
