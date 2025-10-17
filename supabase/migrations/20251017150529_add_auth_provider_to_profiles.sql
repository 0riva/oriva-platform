-- Migration: Add Authentication Provider Columns to Hugo Love Profiles
-- Purpose: Track which authentication method was used for each profile (email, Apple, OAuth)
-- Pattern: Nullable columns for multi-provider support

-- Add authentication provider columns to hugo_love.profiles
ALTER TABLE hugo_love.profiles ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email' CHECK (auth_provider IN ('email', 'apple', 'oriva_oauth'));
ALTER TABLE hugo_love.profiles ADD COLUMN IF NOT EXISTS auth_provider_user_id TEXT; -- External user ID from provider (e.g., Apple user ID)
ALTER TABLE hugo_love.profiles ADD COLUMN IF NOT EXISTS auth_provider_linked_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for provider lookups
CREATE INDEX IF NOT EXISTS idx_profiles_auth_provider ON hugo_love.profiles(auth_provider);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_provider_user_id ON hugo_love.profiles(auth_provider_user_id);

-- Add comment for documentation
COMMENT ON COLUMN hugo_love.profiles.auth_provider IS 'Authentication method used: email (password), apple (Sign in with Apple), oriva_oauth (OAuth with Oriva account)';
COMMENT ON COLUMN hugo_love.profiles.auth_provider_user_id IS 'External user ID from authentication provider (e.g., Apple private relay email or OAuth subject)';
COMMENT ON COLUMN hugo_love.profiles.auth_provider_linked_at IS 'When the authentication provider was linked to this profile';
