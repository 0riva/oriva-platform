-- Rollback Script for Multi-Tenant Migration
-- Task: T003
-- Created: 2025-01-02
--
-- DANGER: This script will DELETE all multi-schema data and DROP all schemas.
-- Use ONLY if you need to completely roll back the multi-tenant migration.
--
-- To execute this rollback:
-- 1. Verify you have backups of all data
-- 2. Run this script manually: psql -f 20250102000003_rollback_script.sql
--
-- This script does NOT auto-execute during normal migrations.

-- Uncomment the following line to enable rollback execution
-- DO $$ BEGIN RAISE EXCEPTION 'Rollback script requires manual execution confirmation'; END $$;

BEGIN;

-- =============================================================================
-- STEP 1: Verification Check
-- =============================================================================

DO $$
DECLARE
    v_user_count INTEGER;
    v_session_count INTEGER;
    v_profile_count INTEGER;
BEGIN
    -- Count records to be deleted
    SELECT COUNT(*) INTO v_user_count FROM oriva_platform.users;
    SELECT COUNT(*) INTO v_session_count FROM hugo_ai.sessions;
    SELECT COUNT(*) INTO v_profile_count FROM hugo_love.profiles;

    RAISE WARNING '';
    RAISE WARNING '=== ROLLBACK WARNING ===';
    RAISE WARNING 'This will DELETE the following data:';
    RAISE WARNING '  - % users from oriva_platform.users', v_user_count;
    RAISE WARNING '  - % sessions from hugo_ai.sessions', v_session_count;
    RAISE WARNING '  - % profiles from hugo_love.profiles', v_profile_count;
    RAISE WARNING '  - All other records in multi-tenant schemas';
    RAISE WARNING '';
    RAISE WARNING 'Schemas to be DROPPED:';
    RAISE WARNING '  - oriva_platform';
    RAISE WARNING '  - hugo_ai';
    RAISE WARNING '  - hugo_love';
    RAISE WARNING '  - hugo_career';
    RAISE WARNING '========================';
    RAISE WARNING '';

    -- Require explicit confirmation
    -- Comment out this line to proceed with rollback
    RAISE EXCEPTION 'Rollback requires explicit confirmation. Comment out this line to proceed.';
END $$;

-- =============================================================================
-- STEP 2: Drop Helper Functions
-- =============================================================================

DROP FUNCTION IF EXISTS set_schema_path(TEXT);
DROP FUNCTION IF EXISTS get_app_schema(TEXT);
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

RAISE NOTICE 'Dropped helper functions';

-- =============================================================================
-- STEP 3: Drop App-Specific Schemas and Tables
-- =============================================================================

-- Drop hugo_love schema (CASCADE will drop all tables and dependent objects)
DROP SCHEMA IF EXISTS hugo_love CASCADE;
RAISE NOTICE 'Dropped hugo_love schema and all tables';

-- Drop hugo_career schema
DROP SCHEMA IF EXISTS hugo_career CASCADE;
RAISE NOTICE 'Dropped hugo_career schema and all tables';

-- =============================================================================
-- STEP 4: Drop Shared AI Schema
-- =============================================================================

-- Drop hugo_ai schema (CASCADE will drop sessions, insights, and dependencies)
DROP SCHEMA IF EXISTS hugo_ai CASCADE;
RAISE NOTICE 'Dropped hugo_ai schema and all tables';

-- =============================================================================
-- STEP 5: Drop Platform Schema
-- =============================================================================

-- Drop oriva_platform schema (CASCADE will drop users, apps, user_app_access)
DROP SCHEMA IF EXISTS oriva_platform CASCADE;
RAISE NOTICE 'Dropped oriva_platform schema and all tables';

-- =============================================================================
-- STEP 6: Reset Database Search Path
-- =============================================================================

ALTER DATABASE postgres SET search_path TO public;
RAISE NOTICE 'Reset database search path to public';

-- =============================================================================
-- STEP 7: Rollback Complete
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== ROLLBACK COMPLETE ===';
    RAISE NOTICE 'All multi-tenant schemas and tables have been dropped.';
    RAISE NOTICE 'Database has been rolled back to pre-migration state.';
    RAISE NOTICE '';
    RAISE NOTICE 'IMPORTANT: If you had data in these schemas that was not migrated';
    RAISE NOTICE 'from the public schema, that data is now PERMANENTLY DELETED.';
    RAISE NOTICE '';
    RAISE NOTICE 'To restore from backup:';
    RAISE NOTICE '  1. Restore database from backup';
    RAISE NOTICE '  2. Re-run migrations if needed';
    RAISE NOTICE '=========================';
END $$;

COMMIT;

-- =============================================================================
-- OPTIONAL: Restore Old Public Schema Tables (if backed up)
-- =============================================================================

-- If you have backups of the old public schema tables, you can restore them here.
-- Example:
--
-- CREATE TABLE public.users AS SELECT * FROM backup_schema.users;
-- CREATE TABLE public.profiles AS SELECT * FROM backup_schema.profiles;
-- CREATE TABLE public.sessions AS SELECT * FROM backup_schema.sessions;
-- etc.
