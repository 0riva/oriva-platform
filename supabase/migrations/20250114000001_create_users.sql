-- Migration: Create users table
-- Task: T001
-- Description: Core user identity table with Oriva SSO integration

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oriva_user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,

  -- User preferences (shared across all apps)
  preferences JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'free',

  -- Data retention settings
  data_retention_days INTEGER DEFAULT 365,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX users_oriva_id_idx ON users(oriva_user_id);
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_active_idx ON users(last_active_at DESC);

-- Constraints
ALTER TABLE users ADD CONSTRAINT users_retention_check
  CHECK (data_retention_days BETWEEN 30 AND 1825);

ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'premium', 'enterprise'));

-- RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE users IS 'Core user identity table with Oriva SSO integration';
COMMENT ON COLUMN users.oriva_user_id IS 'Reference to Oriva 101 user auth.uid()';
COMMENT ON COLUMN users.data_retention_days IS 'User-configurable retention period (30-1825 days)';
COMMENT ON COLUMN users.subscription_tier IS 'Subscription level: free, premium, or enterprise';