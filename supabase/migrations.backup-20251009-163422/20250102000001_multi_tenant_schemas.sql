-- Multi-Tenant Schema Migration
-- Task: T001
-- Created: 2025-01-02
--
-- Creates the multi-schema architecture for Hugo Multi-Tenant platform:
-- - oriva_platform: Platform-wide tables (users, apps, user_app_access)
-- - hugo_ai: Shared AI intelligence (sessions, insights)
-- - App-specific schemas: hugo_love, hugo_career (profiles, app-specific tables)
--
-- Foreign keys cross schema boundaries to maintain referential integrity.

BEGIN;

-- =============================================================================
-- SCHEMA CREATION
-- =============================================================================

-- Create platform schema
CREATE SCHEMA IF NOT EXISTS oriva_platform;

-- Create shared AI schema
CREATE SCHEMA IF NOT EXISTS hugo_ai;

-- Create app-specific schemas
CREATE SCHEMA IF NOT EXISTS hugo_love;
CREATE SCHEMA IF NOT EXISTS hugo_career;

-- Set search path to include all schemas
ALTER DATABASE postgres SET search_path TO public, oriva_platform, hugo_ai;

COMMENT ON SCHEMA oriva_platform IS 'Platform-wide tables for users, apps, and access control';
COMMENT ON SCHEMA hugo_ai IS 'Shared AI intelligence data across all Hugo apps';
COMMENT ON SCHEMA hugo_love IS 'Hugo Love dating app specific data';
COMMENT ON SCHEMA hugo_career IS 'Hugo Career coaching app specific data';

-- =============================================================================
-- ORIVA_PLATFORM SCHEMA TABLES
-- =============================================================================

-- Apps table (platform-wide app registry)
CREATE TABLE IF NOT EXISTS oriva_platform.apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    schema_name TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'extracting')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_apps_app_id ON oriva_platform.apps(app_id);
CREATE INDEX idx_apps_status ON oriva_platform.apps(status);

COMMENT ON TABLE oriva_platform.apps IS 'Registry of all applications in the platform';
COMMENT ON COLUMN oriva_platform.apps.schema_name IS 'PostgreSQL schema name for app-specific data';

-- Users table (platform-wide user registry)
CREATE TABLE IF NOT EXISTS oriva_platform.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'oriva_sso',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON oriva_platform.users(email);
CREATE INDEX idx_users_last_active_at ON oriva_platform.users(last_active_at);

COMMENT ON TABLE oriva_platform.users IS 'Platform-wide user registry (single source of truth)';

-- User-App Access table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS oriva_platform.user_app_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES oriva_platform.apps(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    UNIQUE(user_id, app_id)
);

CREATE INDEX idx_user_app_access_user_id ON oriva_platform.user_app_access(user_id);
CREATE INDEX idx_user_app_access_app_id ON oriva_platform.user_app_access(app_id);
CREATE INDEX idx_user_app_access_status ON oriva_platform.user_app_access(status);

COMMENT ON TABLE oriva_platform.user_app_access IS 'User access control and roles per app';

-- =============================================================================
-- HUGO_AI SCHEMA TABLES (Shared AI Intelligence)
-- =============================================================================

-- Sessions table (AI coaching sessions from all apps)
CREATE TABLE IF NOT EXISTS hugo_ai.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES oriva_platform.apps(id) ON DELETE RESTRICT,
    session_type TEXT NOT NULL CHECK (session_type IN ('chat', 'analysis', 'coaching', 'practice')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    message_count INTEGER NOT NULL DEFAULT 0,
    context_data JSONB DEFAULT '{}',
    insights_generated JSONB DEFAULT '[]',
    quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON hugo_ai.sessions(user_id);
CREATE INDEX idx_sessions_app_id ON hugo_ai.sessions(app_id);
CREATE INDEX idx_sessions_session_type ON hugo_ai.sessions(session_type);
CREATE INDEX idx_sessions_started_at ON hugo_ai.sessions(started_at);

COMMENT ON TABLE hugo_ai.sessions IS 'AI coaching sessions from all Hugo apps';
COMMENT ON COLUMN hugo_ai.sessions.context_data IS 'Session-specific context (domain, goals, mood, etc.)';
COMMENT ON COLUMN hugo_ai.sessions.insights_generated IS 'Array of insights generated during session';

-- Insights table (AI-generated insights with cross-app visibility)
CREATE TABLE IF NOT EXISTS hugo_ai.insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES hugo_ai.sessions(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('pattern', 'recommendation', 'goal_progress')),
    content TEXT NOT NULL,
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    source_app_id TEXT NOT NULL,
    cross_app_visibility BOOLEAN NOT NULL DEFAULT false,
    supporting_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insights_user_id ON hugo_ai.insights(user_id);
CREATE INDEX idx_insights_session_id ON hugo_ai.insights(session_id);
CREATE INDEX idx_insights_confidence ON hugo_ai.insights(confidence);
CREATE INDEX idx_insights_cross_app_visibility ON hugo_ai.insights(cross_app_visibility);
CREATE INDEX idx_insights_source_app_id ON hugo_ai.insights(source_app_id);

COMMENT ON TABLE hugo_ai.insights IS 'AI insights with 0.7 confidence threshold for cross-app visibility';
COMMENT ON COLUMN hugo_ai.insights.cross_app_visibility IS 'True if confidence >= 0.7 (enables cross-app sharing)';

-- =============================================================================
-- HUGO_LOVE SCHEMA TABLES (Dating App Specific)
-- =============================================================================

-- Profiles table (dating profiles)
CREATE TABLE IF NOT EXISTS hugo_love.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL DEFAULT 'hugo_love',
    profile_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hugo_love_profiles_user_id ON hugo_love.profiles(user_id);

COMMENT ON TABLE hugo_love.profiles IS 'Hugo Love dating profiles (JSONB for flexible schema)';
COMMENT ON COLUMN hugo_love.profiles.profile_data IS 'Dating profile data: age, gender, interests, preferences, etc.';

-- Ice Breakers table (AI-generated conversation starters)
CREATE TABLE IF NOT EXISTS hugo_love.ice_breakers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES hugo_love.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('shared_interest', 'photo_comment', 'conversation_starter')),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    personalization_factors JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ice_breakers_profile_id ON hugo_love.ice_breakers(profile_id);
CREATE INDEX idx_ice_breakers_confidence ON hugo_love.ice_breakers(confidence);

COMMENT ON TABLE hugo_love.ice_breakers IS 'AI-generated personalized ice breakers for dating profiles';

-- =============================================================================
-- HUGO_CAREER SCHEMA TABLES (Career Coaching App Specific)
-- =============================================================================

-- Profiles table (professional profiles)
CREATE TABLE IF NOT EXISTS hugo_career.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
    app_id TEXT NOT NULL DEFAULT 'hugo_career',
    profile_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hugo_career_profiles_user_id ON hugo_career.profiles(user_id);

COMMENT ON TABLE hugo_career.profiles IS 'Hugo Career professional profiles (JSONB for flexible schema)';
COMMENT ON COLUMN hugo_career.profiles.profile_data IS 'Professional profile data: role, skills, goals, education, etc.';

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_apps_updated_at BEFORE UPDATE ON oriva_platform.apps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON oriva_platform.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hugo_love_profiles_updated_at BEFORE UPDATE ON hugo_love.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hugo_career_profiles_updated_at BEFORE UPDATE ON hugo_career.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SEED DATA (Initial Apps)
-- =============================================================================
-- NOTE: App seed data moved to supabase/seed.sql for test data consistency
-- Migration creates only the schema structure, seed.sql provides test data

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to set schema search path dynamically
CREATE OR REPLACE FUNCTION set_schema_path(schema_name TEXT)
RETURNS void AS $$
BEGIN
    EXECUTE format('SET search_path TO %I, oriva_platform, hugo_ai, public', schema_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_schema_path IS 'Dynamically set search path for app-specific schema routing';

-- Function to get app schema by app_id
CREATE OR REPLACE FUNCTION get_app_schema(p_app_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_schema_name TEXT;
BEGIN
    SELECT schema_name INTO v_schema_name
    FROM oriva_platform.apps
    WHERE app_id = p_app_id;

    RETURN v_schema_name;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_app_schema IS 'Get schema name for an app_id';

-- =============================================================================
-- PERMISSIONS - Grant schema access to anon, authenticated, and service_role
-- =============================================================================

-- Grant USAGE on all schemas to all roles
GRANT USAGE ON SCHEMA oriva_platform TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA hugo_ai TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA hugo_love TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA hugo_career TO anon, authenticated, service_role;

-- Grant SELECT on all tables (RLS will handle row-level security for anon/authenticated)
GRANT SELECT ON ALL TABLES IN SCHEMA oriva_platform TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA hugo_ai TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA hugo_love TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA hugo_career TO anon, authenticated, service_role;

-- Grant INSERT, UPDATE, DELETE (service_role gets full access, bypasses RLS)
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA oriva_platform TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hugo_ai TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hugo_love TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hugo_career TO authenticated, service_role;

-- Grant sequence usage for ID generation
GRANT USAGE ON ALL SEQUENCES IN SCHEMA oriva_platform TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hugo_ai TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hugo_love TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hugo_career TO authenticated, service_role;

COMMIT;
