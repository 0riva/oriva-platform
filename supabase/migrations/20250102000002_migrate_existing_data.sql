-- Data Migration Script
-- Task: T002
-- Created: 2025-01-02
--
-- Migrates existing Hugo Love data from public schema to new multi-schema architecture:
-- - Migrate users to oriva_platform.users
-- - Create app registration for hugo_love
-- - Migrate profiles to hugo_love.profiles
-- - Migrate sessions to hugo_ai.sessions
-- - Create user_app_access records
--
-- IMPORTANT: This migration is idempotent and can be run multiple times safely.

BEGIN;

-- =============================================================================
-- STEP 1: Migrate Users to oriva_platform.users
-- =============================================================================

-- Check if old users table exists in public schema
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) THEN
        -- Migrate users from public.users to oriva_platform.users
        INSERT INTO oriva_platform.users (id, email, full_name, auth_provider, created_at, updated_at)
        SELECT
            id,
            email,
            full_name,
            COALESCE(auth_provider, 'oriva_sso'),
            created_at,
            updated_at
        FROM public.users
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Migrated % users from public.users to oriva_platform.users',
            (SELECT COUNT(*) FROM oriva_platform.users);
    ELSE
        RAISE NOTICE 'No public.users table found, skipping user migration';
    END IF;
END $$;

-- =============================================================================
-- STEP 2: Create User-App Access Records for Hugo Love
-- =============================================================================

-- Get hugo_love app_id
DO $$
DECLARE
    v_hugo_love_app_id UUID;
BEGIN
    SELECT id INTO v_hugo_love_app_id
    FROM oriva_platform.apps
    WHERE app_id = 'hugo_love';

    IF v_hugo_love_app_id IS NOT NULL THEN
        -- Create user_app_access for all existing users
        INSERT INTO oriva_platform.user_app_access (user_id, app_id, role, status, joined_at)
        SELECT
            id,
            v_hugo_love_app_id,
            'user',
            'active',
            created_at
        FROM oriva_platform.users
        ON CONFLICT (user_id, app_id) DO NOTHING;

        RAISE NOTICE 'Created % user_app_access records for hugo_love',
            (SELECT COUNT(*) FROM oriva_platform.user_app_access WHERE app_id = v_hugo_love_app_id);
    ELSE
        RAISE WARNING 'Hugo Love app not found, skipping user_app_access creation';
    END IF;
END $$;

-- =============================================================================
-- STEP 3: Migrate Profiles to hugo_love.profiles
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'profiles'
    ) THEN
        -- Migrate profiles from public.profiles to hugo_love.profiles
        INSERT INTO hugo_love.profiles (id, user_id, app_id, profile_data, created_at, updated_at)
        SELECT
            id,
            user_id,
            'hugo_love',
            -- Convert existing columns to JSONB profile_data
            jsonb_build_object(
                'age', age,
                'gender', gender,
                'bio', bio,
                'interests', interests,
                'location', location,
                'looking_for', looking_for,
                'relationship_goals', relationship_goals,
                'dating_preferences', dating_preferences,
                'photos', photos,
                'personality_traits', personality_traits
            ),
            created_at,
            updated_at
        FROM public.profiles
        ON CONFLICT (user_id) DO NOTHING;

        RAISE NOTICE 'Migrated % profiles to hugo_love.profiles',
            (SELECT COUNT(*) FROM hugo_love.profiles);
    ELSE
        RAISE NOTICE 'No public.profiles table found, skipping profile migration';
    END IF;
END $$;

-- =============================================================================
-- STEP 4: Migrate Sessions to hugo_ai.sessions
-- =============================================================================

DO $$
DECLARE
    v_hugo_love_app_id UUID;
BEGIN
    SELECT id INTO v_hugo_love_app_id
    FROM oriva_platform.apps
    WHERE app_id = 'hugo_love';

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'sessions'
    ) AND v_hugo_love_app_id IS NOT NULL THEN
        -- Migrate sessions from public.sessions to hugo_ai.sessions
        INSERT INTO hugo_ai.sessions (
            id, user_id, app_id, session_type,
            started_at, ended_at, duration_seconds, message_count,
            context_data, insights_generated, quality_score, created_at
        )
        SELECT
            id,
            user_id,
            v_hugo_love_app_id,
            COALESCE(session_type, 'coaching'),
            started_at,
            ended_at,
            duration_seconds,
            COALESCE(message_count, 0),
            COALESCE(context_data, '{}'::jsonb),
            COALESCE(insights_generated, '[]'::jsonb),
            quality_score,
            created_at
        FROM public.sessions
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Migrated % sessions to hugo_ai.sessions',
            (SELECT COUNT(*) FROM hugo_ai.sessions WHERE app_id = v_hugo_love_app_id);
    ELSE
        RAISE NOTICE 'No public.sessions table found or app not found, skipping session migration';
    END IF;
END $$;

-- =============================================================================
-- STEP 5: Migrate Insights to hugo_ai.insights
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'insights'
    ) THEN
        -- Migrate insights from public.insights to hugo_ai.insights
        INSERT INTO hugo_ai.insights (
            id, user_id, session_id, insight_type, content, confidence,
            source_app_id, cross_app_visibility, supporting_data, created_at
        )
        SELECT
            id,
            user_id,
            session_id,
            insight_type,
            content,
            confidence,
            'hugo_love',
            (confidence >= 0.7), -- Apply 0.7 threshold rule
            COALESCE(supporting_data, '{}'::jsonb),
            created_at
        FROM public.insights
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Migrated % insights to hugo_ai.insights',
            (SELECT COUNT(*) FROM hugo_ai.insights WHERE source_app_id = 'hugo_love');
    ELSE
        RAISE NOTICE 'No public.insights table found, skipping insight migration';
    END IF;
END $$;

-- =============================================================================
-- STEP 6: Migrate Ice Breakers to hugo_love.ice_breakers
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ice_breakers'
    ) THEN
        -- Migrate ice_breakers from public.ice_breakers to hugo_love.ice_breakers
        -- Map user_id to profile_id first
        INSERT INTO hugo_love.ice_breakers (id, profile_id, content, category, confidence, personalization_factors, created_at)
        SELECT
            ib.id,
            p.id, -- profile_id from hugo_love.profiles
            ib.content,
            ib.category,
            ib.confidence,
            COALESCE(ib.personalization_factors, '{}'::jsonb),
            ib.created_at
        FROM public.ice_breakers ib
        JOIN hugo_love.profiles p ON p.user_id = ib.user_id
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Migrated % ice breakers to hugo_love.ice_breakers',
            (SELECT COUNT(*) FROM hugo_love.ice_breakers);
    ELSE
        RAISE NOTICE 'No public.ice_breakers table found, skipping ice breaker migration';
    END IF;
END $$;

-- =============================================================================
-- STEP 7: Verification and Summary
-- =============================================================================

DO $$
DECLARE
    v_users_count INTEGER;
    v_profiles_count INTEGER;
    v_sessions_count INTEGER;
    v_insights_count INTEGER;
    v_ice_breakers_count INTEGER;
    v_user_app_access_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_users_count FROM oriva_platform.users;
    SELECT COUNT(*) INTO v_profiles_count FROM hugo_love.profiles;
    SELECT COUNT(*) INTO v_sessions_count FROM hugo_ai.sessions;
    SELECT COUNT(*) INTO v_insights_count FROM hugo_ai.insights;
    SELECT COUNT(*) INTO v_ice_breakers_count FROM hugo_love.ice_breakers;
    SELECT COUNT(*) INTO v_user_app_access_count FROM oriva_platform.user_app_access;

    RAISE NOTICE '';
    RAISE NOTICE '=== DATA MIGRATION SUMMARY ===';
    RAISE NOTICE 'Users migrated: %', v_users_count;
    RAISE NOTICE 'Profiles migrated: %', v_profiles_count;
    RAISE NOTICE 'Sessions migrated: %', v_sessions_count;
    RAISE NOTICE 'Insights migrated: %', v_insights_count;
    RAISE NOTICE 'Ice breakers migrated: %', v_ice_breakers_count;
    RAISE NOTICE 'User-app access records: %', v_user_app_access_count;
    RAISE NOTICE '==============================';
    RAISE NOTICE '';
END $$;

-- =============================================================================
-- STEP 8: Update Statistics
-- =============================================================================

-- Analyze tables for query optimization
ANALYZE oriva_platform.users;
ANALYZE oriva_platform.apps;
ANALYZE oriva_platform.user_app_access;
ANALYZE hugo_ai.sessions;
ANALYZE hugo_ai.insights;
ANALYZE hugo_love.profiles;
ANALYZE hugo_love.ice_breakers;

COMMIT;

-- Note: Old public schema tables are NOT dropped automatically for safety.
-- To drop old tables after verifying migration success, run:
-- DROP TABLE IF EXISTS public.users CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- DROP TABLE IF EXISTS public.sessions CASCADE;
-- DROP TABLE IF EXISTS public.insights CASCADE;
-- DROP TABLE IF EXISTS public.ice_breakers CASCADE;
