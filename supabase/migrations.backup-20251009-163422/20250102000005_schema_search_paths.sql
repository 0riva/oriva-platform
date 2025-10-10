-- Configure Schema Search Paths and Security
-- Task: T005
-- Created: 2025-01-02
--
-- Sets up proper schema search paths, RLS policies, and permissions
-- for multi-tenant architecture security and routing.

BEGIN;

-- =============================================================================
-- SCHEMA PERMISSIONS
-- =============================================================================

-- Grant usage on all schemas to authenticated users
GRANT USAGE ON SCHEMA oriva_platform TO authenticated;
GRANT USAGE ON SCHEMA hugo_ai TO authenticated;
GRANT USAGE ON SCHEMA hugo_love TO authenticated;
GRANT USAGE ON SCHEMA hugo_career TO authenticated;

-- Grant SELECT on all tables in schemas (RLS will control actual access)
GRANT SELECT ON ALL TABLES IN SCHEMA oriva_platform TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hugo_ai TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hugo_love TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hugo_career TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA oriva_platform TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hugo_ai TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hugo_love TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA hugo_career TO authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE oriva_platform.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE oriva_platform.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE oriva_platform.user_app_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE oriva_platform.extraction_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_ai.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_ai.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_love.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_love.ice_breakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_career.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PLATFORM SCHEMA RLS POLICIES
-- =============================================================================

-- Users: Users can only see their own record
CREATE POLICY users_select_own ON oriva_platform.users
    FOR SELECT
    USING (id = auth.uid());

CREATE POLICY users_update_own ON oriva_platform.users
    FOR UPDATE
    USING (id = auth.uid());

-- Apps: All authenticated users can view apps
CREATE POLICY apps_select_all ON oriva_platform.apps
    FOR SELECT
    TO authenticated
    USING (true);

-- User-App Access: Users can only see their own access records
CREATE POLICY user_app_access_select_own ON oriva_platform.user_app_access
    FOR SELECT
    USING (user_id = auth.uid());

-- Extraction Manifests: Users can only see their own manifests
CREATE POLICY extraction_manifests_select_own ON oriva_platform.extraction_manifests
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY extraction_manifests_insert_own ON oriva_platform.extraction_manifests
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- HUGO AI SCHEMA RLS POLICIES
-- =============================================================================

-- Sessions: Users can only access their own sessions
CREATE POLICY sessions_select_own ON hugo_ai.sessions
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY sessions_insert_own ON hugo_ai.sessions
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY sessions_update_own ON hugo_ai.sessions
    FOR UPDATE
    USING (user_id = auth.uid());

-- Insights: Users can see their own insights + cross-app visible insights
CREATE POLICY insights_select_own_or_cross_app ON hugo_ai.insights
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        (cross_app_visibility = true AND user_id = auth.uid())
    );

CREATE POLICY insights_insert_own ON hugo_ai.insights
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- APP-SPECIFIC SCHEMA RLS POLICIES (Hugo Love)
-- =============================================================================

-- Profiles: Users can only access their own profile
CREATE POLICY hugo_love_profiles_select_own ON hugo_love.profiles
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY hugo_love_profiles_insert_own ON hugo_love.profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY hugo_love_profiles_update_own ON hugo_love.profiles
    FOR UPDATE
    USING (user_id = auth.uid());

-- Ice Breakers: Users can only see ice breakers for their own profile
CREATE POLICY hugo_love_ice_breakers_select_own ON hugo_love.ice_breakers
    FOR SELECT
    USING (profile_id IN (SELECT id FROM hugo_love.profiles WHERE user_id = auth.uid()));

-- =============================================================================
-- APP-SPECIFIC SCHEMA RLS POLICIES (Hugo Career)
-- =============================================================================

-- Profiles: Users can only access their own profile
CREATE POLICY hugo_career_profiles_select_own ON hugo_career.profiles
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY hugo_career_profiles_insert_own ON hugo_career.profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY hugo_career_profiles_update_own ON hugo_career.profiles
    FOR UPDATE
    USING (user_id = auth.uid());

-- =============================================================================
-- SCHEMA ROUTING HELPER FUNCTIONS
-- =============================================================================

-- Function to get user's accessible apps
CREATE OR REPLACE FUNCTION oriva_platform.get_user_apps(p_user_id UUID)
RETURNS TABLE (
    app_id UUID,
    app_identifier TEXT,
    app_name TEXT,
    schema_name TEXT,
    role TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.app_id,
        a.name,
        a.schema_name,
        uaa.role,
        uaa.status
    FROM oriva_platform.apps a
    JOIN oriva_platform.user_app_access uaa ON a.id = uaa.app_id
    WHERE uaa.user_id = p_user_id AND uaa.status = 'active';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION oriva_platform.get_user_apps IS 'Get all apps accessible by a user';

-- Function to check if user has access to an app
CREATE OR REPLACE FUNCTION oriva_platform.user_has_app_access(
    p_user_id UUID,
    p_app_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_access BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM oriva_platform.user_app_access uaa
        JOIN oriva_platform.apps a ON a.id = uaa.app_id
        WHERE uaa.user_id = p_user_id
          AND a.app_id = p_app_id
          AND uaa.status = 'active'
    ) INTO v_has_access;

    RETURN v_has_access;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION oriva_platform.user_has_app_access IS 'Check if user has access to a specific app';

-- Function to set schema path for API request
CREATE OR REPLACE FUNCTION oriva_platform.set_request_schema_path(p_app_id TEXT)
RETURNS void AS $$
DECLARE
    v_schema_name TEXT;
BEGIN
    -- Get schema name for app
    SELECT schema_name INTO v_schema_name
    FROM oriva_platform.apps
    WHERE app_id = p_app_id;

    IF v_schema_name IS NULL THEN
        RAISE EXCEPTION 'App not found: %', p_app_id;
    END IF;

    -- Set search path: app_schema, hugo_ai, oriva_platform, public
    EXECUTE format('SET LOCAL search_path TO %I, hugo_ai, oriva_platform, public', v_schema_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION oriva_platform.set_request_schema_path IS 'Set schema search path for API request based on X-App-ID header';

-- =============================================================================
-- GDPR HELPER FUNCTIONS
-- =============================================================================

-- Function to delete all user data across all schemas (GDPR Right to Erasure)
CREATE OR REPLACE FUNCTION oriva_platform.delete_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_apps_processed TEXT[];
    v_deletion_summary JSONB := '{}';
    v_total_deleted INTEGER := 0;
    v_app RECORD;
    v_count INTEGER;
    v_confirmation_token TEXT;
BEGIN
    -- Generate confirmation token
    v_confirmation_token := 'del_' || substr(md5(p_user_id::TEXT || NOW()::TEXT), 1, 12);

    -- Get all apps user has access to
    FOR v_app IN
        SELECT DISTINCT a.app_id, a.schema_name
        FROM oriva_platform.apps a
        JOIN oriva_platform.user_app_access uaa ON a.id = uaa.app_id
        WHERE uaa.user_id = p_user_id
    LOOP
        v_apps_processed := array_append(v_apps_processed, v_app.app_id);

        -- Delete profiles from app-specific schema
        EXECUTE format('DELETE FROM %I.profiles WHERE user_id = $1', v_app.schema_name)
        USING p_user_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_total_deleted := v_total_deleted + v_count;
        v_deletion_summary := jsonb_set(
            v_deletion_summary,
            ARRAY[v_app.schema_name, 'profiles'],
            to_jsonb(v_count)
        );
    END LOOP;

    -- Delete hugo_ai sessions
    DELETE FROM hugo_ai.sessions WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_count;
    v_deletion_summary := jsonb_set(v_deletion_summary, '{hugo_ai,sessions}', to_jsonb(v_count));

    -- Delete hugo_ai insights
    DELETE FROM hugo_ai.insights WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_count;
    v_deletion_summary := jsonb_set(v_deletion_summary, '{hugo_ai,insights}', to_jsonb(v_count));

    -- Delete user_app_access records
    DELETE FROM oriva_platform.user_app_access WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_count;
    v_deletion_summary := jsonb_set(v_deletion_summary, '{oriva_platform,user_app_access}', to_jsonb(v_count));

    -- Delete user record (will cascade to extraction_manifests)
    DELETE FROM oriva_platform.users WHERE id = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_count;
    v_deletion_summary := jsonb_set(v_deletion_summary, '{oriva_platform,users}', to_jsonb(v_count));

    -- Return deletion summary
    RETURN jsonb_build_object(
        'user_id', p_user_id,
        'deleted_at', NOW(),
        'apps_processed', to_jsonb(v_apps_processed),
        'deletion_summary', v_deletion_summary,
        'total_records_deleted', v_total_deleted,
        'confirmation_token', v_confirmation_token
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION oriva_platform.delete_user_data IS 'GDPR Right to Erasure - Delete all user data across all schemas';

COMMIT;
