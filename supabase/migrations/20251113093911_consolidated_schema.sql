

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "hugo_ai";


ALTER SCHEMA "hugo_ai" OWNER TO "postgres";


COMMENT ON SCHEMA "hugo_ai" IS 'Shared AI intelligence data across all Hugo apps';



CREATE SCHEMA IF NOT EXISTS "hugo_career";


ALTER SCHEMA "hugo_career" OWNER TO "postgres";


COMMENT ON SCHEMA "hugo_career" IS 'Hugo Career coaching app specific data';



CREATE SCHEMA IF NOT EXISTS "hugo_love";


ALTER SCHEMA "hugo_love" OWNER TO "postgres";


COMMENT ON SCHEMA "hugo_love" IS 'Hugo Love dating app specific data';



CREATE SCHEMA IF NOT EXISTS "live_mixers";


ALTER SCHEMA "live_mixers" OWNER TO "postgres";


COMMENT ON SCHEMA "live_mixers" IS 'Live Mixers app specific data - event discovery and social gatherings';



CREATE SCHEMA IF NOT EXISTS "oriva_platform";


ALTER SCHEMA "oriva_platform" OWNER TO "postgres";


COMMENT ON SCHEMA "oriva_platform" IS 'Platform-wide tables for users, apps, and access control';



COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "work_buddy";


ALTER SCHEMA "work_buddy" OWNER TO "postgres";


COMMENT ON SCHEMA "work_buddy" IS 'Work Buddy app specific data - productivity and collaboration features';



CREATE EXTENSION IF NOT EXISTS "cube" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "earthdistance" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "topology";
ALTER SCHEMA "topology" OWNER TO "postgres";
CREATE EXTENSION IF NOT EXISTS "postgis_topology" WITH SCHEMA "topology";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."agreement_status" AS ENUM (
    'draft',
    'active',
    'expired',
    'terminated'
);


ALTER TYPE "public"."agreement_status" OWNER TO "postgres";


CREATE TYPE "public"."audience_type" AS ENUM (
    'individual',
    'group',
    'organization'
);


ALTER TYPE "public"."audience_type" OWNER TO "postgres";


CREATE TYPE "public"."category_type_enum" AS ENUM (
    'functional',
    'industry',
    'platform',
    'audience'
);


ALTER TYPE "public"."category_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."developer_verification_enum" AS ENUM (
    'unverified',
    'pending',
    'verified'
);


ALTER TYPE "public"."developer_verification_enum" OWNER TO "postgres";


CREATE TYPE "public"."entry_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."entry_status" OWNER TO "postgres";


CREATE TYPE "public"."mixer_notification_rule_type" AS ENUM (
    'distance_based',
    'category_based',
    'organizer_based'
);


ALTER TYPE "public"."mixer_notification_rule_type" OWNER TO "postgres";


CREATE TYPE "public"."mixer_notification_timing" AS ENUM (
    'immediate',
    'daily',
    'weekly'
);


ALTER TYPE "public"."mixer_notification_timing" OWNER TO "postgres";


CREATE TYPE "public"."plugin_install_status_enum" AS ENUM (
    'active',
    'disabled',
    'error',
    'updating'
);


ALTER TYPE "public"."plugin_install_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."plugin_permission_enum" AS ENUM (
    'read_entries',
    'write_entries',
    'read_profile',
    'write_profile',
    'read_contacts',
    'write_contacts',
    'network_access',
    'storage_access',
    'camera_access',
    'location_access',
    'admin_functions'
);


ALTER TYPE "public"."plugin_permission_enum" OWNER TO "postgres";


CREATE TYPE "public"."plugin_status_enum" AS ENUM (
    'draft',
    'pending_review',
    'approved',
    'rejected',
    'deprecated'
);


ALTER TYPE "public"."plugin_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."review_rating_enum" AS ENUM (
    '1',
    '2',
    '3',
    '4',
    '5'
);


ALTER TYPE "public"."review_rating_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "live_mixers"."create_default_mixer_notification_rules"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO live_mixers.mixer_notification_rules (user_id, notification_type, enabled, created_at, updated_at)
  VALUES
    (p_user_id::text, 'event_reminder', true, NOW(), NOW()),
    (p_user_id::text, 'event_cancellation', true, NOW(), NOW()),
    (p_user_id::text, 'new_event_in_category', false, NOW(), NOW()),
    (p_user_id::text, 'event_full', true, NOW(), NOW())
  ON CONFLICT (user_id, notification_type) DO NOTHING;
END;
$$;


ALTER FUNCTION "live_mixers"."create_default_mixer_notification_rules"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "live_mixers"."update_mixer_event_metadata_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "live_mixers"."update_mixer_event_metadata_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "live_mixers"."update_mixer_notification_rules_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "live_mixers"."update_mixer_notification_rules_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "live_mixers"."update_mixer_user_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "live_mixers"."update_mixer_user_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "oriva_platform"."cleanup_expired_manifests"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM oriva_platform.extraction_manifests
    WHERE expires_at < NOW();

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$;


ALTER FUNCTION "oriva_platform"."cleanup_expired_manifests"() OWNER TO "postgres";


COMMENT ON FUNCTION "oriva_platform"."cleanup_expired_manifests"() IS 'Delete extraction manifests older than 7 days';



CREATE OR REPLACE FUNCTION "oriva_platform"."complete_extraction"("p_manifest_id" "uuid", "p_download_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE oriva_platform.extraction_manifests
    SET
        status = 'completed',
        download_url = p_download_url,
        download_expires_at = NOW() + INTERVAL '7 days',
        completed_at = NOW()
    WHERE id = p_manifest_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Extraction manifest not found: %', p_manifest_id;
    END IF;
END;
$$;


ALTER FUNCTION "oriva_platform"."complete_extraction"("p_manifest_id" "uuid", "p_download_url" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "oriva_platform"."complete_extraction"("p_manifest_id" "uuid", "p_download_url" "text") IS 'Mark extraction as completed with download URL';



CREATE OR REPLACE FUNCTION "oriva_platform"."delete_user_data"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
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
$_$;


ALTER FUNCTION "oriva_platform"."delete_user_data"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "oriva_platform"."delete_user_data"("p_user_id" "uuid") IS 'GDPR Right to Erasure - Delete all user data across all schemas';



CREATE OR REPLACE FUNCTION "oriva_platform"."fail_extraction"("p_manifest_id" "uuid", "p_error_message" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE oriva_platform.extraction_manifests
    SET
        status = 'failed',
        error_message = p_error_message,
        completed_at = NOW()
    WHERE id = p_manifest_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Extraction manifest not found: %', p_manifest_id;
    END IF;
END;
$$;


ALTER FUNCTION "oriva_platform"."fail_extraction"("p_manifest_id" "uuid", "p_error_message" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "oriva_platform"."fail_extraction"("p_manifest_id" "uuid", "p_error_message" "text") IS 'Mark extraction as failed with error message';



CREATE OR REPLACE FUNCTION "oriva_platform"."get_user_apps"("p_user_id" "uuid") RETURNS TABLE("app_id" "uuid", "app_identifier" "text", "app_name" "text", "schema_name" "text", "role" "text", "status" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "oriva_platform"."get_user_apps"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "oriva_platform"."get_user_apps"("p_user_id" "uuid") IS 'Get all apps accessible by a user';



CREATE OR REPLACE FUNCTION "oriva_platform"."prepare_extraction_manifest"("p_user_id" "uuid", "p_source_app_id" "text", "p_target_format" "text" DEFAULT 'json'::"text", "p_include_schemas" "text"[] DEFAULT ARRAY['profiles'::"text", 'sessions'::"text", 'insights'::"text"]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
    v_manifest_id UUID;
    v_profile_count INTEGER := 0;
    v_session_count INTEGER := 0;
    v_insight_count INTEGER := 0;
    v_total_size BIGINT := 0;
    v_schema_name TEXT;
BEGIN
    -- Get app schema name
    SELECT schema_name INTO v_schema_name
    FROM oriva_platform.apps
    WHERE app_id = p_source_app_id;

    IF v_schema_name IS NULL THEN
        RAISE EXCEPTION 'App not found: %', p_source_app_id;
    END IF;

    -- Count profiles if included
    IF 'profiles' = ANY(p_include_schemas) THEN
        EXECUTE format('SELECT COUNT(*) FROM %I.profiles WHERE user_id = $1', v_schema_name)
        INTO v_profile_count
        USING p_user_id;
    END IF;

    -- Count sessions if included
    IF 'sessions' = ANY(p_include_schemas) THEN
        SELECT COUNT(*) INTO v_session_count
        FROM hugo_ai.sessions
        WHERE user_id = p_user_id AND app_id IN (
            SELECT id FROM oriva_platform.apps WHERE app_id = p_source_app_id
        );
    END IF;

    -- Count insights if included
    IF 'insights' = ANY(p_include_schemas) THEN
        SELECT COUNT(*) INTO v_insight_count
        FROM hugo_ai.insights
        WHERE user_id = p_user_id AND source_app_id = p_source_app_id;
    END IF;

    -- Estimate total size (rough calculation: 1KB per record)
    v_total_size := (v_profile_count + v_session_count + v_insight_count) * 1024;

    -- Create extraction manifest
    INSERT INTO oriva_platform.extraction_manifests (
        user_id,
        source_app_id,
        status,
        target_format,
        include_schemas,
        data_summary
    ) VALUES (
        p_user_id,
        p_source_app_id,
        'prepared',
        p_target_format,
        p_include_schemas,
        jsonb_build_object(
            'profiles', v_profile_count,
            'sessions', v_session_count,
            'insights', v_insight_count,
            'total_size_bytes', v_total_size
        )
    ) RETURNING id INTO v_manifest_id;

    RETURN v_manifest_id;
END;
$_$;


ALTER FUNCTION "oriva_platform"."prepare_extraction_manifest"("p_user_id" "uuid", "p_source_app_id" "text", "p_target_format" "text", "p_include_schemas" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "oriva_platform"."prepare_extraction_manifest"("p_user_id" "uuid", "p_source_app_id" "text", "p_target_format" "text", "p_include_schemas" "text"[]) IS 'Create extraction manifest with data summary';



CREATE OR REPLACE FUNCTION "oriva_platform"."set_request_schema_path"("p_app_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "oriva_platform"."set_request_schema_path"("p_app_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "oriva_platform"."set_request_schema_path"("p_app_id" "text") IS 'Set schema search path for API request based on X-App-ID header';



CREATE OR REPLACE FUNCTION "oriva_platform"."user_has_app_access"("p_user_id" "uuid", "p_app_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "oriva_platform"."user_has_app_access"("p_user_id" "uuid", "p_app_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "oriva_platform"."user_has_app_access"("p_user_id" "uuid", "p_app_id" "text") IS 'Check if user has access to a specific app';



CREATE OR REPLACE FUNCTION "public"."_label_from_slug"("slug" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT initcap(replace(slug, '_', ' '));
$$;


ALTER FUNCTION "public"."_label_from_slug"("slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_creator_as_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_creator_as_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_group_member"("group_uuid" "uuid", "user_uuid" "uuid", "member_role" "text" DEFAULT 'member'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.groups_new
  SET 
    members = members || jsonb_build_array(jsonb_build_object(
      'user_id', user_uuid,
      'role', member_role,
      'joined_at', now()
    )),
    updated_at = now()
  WHERE id = group_uuid 
    AND created_by = auth.uid()
    AND NOT (members @> jsonb_build_array(jsonb_build_object('user_id', user_uuid)));
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."add_group_member"("group_uuid" "uuid", "user_uuid" "uuid", "member_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_plugin_version_tx"("in_version_id" "uuid", "in_plugin_id" "uuid", "in_candidate_version" "text", "in_update_latest" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- Approve the specific version
  update public.plugin_versions
     set approved = true
   where id = in_version_id;

  if in_update_latest then
    update public.plugins
       set latest_version = in_candidate_version
     where id = in_plugin_id;
  end if;
end;
$$;


ALTER FUNCTION "public"."approve_plugin_version_tx"("in_version_id" "uuid", "in_plugin_id" "uuid", "in_candidate_version" "text", "in_update_latest" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_learned_intensity"("positive_count" integer, "negative_count" integer) RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  total_signals INTEGER;
  positive_ratio NUMERIC(3,2);
BEGIN
  total_signals := positive_count + negative_count;
  
  -- No signals = neutral intensity
  IF total_signals = 0 THEN
    RETURN 0.5;
  END IF;
  
  -- Calculate positive ratio
  positive_ratio := positive_count::NUMERIC / total_signals::NUMERIC;
  
  -- Sigmoid-like function to convert ratio to intensity (0.1 to 0.9 range)
  RETURN GREATEST(0.1, LEAST(0.9, 0.2 + (positive_ratio * 0.6)));
END;
$$;


ALTER FUNCTION "public"."calculate_learned_intensity"("positive_count" integer, "negative_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_traction_score"("response_id_param" "uuid") RETURNS double precision
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  reply_weight FLOAT := 0.4;
  applaud_weight FLOAT := 0.3;
  curation_weight FLOAT := 0.3;
  max_replies INTEGER := 15;
  max_applauds INTEGER := 25;
  max_curations INTEGER := 8;
  normalized_replies FLOAT;
  normalized_applauds FLOAT;
  normalized_curations FLOAT;
  score FLOAT;
BEGIN
  SELECT
    LEAST(reply_count::FLOAT / max_replies, 1.0),
    LEAST(applaud_count::FLOAT / max_applauds, 1.0),
    LEAST(curation_count::FLOAT / max_curations, 1.0)
  INTO normalized_replies, normalized_applauds, normalized_curations
  FROM section_responses
  WHERE id = response_id_param;

  score := (normalized_replies * reply_weight) +
           (normalized_applauds * applaud_weight) +
           (normalized_curations * curation_weight);

  RETURN GREATEST(0.0, LEAST(1.0, score));
END;
$$;


ALTER FUNCTION "public"."calculate_traction_score"("response_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_receive_opportunity"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_enabled BOOLEAN;
  v_count INTEGER;
BEGIN
  -- Check if opportunities are enabled
  SELECT opportunities_enabled INTO v_enabled
  FROM notification_preferences
  WHERE user_id = p_user_id;

  -- Default to TRUE if no preferences set
  IF v_enabled IS NULL THEN
    v_enabled := TRUE;
  END IF;

  IF NOT v_enabled THEN
    RETURN FALSE;
  END IF;

  -- Check daily limit
  SELECT COALESCE(opportunity_count, 0) INTO v_count
  FROM notification_counters
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  RETURN v_count < 3;
END;
$$;


ALTER FUNCTION "public"."can_receive_opportunity"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_user_access_group"("group_id" "uuid", "user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.groups g
    LEFT JOIN public.group_members gm ON g.id = gm.group_id AND gm.user_id = can_user_access_group.user_id
    WHERE g.id = can_user_access_group.group_id
    AND (
      g.is_private = false OR  -- Public group
      g.created_by = can_user_access_group.user_id OR  -- Created by user
      gm.user_id IS NOT NULL  -- User is a member
    )
  );
END;
$$;


ALTER FUNCTION "public"."can_user_access_group"("group_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clean_expired_personalization_cache"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_personalization_cache 
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."clean_expired_personalization_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_oauth_data"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER := 0;
BEGIN
    -- Delete expired authorization codes
    DELETE FROM oauth_authorization_codes 
    WHERE expires_at < NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Delete expired access tokens
    DELETE FROM oauth_access_tokens 
    WHERE expires_at < NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_oauth_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_mixer_notification_rules"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Create default distance-based notification rule
  INSERT INTO mixer_notification_rules (user_id, rule_type, parameters)
  VALUES (
    NEW.id,
    'distance_based',
    '{
      "distance_km": 25,
      "notification_timing": "immediate"
    }'::jsonb
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_mixer_notification_rules"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_notification_preferences"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO notification_preferences (user_id, reminders_enabled, opportunities_enabled)
  VALUES (NEW.id, TRUE, TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_notification_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_mention_notifications_for_entry"("entry_uuid" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  entry_record RECORD;
  mention_username TEXT;
  mentioned_user_uuid UUID;
  notifications_created INTEGER := 0;
BEGIN
  -- Get entry details
  SELECT * INTO entry_record
  FROM entries
  WHERE id = entry_uuid;

  -- SECURITY: Verify caller is entry creator or service role
  IF entry_record.user_id != auth.uid() AND auth.jwt()->>'role' != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only entry creator can trigger mention notifications';
  END IF;

  -- Only process if entry is published (FR-015, clarification Q3)
  IF entry_record.status != 'published' THEN
    RETURN 0;
  END IF;

  -- Extract mentions from content
  FOR mention_username IN
    SELECT unnest(extract_mentions_from_content(entry_record.content))
  LOOP
    -- Find user by username in public.users table
    -- FR-017: Only active users receive notifications
    SELECT id INTO mentioned_user_uuid
    FROM users
    WHERE username = mention_username
      AND is_active = true; -- FR-017: Only active users

    -- Create notification if user found and active
    IF mentioned_user_uuid IS NOT NULL THEN
      -- Check if notification already exists (prevent duplicates)
      IF NOT EXISTS (
        SELECT 1 FROM mention_notifications
        WHERE entry_id = entry_uuid
          AND mentioned_user_id = mentioned_user_uuid
      ) THEN
        INSERT INTO mention_notifications (
          entry_id,
          mentioned_user_id,
          mentioning_user_id,
          created_at
        ) VALUES (
          entry_uuid,
          mentioned_user_uuid,
          entry_record.user_id,
          NOW()
        );

        notifications_created := notifications_created + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN notifications_created;
END;
$$;


ALTER FUNCTION "public"."create_mention_notifications_for_entry"("entry_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_context"("p_user_id" "uuid", "p_context" "text", "p_bio" "text" DEFAULT NULL::"text", "p_traits" "jsonb" DEFAULT '{}'::"jsonb", "p_preferences" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_context_id UUID;
BEGIN
  INSERT INTO user_contexts (user_id, context, bio, traits, preferences)
  VALUES (p_user_id, p_context, p_bio, p_traits, p_preferences)
  ON CONFLICT (user_id, context)
  DO UPDATE SET
    bio = EXCLUDED.bio,
    traits = EXCLUDED.traits,
    preferences = EXCLUDED.preferences,
    updated_at = NOW()
  RETURNING id INTO new_context_id;

  RETURN new_context_id;
END;
$$;


ALTER FUNCTION "public"."create_user_context"("p_user_id" "uuid", "p_context" "text", "p_bio" "text", "p_traits" "jsonb", "p_preferences" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."debug_auth_state"() RETURNS json
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT json_build_object(
    'auth_role', auth.role(),
    'auth_uid', auth.uid(),
    'has_jwt', CASE WHEN auth.jwt() IS NOT NULL THEN true ELSE false END,
    'jwt_exp', CASE WHEN auth.jwt() IS NOT NULL 
               THEN extract(epoch from to_timestamp((auth.jwt()->>'exp')::int))::text 
               ELSE 'no_jwt' END,
    'current_timestamp', extract(epoch from now())::text,
    'is_authenticated', CASE WHEN auth.role() = 'authenticated' THEN true ELSE false END,
    'has_user_record', EXISTS(SELECT 1 FROM auth.users WHERE id = auth.uid())
  );
$$;


ALTER FUNCTION "public"."debug_auth_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decay_memory_importance"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE hugo_user_memories
  SET importance = GREATEST(0.0, importance - relevance_decay_rate)
  WHERE last_accessed_at < now() - INTERVAL '30 days'
    AND importance > 0.0;
END;
$$;


ALTER FUNCTION "public"."decay_memory_importance"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."decay_memory_importance"() IS 'Scheduled job: decay importance for inactive memories';



CREATE OR REPLACE FUNCTION "public"."decrement_install_count"("app_id_in" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  update plugin_marketplace_apps
  set install_count = greatest(coalesce(install_count, 0) - 1, 0)
  where id = app_id_in;
$$;


ALTER FUNCTION "public"."decrement_install_count"("app_id_in" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_tag_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE "public"."tags"
    SET usage_count = GREATEST(0, usage_count - 1)
    WHERE id = OLD.tag_id;
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."decrement_tag_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_topic"("p_slug" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.topics (slug, label)
  VALUES (lower(p_slug), _label_from_slug(lower(p_slug)))
  ON CONFLICT (slug)
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."ensure_topic"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exec_sql"("sql_query" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result text;
BEGIN
    IF NOT (auth.jwt() ->> 'role' = 'service_role' OR 
            auth.uid() IN (
                SELECT id FROM auth.users 
                WHERE email IN (
                    'admin@oriva.io', 
                    'cosmic@oriva.io',
                    'tools@gavrielshaw.com'
                )
            )) THEN
        RAISE EXCEPTION 'Unauthorized: Only service role or admin users can execute SQL';
    END IF;
    
    EXECUTE sql_query;
    result := 'SQL executed successfully';
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'Error: ' || SQLERRM;
END;
$$;


ALTER FUNCTION "public"."exec_sql"("sql_query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."exec_sql"("sql_query" "text") IS 'Execute arbitrary SQL queries. Restricted to service role and admin users only.';



CREATE OR REPLACE FUNCTION "public"."execute_get_chat_context"("app_id_param" "text", "user_id_param" "uuid") RETURNS TABLE("app_id" "text", "display_name" "text", "domain" "text", "personality_schema" "jsonb", "knowledge_bases" "text"[], "recent_messages" "jsonb", "progress_data" "jsonb", "current_focus_area" "text", "milestones_reached" "text"[])
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY EXECUTE format('EXECUTE get_chat_context(%L, %L)', app_id_param, user_id_param);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in get_chat_context: %', SQLERRM;
    RETURN;
END;
$$;


ALTER FUNCTION "public"."execute_get_chat_context"("app_id_param" "text", "user_id_param" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."execute_get_chat_context"("app_id_param" "text", "user_id_param" "uuid") IS 'Wrapper function for get_chat_context prepared statement with error handling';



CREATE OR REPLACE FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Convert JSONB to text and call existing TEXT version
  -- This handles the case where content is stored as JSONB in entries table
  RETURN extract_mentions_from_content(content::text);
END;
$$;


ALTER FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") IS 'JSONB overload for extract_mentions_from_content. Converts JSONB content to text and delegates to TEXT version. Required because entries.content is JSONB type.';



CREATE OR REPLACE FUNCTION "public"."extract_mentions_from_content"("content" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  mentions TEXT[];
BEGIN
  -- Extract all @username patterns (alphanumeric + underscore)
  -- Pattern: @[a-zA-Z0-9_]+
  SELECT ARRAY_AGG(DISTINCT mention)
  INTO mentions
  FROM (
    SELECT regexp_matches(content, '@([a-zA-Z0-9_]+)', 'g') AS mention_match
  ) AS matches
  CROSS JOIN LATERAL unnest(mention_match) AS mention;

  RETURN COALESCE(mentions, ARRAY[]::TEXT[]);
END;
$$;


ALTER FUNCTION "public"."extract_mentions_from_content"("content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extract_topics_from_content"("entry_title" "text", "entry_content" "jsonb") RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  topics TEXT[];
  content_text TEXT;
  word TEXT;
BEGIN
  -- Initialize empty array
  topics := ARRAY[]::TEXT[];
  
  -- Extract text content from JSONB
  content_text := COALESCE(entry_content->>'content', '') || ' ' || COALESCE(entry_title, '');
  
  -- Extract hashtags
  FOR word IN 
    SELECT unnest(regexp_split_to_array(content_text, '\s+'))
  LOOP
    IF word ~ '^#\w+' THEN
      topics := array_append(topics, lower(trim(word, '#')));
    END IF;
  END LOOP;
  
  -- Extract common keywords (simplified approach)
  IF content_text ~* '\y(ai|artificial intelligence)\y' THEN
    topics := array_append(topics, 'ai');
  END IF;
  
  IF content_text ~* '\y(technology|tech)\y' THEN
    topics := array_append(topics, 'technology');
  END IF;
  
  IF content_text ~* '\y(business|startup|entrepreneur)\y' THEN
    topics := array_append(topics, 'business');
  END IF;
  
  IF content_text ~* '\y(design|ui|ux)\y' THEN
    topics := array_append(topics, 'design');
  END IF;
  
  IF content_text ~* '\y(development|coding|programming)\y' THEN
    topics := array_append(topics, 'development');
  END IF;
  
  -- Remove duplicates and return
  SELECT array_agg(DISTINCT t) INTO topics FROM unnest(topics) t;
  
  RETURN COALESCE(topics, ARRAY[]::TEXT[]);
END;
$$;


ALTER FUNCTION "public"."extract_topics_from_content"("entry_title" "text", "entry_content" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."extract_topics_from_content"("entry_title" "text", "entry_content" "jsonb") IS 'Extract topic tags from entry content';



CREATE OR REPLACE FUNCTION "public"."find_similar_entries_by_id"("source_entry_id" "uuid", "similarity_threshold" double precision DEFAULT 0.75, "result_limit" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "title" "text", "content" "jsonb", "topics" "text"[], "user_id" "uuid", "created_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  source_embedding vector(1536);
BEGIN
  -- Get the embedding of the source entry
  SELECT combined_embedding INTO source_embedding
  FROM entries
  WHERE id = source_entry_id AND combined_embedding IS NOT NULL;
  
  IF source_embedding IS NULL THEN
    RETURN; -- No results if source has no embedding
  END IF;
  
  -- Use the semantic_similarity function
  RETURN QUERY
  SELECT * FROM semantic_similarity(
    source_embedding,
    source_entry_id,
    similarity_threshold,
    result_limit,
    NULL -- No topic filter
  );
END;
$$;


ALTER FUNCTION "public"."find_similar_entries_by_id"("source_entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_similar_entries_by_id"("source_entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer) IS 'Find entries similar to a specific entry ID';



CREATE OR REPLACE FUNCTION "public"."generate_oauth_credentials"("app_id_param" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    client_id_val VARCHAR(255);
    client_secret_val VARCHAR(255);
BEGIN
    -- Generate secure client ID and secret
    client_id_val := 'oriva_' || encode(gen_random_bytes(16), 'hex');
    client_secret_val := encode(gen_random_bytes(32), 'hex');
    
    -- Insert credentials
    INSERT INTO app_oauth_credentials (app_id, client_id, client_secret)
    VALUES (app_id_param, client_id_val, client_secret_val);
    
    -- Return credentials (secret should only be shown once)
    RETURN json_build_object(
        'client_id', client_id_val,
        'client_secret', client_secret_val
    );
END;
$$;


ALTER FUNCTION "public"."generate_oauth_credentials"("app_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_app_context"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN COALESCE(current_setting('app.context', true), 'oriva-core');
END;
$$;


ALTER FUNCTION "public"."get_app_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_app_schema"("p_app_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_schema_name TEXT;
BEGIN
    SELECT schema_name INTO v_schema_name
    FROM oriva_platform.apps
    WHERE app_id = p_app_id;

    RETURN v_schema_name;
END;
$$;


ALTER FUNCTION "public"."get_app_schema"("p_app_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_app_schema"("p_app_id" "text") IS 'Get schema name for an app_id';



CREATE OR REPLACE FUNCTION "public"."get_developer_verification_values"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN ARRAY['unverified', 'pending', 'verified'];
END;
$$;


ALTER FUNCTION "public"."get_developer_verification_values"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_entries_needing_embeddings"("batch_size" integer DEFAULT 50) RETURNS TABLE("id" "uuid", "title" "text", "content" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id::UUID,
    e.title,
    e.content,
    e.created_at,
    e.updated_at
  FROM entries e
  WHERE 
    e.status = 'published'
    AND (
      e.combined_embedding IS NULL 
      OR e.embedding_updated_at IS NULL
      OR e.embedding_updated_at < e.updated_at
    )
  ORDER BY e.updated_at DESC
  LIMIT batch_size;
END;
$$;


ALTER FUNCTION "public"."get_entries_needing_embeddings"("batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_entries_needing_embeddings"("batch_size" integer) IS 'Get entries that need embedding generation';



CREATE OR REPLACE FUNCTION "public"."get_group_member_count"("group_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) 
    FROM public.group_members 
    WHERE group_members.group_id = get_group_member_count.group_id
  );
END;
$$;


ALTER FUNCTION "public"."get_group_member_count"("group_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "user_id" "uuid" NOT NULL,
    "theme" "text" DEFAULT 'auto'::"text" NOT NULL,
    "language" "text" DEFAULT 'en'::"text" NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "font_size" "text" DEFAULT 'medium'::"text" NOT NULL,
    "notifications_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "developer_mode" boolean DEFAULT false,
    "profile_visibility" "text" DEFAULT 'public'::"text",
    "group_visibility_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "email_notifications" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "response_notifications" boolean DEFAULT true,
    "mention_notifications" boolean DEFAULT true,
    "group_activity_notifications" boolean DEFAULT false,
    "show_email" boolean DEFAULT false,
    "show_location" boolean DEFAULT true,
    "allow_direct_messages" boolean DEFAULT true,
    "show_profile_in_groups" boolean DEFAULT true,
    "default_anonymous" boolean DEFAULT false,
    "mature_content" boolean DEFAULT false,
    "auto_play_media" boolean DEFAULT true,
    "themecrumbs_enabled" boolean DEFAULT true,
    "themecrumbs_position" "text" DEFAULT 'topic'::"text",
    CONSTRAINT "user_preferences_font_size_check" CHECK (("font_size" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text"]))),
    CONSTRAINT "user_preferences_profile_visibility_check" CHECK (("profile_visibility" = ANY (ARRAY['public'::"text", 'private'::"text", 'connections_only'::"text"]))),
    CONSTRAINT "user_preferences_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'auto'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_user_preferences"() RETURNS "public"."user_preferences"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  prefs public.user_preferences;
begin
  if uid is null then
    raise exception 'auth.uid() is null';
  end if;

  select * into prefs from public.user_preferences where user_id = uid;
  if not found then
    insert into public.user_preferences (user_id) values (uid)
    returning * into prefs;
  end if;

  return prefs;
end $$;


ALTER FUNCTION "public"."get_or_create_user_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_plugin_permission_values"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN ARRAY[
    'read_entries', 'write_entries', 'read_profile', 'write_profile',
    'read_contacts', 'write_contacts', 'network_access', 'storage_access',
    'camera_access', 'location_access', 'admin_functions'
  ];
END;
$$;


ALTER FUNCTION "public"."get_plugin_permission_values"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_plugin_status_values"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN ARRAY['draft', 'pending_review', 'approved', 'rejected', 'deprecated'];
END;
$$;


ALTER FUNCTION "public"."get_plugin_status_values"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_response_thread"("section_entry_id_param" "uuid", "max_depth" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "content" "text", "user_id" "uuid", "type" character varying, "parent_response_id" "uuid", "thread_depth" integer, "reply_count" integer, "applaud_count" integer, "relevance_score" double precision, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.content,
    r.user_id,
    r.type,
    r.parent_response_id,
    r.thread_depth,
    r.reply_count,
    r.applaud_count,
    r.relevance_score,
    r.created_at
  FROM section_responses r
  WHERE r.section_entry_id = section_entry_id_param
    AND r.thread_depth <= max_depth
  ORDER BY r.thread_path;
END;
$$;


ALTER FUNCTION "public"."get_response_thread"("section_entry_id_param" "uuid", "max_depth" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_review_rating_values"() RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN ARRAY['1', '2', '3', '4', '5'];
END;
$$;


ALTER FUNCTION "public"."get_review_rating_values"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_trending_apps"("days_back" integer DEFAULT 7, "app_limit" integer DEFAULT 10) RETURNS TABLE("app_id" "uuid", "app_name" character varying, "install_growth" bigint, "recent_installs" bigint)
    LANGUAGE "plpgsql"
    AS $$
  BEGIN
      RETURN QUERY
      SELECT
          ma.id::UUID,
          ma.name::VARCHAR(255),
          (COALESCE(recent.install_count, 0) -
  COALESCE(older.install_count, 0))::BIGINT,
          COALESCE(recent.install_count, 0)::BIGINT
      FROM marketplace_apps ma
      LEFT JOIN (
          SELECT
              uai.app_id,
              COUNT(*)::BIGINT as install_count
          FROM user_app_installs uai
          WHERE uai.installed_at >= NOW() - (days_back || ' 
  days')::INTERVAL
          GROUP BY uai.app_id
      ) recent ON recent.app_id = ma.id
      LEFT JOIN (
          SELECT
              uai.app_id,
              COUNT(*)::BIGINT as install_count
          FROM user_app_installs uai
          WHERE uai.installed_at >= NOW() - (days_back * 2 || ' 
  days')::INTERVAL
            AND uai.installed_at < NOW() - (days_back || ' 
  days')::INTERVAL
          GROUP BY uai.app_id
      ) older ON older.app_id = ma.id
      WHERE ma.status = 'approved'
      ORDER BY (COALESCE(recent.install_count, 0) -
  COALESCE(older.install_count, 0))::BIGINT DESC,
               COALESCE(recent.install_count, 0)::BIGINT DESC
      LIMIT app_limit;
  END;
  $$;


ALTER FUNCTION "public"."get_trending_apps"("days_back" integer, "app_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_active_profiles"("user_id" "uuid") RETURNS TABLE("profile_id" "uuid", "display_name" "text", "avatar_url" "text", "is_default" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT id, profiles.display_name, profiles.avatar_url, profiles.is_default
    FROM public.profiles
    WHERE account_id = user_id AND is_active = true
    ORDER BY is_default DESC, created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_user_active_profiles"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_active_push_tokens"("p_user_id" "uuid") RETURNS TABLE("expo_push_token" "text", "platform" character varying, "device_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.expo_push_token,
    t.platform,
    t.device_name
  FROM expo_push_tokens t
  WHERE t.user_id = p_user_id
    AND t.is_active = TRUE
  ORDER BY t.last_used_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_user_active_push_tokens"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_default_profile"("user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    profile_id UUID;
BEGIN
    SELECT id INTO profile_id
    FROM public.profiles
    WHERE account_id = user_id AND is_default = true AND is_active = true
    LIMIT 1;
    
    RETURN profile_id;
END;
$$;


ALTER FUNCTION "public"."get_user_default_profile"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_group_role"("group_id" "uuid", "user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.group_members 
    WHERE group_members.group_id = get_user_group_role.group_id 
    AND group_members.user_id = get_user_group_role.user_id
  );
END;
$$;


ALTER FUNCTION "public"."get_user_group_role"("group_id" "uuid", "user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_topic_weights"("user_uuid" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      jsonb_object_agg(topic_slug, combined_intensity),
      '{}'::jsonb
    )
    FROM user_topic_intensities 
    WHERE user_id = user_uuid 
    AND combined_intensity > 0
  );
END;
$$;


ALTER FUNCTION "public"."get_user_topic_weights"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    profile_username TEXT;
    counter INTEGER := 0;
    base_username TEXT;
    random_digits INTEGER;
    max_attempts INTEGER := 100; -- Prevent infinite loops
    attempts INTEGER := 0;
BEGIN
  -- Create user record in public.users
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Generate anonymous-style username (anon_ + 8 random digits)
  -- This replaces the email-based username generation for anonymous profiles
  LOOP
    -- Generate random 8-digit number (00000000 to 99999999)
    random_digits := floor(random() * 100000000)::integer;
    
    -- Format as anon_ + padded 8 digits
    profile_username := 'anon_' || lpad(random_digits::text, 8, '0');
    
    -- Check if username already exists
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = profile_username);
    
    -- Increment attempt counter
    attempts := attempts + 1;
    
    -- Safety check: prevent infinite loops
    IF attempts >= max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique anonymous username after % attempts', max_attempts;
    END IF;
  END LOOP;

  -- Create default Anon profile in profiles table
  INSERT INTO public.profiles (
    account_id,
    display_name,
    username,
    is_default,
    is_active,
    is_anonymous
  )
  VALUES (
    NEW.id,
    'Anon',
    profile_username,
    true,
    true,
    true
  );

  -- Reset counter for user_profiles username uniqueness check
  -- Keep email-based username generation for user_profiles table (separate concern)
  counter := 0;
  base_username := COALESCE(
    regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
    'user'
  );

  IF char_length(base_username) < 3 THEN
    base_username := 'user';
  END IF;

  base_username := left(base_username, 27);

  -- Find unique username for user_profiles table
  profile_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = profile_username) LOOP
    counter := counter + 1;
    profile_username := base_username || counter::text;
  END LOOP;

  -- Create user_profiles record
  INSERT INTO public.user_profiles (
    id,
    username,
    display_name,
    bio,
    avatar_url
  )
  VALUES (
    NEW.id,
    profile_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NULL,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Create default user_preferences
  INSERT INTO public.user_preferences (
    user_id,
    theme,
    language,
    timezone,
    font_size,
    notifications_enabled,
    allow_direct_messages,
    profile_visibility,
    developer_mode,
    themecrumbs_enabled,
    themecrumbs_position,
    group_visibility_settings
  )
  VALUES (
    NEW.id,
    'auto',
    'en',
    'UTC',
    'medium',
    true,
    true,
    'public',
    false,
    true,
    'top',
    '{}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_user"() IS 'Auto-creates public.users, user_profiles, profiles, and user_preferences records when user registers. Anonymous profiles use anon_nnnnnnnn format handles.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user_complete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    profile_username TEXT;
    counter INTEGER := 0;
    base_username TEXT;
BEGIN
    -- Create user record
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    -- Generate unique username from email or name
    base_username := COALESCE(
        -- Try to extract username from email
        regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'),
        -- Fallback to generated name
        'user'
    );
    
    -- Ensure username is at least 3 characters
    IF char_length(base_username) < 3 THEN
        base_username := 'user';
    END IF;
    
    -- Ensure username is not longer than 27 characters (leave room for counter)
    base_username := left(base_username, 27);
    
    -- Find unique username
    profile_username := base_username;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = profile_username) LOOP
        counter := counter + 1;
        profile_username := base_username || counter::text;
    END LOOP;
    
    -- Create default profile with unique username
    INSERT INTO public.profiles (account_id, username, display_name, is_default, is_active)
    VALUES (
        NEW.id,
        profile_username,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Default Profile'),
        true,
        true
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_complete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Create default profile for new user
    INSERT INTO public.profiles (account_id, display_name, is_default, is_active)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Default Profile'),
        true,
        true
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector" DEFAULT NULL::"public"."vector", "similarity_threshold" double precision DEFAULT 0.6, "result_limit" integer DEFAULT 20, "topic_filter" "text"[] DEFAULT NULL::"text"[], "semantic_weight" double precision DEFAULT 0.7, "keyword_weight" double precision DEFAULT 0.3) RETURNS TABLE("id" "uuid", "title" "text", "content" "jsonb", "topics" "text"[], "user_id" "uuid", "created_at" timestamp with time zone, "semantic_score" double precision, "keyword_score" double precision, "hybrid_score" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT 
      e.id::UUID,
      e.title,
      e.content,
      e.topics,
      e.user_id::UUID,
      e.created_at,
      CASE 
        WHEN query_embedding IS NOT NULL AND e.combined_embedding IS NOT NULL 
        THEN (1 - (e.combined_embedding <=> query_embedding))::FLOAT
        ELSE 0.0
      END as semantic_score,
      CASE
        WHEN e.title ILIKE '%' || query_text || '%' OR 
             (e.content->>'title') ILIKE '%' || query_text || '%' OR
             (e.content->>'content') ILIKE '%' || query_text || '%'
        THEN 1.0
        ELSE 0.0
      END as keyword_score
    FROM entries e
    WHERE 
      e.status = 'published'
      AND (topic_filter IS NULL OR e.topics && topic_filter)
      AND (
        -- Semantic match
        (query_embedding IS NOT NULL AND e.combined_embedding IS NOT NULL 
         AND (1 - (e.combined_embedding <=> query_embedding)) >= similarity_threshold)
        OR
        -- Keyword match
        (e.title ILIKE '%' || query_text || '%' OR 
         (e.content->>'title') ILIKE '%' || query_text || '%' OR
         (e.content->>'content') ILIKE '%' || query_text || '%')
      )
  )
  SELECT 
    sr.id,
    sr.title,
    sr.content,
    sr.topics,
    sr.user_id,
    sr.created_at,
    sr.semantic_score,
    sr.keyword_score,
    (sr.semantic_score * semantic_weight + sr.keyword_score * keyword_weight)::FLOAT as hybrid_score
  FROM semantic_results sr
  WHERE sr.semantic_score > 0 OR sr.keyword_score > 0
  ORDER BY hybrid_score DESC
  LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[], "semantic_weight" double precision, "keyword_weight" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[], "semantic_weight" double precision, "keyword_weight" double precision) IS 'Combine semantic and keyword search for better results';



CREATE OR REPLACE FUNCTION "public"."increment_api_key_usage"("key_hash_param" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE developer_api_keys 
    SET usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE key_hash = key_hash_param AND is_active = TRUE;
END;
$$;


ALTER FUNCTION "public"."increment_api_key_usage"("key_hash_param" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_install_count"("app_id_in" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  update plugin_marketplace_apps
  set install_count = coalesce(install_count, 0) + 1
  where id = app_id_in;
$$;


ALTER FUNCTION "public"."increment_install_count"("app_id_in" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ke_access"("entry_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE hugo_knowledge_entries
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = entry_id;
END;
$$;


ALTER FUNCTION "public"."increment_ke_access"("entry_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."increment_ke_access"("entry_id" "uuid") IS 'Hot path: increment access count and update last_accessed_at';



CREATE OR REPLACE FUNCTION "public"."increment_opportunity_counter"("p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Atomic upsert with increment
  INSERT INTO notification_counters (user_id, date, opportunity_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET opportunity_count = notification_counters.opportunity_count + 1
  RETURNING opportunity_count INTO v_new_count;

  -- Check if limit exceeded
  IF v_new_count > 3 THEN
    -- Rollback the increment
    UPDATE notification_counters
    SET opportunity_count = opportunity_count - 1
    WHERE user_id = p_user_id AND date = CURRENT_DATE;

    RETURN FALSE;  -- Limit exceeded
  END IF;

  RETURN TRUE;  -- Within limit
END;
$$;


ALTER FUNCTION "public"."increment_opportunity_counter"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_tag_usage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE "public"."tags"
    SET usage_count = usage_count + 1
    WHERE id = NEW.tag_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_tag_usage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
    AND email = 'tools@gavrielshaw.com'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_admin"() IS 'Check if current user is admin. Uses SECURITY DEFINER to bypass RLS on auth.users.';



CREATE OR REPLACE FUNCTION "public"."is_user_group_member"("p_user_id" "uuid", "p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = p_user_id
    AND group_id = p_group_id
  );
$$;


ALTER FUNCTION "public"."is_user_group_member"("p_user_id" "uuid", "p_group_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_user_group_member"("p_user_id" "uuid", "p_group_id" "uuid") IS 'Helper function to check group membership without triggering RLS recursion. Used by entries RLS policy.';



CREATE OR REPLACE FUNCTION "public"."is_user_member_of_group"("p_user_id" "uuid", "p_group_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = p_user_id
    AND group_id = p_group_id
  );
$$;


ALTER FUNCTION "public"."is_user_member_of_group"("p_user_id" "uuid", "p_group_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_user_member_of_group"("p_user_id" "uuid", "p_group_id" "uuid") IS 'Helper function to check group membership without triggering RLS recursion. Used by both group_members and groups RLS policies.';



CREATE OR REPLACE FUNCTION "public"."log_context_interaction"("p_user_id" "uuid", "p_context" "text", "p_type" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb", "p_target_user_id" "uuid" DEFAULT NULL::"uuid", "p_scheduled_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  interaction_id UUID;
BEGIN
  INSERT INTO context_interactions (
    user_id, context, type, data, target_user_id, scheduled_at
  )
  VALUES (
    p_user_id, p_context, p_type, p_data, p_target_user_id, p_scheduled_at
  )
  RETURNING id INTO interaction_id;

  RETURN interaction_id;
END;
$$;


ALTER FUNCTION "public"."log_context_interaction"("p_user_id" "uuid", "p_context" "text", "p_type" "text", "p_data" "jsonb", "p_target_user_id" "uuid", "p_scheduled_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."migrate_anon_entries"("p_entry_ids" "uuid"[], "p_dry_run" boolean DEFAULT false) RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(array_length(p_entry_ids, 1), 0) = 0 then
    return query select null::uuid where false; -- empty
  end if;

  if p_dry_run then
    -- Preview which IDs are anonymous and would be updated
    return query
    select e.id
    from public.entries e
    where e.id = any(p_entry_ids)
      and (e.user_id is null or e.is_anonymous = true);
  else
    update public.entries e
      set user_id = auth.uid(),
          is_anonymous = false,
          updated_at = now()
    where e.id = any(p_entry_ids)
      and (e.user_id is null or e.is_anonymous = true);

    return query
    select e.id
    from public.entries e
    where e.id = any(p_entry_ids);
  end if;
end;
$$;


ALTER FUNCTION "public"."migrate_anon_entries"("p_entry_ids" "uuid"[], "p_dry_run" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."migrate_anon_entries"("p_entry_ids" "uuid"[], "p_dry_run" boolean) IS 'Reassigns anonymous entries to the logged-in user; set p_dry_run=true to preview.';



CREATE OR REPLACE FUNCTION "public"."migrate_existing_data_to_profiles"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    user_record RECORD;
    default_profile_id UUID;
    updated_count INTEGER := 0;
BEGIN
    -- For each user, find their default profile and update their content
    FOR user_record IN SELECT id FROM public.users LOOP
        -- Get the user's default profile
        SELECT id INTO default_profile_id
        FROM public.profiles
        WHERE account_id = user_record.id AND is_default = true AND is_active = true
        LIMIT 1;
        
        IF default_profile_id IS NOT NULL THEN
            -- Update entries
            UPDATE public.entries
            SET profile_id = default_profile_id
            WHERE created_by = user_record.id AND profile_id IS NULL;
            
            -- Update agreements
            UPDATE public.agreements
            SET profile_id = default_profile_id
            WHERE created_by = user_record.id AND profile_id IS NULL;
            
            -- Update favorites
            UPDATE public.favorites
            SET profile_id = default_profile_id
            WHERE user_id = user_record.id AND profile_id IS NULL;
            
            -- Update templates
            UPDATE public.templates
            SET profile_id = default_profile_id
            WHERE created_by = user_record.id AND profile_id IS NULL;
            
            updated_count := updated_count + 1;
        END IF;
    END LOOP;
    
    RETURN 'Migration completed. Updated data for ' || updated_count || ' users.';
END;
$$;


ALTER FUNCTION "public"."migrate_existing_data_to_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parse_content_headings"("content_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  lines text[];
  line text;
  headings jsonb := '[]'::jsonb;
  current_section jsonb;
  section_content text := '';
  in_section boolean := false;
BEGIN
  lines := string_to_array(content_text, E'\n');
  
  FOREACH line IN ARRAY lines
  LOOP
    IF line ~ '^# .+' THEN
      IF in_section AND current_section IS NOT NULL THEN
        current_section := jsonb_set(current_section, '{content}', to_jsonb(trim(section_content)));
        headings := headings || jsonb_build_array(current_section);
      END IF;
      
      current_section := jsonb_build_object(
        'title', trim(substring(line from 3)),
        'heading_level', 1,
        'content', ''
      );
      section_content := '';
      in_section := true;
      
    ELSE
      IF in_section THEN
        section_content := section_content || line || E'\n';
      END IF;
    END IF;
  END LOOP;
  
  IF in_section AND current_section IS NOT NULL THEN
    current_section := jsonb_set(current_section, '{content}', to_jsonb(trim(section_content)));
    headings := headings || jsonb_build_array(current_section);
  END IF;
  
  RETURN headings;
END;
$$;


ALTER FUNCTION "public"."parse_content_headings"("content_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_group_member"("group_uuid" "uuid", "user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.groups_new
  SET 
    members = (
      SELECT jsonb_agg(member)
      FROM jsonb_array_elements(members) member
      WHERE member->>'user_id' != user_uuid::text
    ),
    updated_at = now()
  WHERE id = group_uuid 
    AND (created_by = auth.uid() OR user_uuid = auth.uid());
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."remove_group_member"("group_uuid" "uuid", "user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_plugins"("q" "text", "category_filter" "uuid" DEFAULT NULL::"uuid", "status_filter" "text" DEFAULT 'approved'::"text") RETURNS TABLE("plugin_id" "uuid", "slug" "text", "name" "text", "status" "text", "rank" real)
    LANGUAGE "sql"
    AS $$
  SELECT
    p.id AS plugin_id,
    p.slug,
    p.name,
    p.status,
    ts_rank_cd(
      to_tsvector('english', coalesce(p.name,'') || ' ' || coalesce(p.metadata->>'description','')),
      plainto_tsquery('english', coalesce(q,''))
    ) AS rank
  FROM public.plugins p
  WHERE
    (status_filter IS NULL OR p.status = status_filter)
    AND (category_filter IS NULL OR p.category_id = category_filter)
    AND (
      q IS NULL
      OR to_tsvector('english', coalesce(p.name,'') || ' ' || coalesce(p.metadata->>'description','')) @@ plainto_tsquery('english', q)
    )
  ORDER BY rank DESC, p.created_at DESC
  LIMIT 50;
$$;


ALTER FUNCTION "public"."search_plugins"("q" "text", "category_filter" "uuid", "status_filter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."semantic_similarity"("query_embedding" "public"."vector", "entry_id" "uuid" DEFAULT NULL::"uuid", "similarity_threshold" double precision DEFAULT 0.7, "result_limit" integer DEFAULT 20, "topic_filter" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "title" "text", "content" "jsonb", "topics" "text"[], "user_id" "uuid", "created_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id::UUID,
    e.title,
    e.content,
    e.topics,
    e.user_id::UUID,
    e.created_at,
    (1 - (e.combined_embedding <=> query_embedding))::FLOAT as similarity
  FROM entries e
  WHERE 
    e.combined_embedding IS NOT NULL
    AND (entry_id IS NULL OR e.id::UUID != entry_id) -- Exclude the source entry
    AND e.status = 'published'
    AND (topic_filter IS NULL OR e.topics && topic_filter) -- Topic overlap if filter provided
    AND (1 - (e.combined_embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY e.combined_embedding <=> query_embedding
  LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."semantic_similarity"("query_embedding" "public"."vector", "entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."semantic_similarity"("query_embedding" "public"."vector", "entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[]) IS 'Find semantically similar entries using vector embeddings';



CREATE OR REPLACE FUNCTION "public"."set_app_context"("context_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  PERFORM set_config('app.context', context_name, true);
END;
$$;


ALTER FUNCTION "public"."set_app_context"("context_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_schema_path"("schema_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    EXECUTE format('SET search_path TO %I, oriva_platform, hugo_ai, public', schema_name);
END;
$$;


ALTER FUNCTION "public"."set_schema_path"("schema_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_schema_path"("schema_name" "text") IS 'Dynamically set search path for app-specific schema routing';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.updated_by = auth.uid();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_group_member_timestamps"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- On INSERT, set created_at to joined_at if not explicitly set
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL THEN
      NEW.created_at = NEW.joined_at;
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE, keep created_at in sync with joined_at
  IF TG_OP = 'UPDATE' THEN
    IF OLD.joined_at != NEW.joined_at THEN
      NEW.created_at = NEW.joined_at;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."sync_group_member_timestamps"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sync_group_member_timestamps"() IS 'Keeps created_at column in sync with joined_at for application compatibility';



CREATE OR REPLACE FUNCTION "public"."trigger_mention_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Only create notifications when entry becomes published
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status != 'published') THEN
    PERFORM create_mention_notifications_for_entry(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_mention_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_app_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE marketplace_apps 
    SET 
        rating_average = (
            SELECT ROUND(AVG(rating::numeric), 2) 
            FROM app_reviews 
            WHERE app_id = COALESCE(NEW.app_id, OLD.app_id)
        ),
        rating_count = (
            SELECT COUNT(*) 
            FROM app_reviews 
            WHERE app_id = COALESCE(NEW.app_id, OLD.app_id)
        )
    WHERE id = COALESCE(NEW.app_id, OLD.app_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_app_rating"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_collaboration_traits"("p_user_id" "uuid", "p_interaction_type" "text", "p_rating" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  current_traits JSONB;
  updated_traits JSONB;
BEGIN
  -- Get current traits
  SELECT traits INTO current_traits
  FROM user_contexts
  WHERE user_id = p_user_id AND context = 'oo-work-buddy';

  IF current_traits IS NULL THEN
    RETURN; -- No profile exists
  END IF;

  -- Update traits based on interaction type and rating
  updated_traits := current_traits;

  CASE p_interaction_type
    WHEN 'appointment' THEN
      -- Boost punctuality and communication traits
      updated_traits := jsonb_set(
        updated_traits,
        '{punctuality}',
        to_jsonb(LEAST(1.0, COALESCE((current_traits->>'punctuality')::FLOAT, 0.8) + 0.01))
      );
    WHEN 'collaboration_rating' THEN
      IF p_rating IS NOT NULL THEN
        -- Update collaboration trait based on received rating
        updated_traits := jsonb_set(
          updated_traits,
          '{collaboration}',
          to_jsonb(LEAST(1.0, (p_rating::FLOAT / 10.0) * 0.1 + COALESCE((current_traits->>'collaboration')::FLOAT, 0.8) * 0.9))
        );
      END IF;
    WHEN 'productivity_log' THEN
      -- Boost productivity-related traits
      updated_traits := jsonb_set(
        updated_traits,
        '{availability}',
        to_jsonb(LEAST(1.0, COALESCE((current_traits->>'availability')::FLOAT, 0.8) + 0.005))
      );
  END CASE;

  -- Update the user context
  UPDATE user_contexts
  SET traits = updated_traits, updated_at = NOW()
  WHERE user_id = p_user_id AND context = 'oo-work-buddy';
END;
$$;


ALTER FUNCTION "public"."update_collaboration_traits"("p_user_id" "uuid", "p_interaction_type" "text", "p_rating" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_collection_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_collection_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_content_topics_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_content_topics_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_developer_api_keys_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_developer_api_keys_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_entry_embedding"("entry_id" "uuid", "title_emb" "public"."vector" DEFAULT NULL::"public"."vector", "content_emb" "public"."vector" DEFAULT NULL::"public"."vector", "combined_emb" "public"."vector" DEFAULT NULL::"public"."vector") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  extracted_topics TEXT[];
  entry_title TEXT;
  entry_content JSONB;
BEGIN
  -- Get current entry data
  SELECT title, content INTO entry_title, entry_content
  FROM entries WHERE id = entry_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Extract topics from content
  extracted_topics := extract_topics_from_content(entry_title, entry_content);
  
  -- Update the entry with embeddings and topics
  UPDATE entries SET
    title_embedding = COALESCE(title_emb, title_embedding),
    content_embedding = COALESCE(content_emb, content_embedding),
    combined_embedding = COALESCE(combined_emb, combined_embedding),
    topics = extracted_topics,
    embedding_updated_at = NOW()
  WHERE id = entry_id;
  
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_entry_embedding"("entry_id" "uuid", "title_emb" "public"."vector", "content_emb" "public"."vector", "combined_emb" "public"."vector") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_entry_embedding"("entry_id" "uuid", "title_emb" "public"."vector", "content_emb" "public"."vector", "combined_emb" "public"."vector") IS 'Update vector embeddings for an entry';



CREATE OR REPLACE FUNCTION "public"."update_entry_relation_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Handle INSERT: New active relation created
  IF TG_OP = 'INSERT' AND NEW.active = true THEN
    -- Increment count for both source and target entries
    UPDATE entries
    SET relation_count = relation_count + 1
    WHERE id IN (NEW.source_entry_id, NEW.target_entry_id);

    RETURN NEW;
  END IF;

  -- Handle DELETE: Relation hard deleted
  IF TG_OP = 'DELETE' AND OLD.active = true THEN
    -- Decrement count for both source and target entries
    UPDATE entries
    SET relation_count = GREATEST(0, relation_count - 1)
    WHERE id IN (OLD.source_entry_id, OLD.target_entry_id);

    RETURN OLD;
  END IF;

  -- Handle UPDATE: Relation soft deleted (active changed from true to false)
  IF TG_OP = 'UPDATE' AND OLD.active = true AND NEW.active = false THEN
    -- Decrement count for both source and target entries
    UPDATE entries
    SET relation_count = GREATEST(0, relation_count - 1)
    WHERE id IN (NEW.source_entry_id, NEW.target_entry_id);

    RETURN NEW;
  END IF;

  -- Handle UPDATE: Relation reactivated (active changed from false to true)
  IF TG_OP = 'UPDATE' AND OLD.active = false AND NEW.active = true THEN
    -- Increment count for both source and target entries
    UPDATE entries
    SET relation_count = relation_count + 1
    WHERE id IN (NEW.source_entry_id, NEW.target_entry_id);

    RETURN NEW;
  END IF;

  -- No count change needed for other updates
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_entry_relation_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_entry_response_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Update the response_count for the affected entry
    UPDATE public.entries
    SET response_count = (
        SELECT jsonb_build_object(
            'moderate', COALESCE((SELECT COUNT(*) FROM public.responses WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id) AND response_type = 'moderate'), 0),
            'curate', COALESCE((SELECT COUNT(*) FROM public.responses WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id) AND response_type = 'curate'), 0),
            'iterate', COALESCE((SELECT COUNT(*) FROM public.responses WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id) AND response_type = 'iterate'), 0),
            'applaud', COALESCE((SELECT COUNT(*) FROM public.responses WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id) AND response_type = 'applaud'), 0),
            'total', COALESCE((SELECT COUNT(*) FROM public.responses WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id)), 0)
        )
    ),
    updated_at = NOW()
    WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_entry_response_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_entry_task_flags"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    task_count_val INTEGER;
BEGIN
    -- Get the current task count for the entry
    SELECT COUNT(*) INTO task_count_val
    FROM public.tasks 
    WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id);
    
    -- Update both has_tasks and task_count
    UPDATE public.entries 
    SET 
        has_tasks = (task_count_val > 0),
        task_count = task_count_val,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.entry_id, OLD.entry_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_entry_task_flags"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_historical_context_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_historical_context_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_install_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE marketplace_apps 
    SET install_count = (
        SELECT COUNT(*) 
        FROM user_app_installs 
        WHERE app_id = COALESCE(NEW.app_id, OLD.app_id)
    )
    WHERE id = COALESCE(NEW.app_id, OLD.app_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_install_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_kb_usage_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update usage count and last used timestamp
  UPDATE hugo_knowledge_base
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_kb_usage_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ke_search_vector"() RETURNS "trigger"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ke_search_vector"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_response_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Update parent response reply count
  IF NEW.parent_response_id IS NOT NULL THEN
    UPDATE section_responses
    SET reply_count = reply_count + 1,
        last_activity_at = NOW()
    WHERE id = NEW.parent_response_id;
  END IF;

  -- Update section response count
  UPDATE markdown_sections
  SET response_count = response_count + 1,
      last_response_at = NOW()
  WHERE entry_id = NEW.section_entry_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_response_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tag_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_tag_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_thread_path"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Calculate thread depth and path
  IF NEW.parent_response_id IS NULL THEN
    NEW.thread_depth = 0;
    NEW.thread_path = ARRAY[NEW.id::TEXT];
  ELSE
    SELECT
      thread_depth + 1,
      thread_path || NEW.id::TEXT
    INTO NEW.thread_depth, NEW.thread_path
    FROM section_responses
    WHERE id = NEW.parent_response_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_thread_path"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_topic_engagements"("p_topics" "text"[], "p_kind" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_user uuid := auth.uid();
  v_slug text;
  v_topic_id uuid;
  v_weight int;
BEGIN
  IF v_user IS NULL THEN
    -- unauthenticated; skip for now
    RETURN;
  END IF;
  IF p_topics IS NULL OR array_length(p_topics,1) IS NULL THEN
    RETURN;
  END IF;

  -- weight mapping
  IF p_kind = 'publish' THEN
    v_weight := 3;
  ELSIF p_kind = 'response' THEN
    v_weight := 2;
  ELSIF p_kind = 'applaud' THEN
    v_weight := 1;
  ELSE
    v_weight := 1;
  END IF;

  FOREACH v_slug IN ARRAY p_topics LOOP
    v_slug := lower(trim(v_slug));
    IF v_slug IS NULL OR v_slug = '' THEN CONTINUE; END IF;

    v_topic_id := ensure_topic(v_slug);

    INSERT INTO public.user_topic_engagements (
      user_id, topic_id, topic_slug, topic_label, score, publish_count, response_count, applaud_count, last_engaged_at
    ) VALUES (
      v_user, v_topic_id, v_slug, _label_from_slug(v_slug), v_weight,
      CASE WHEN p_kind='publish' THEN 1 ELSE 0 END,
      CASE WHEN p_kind='response' THEN 1 ELSE 0 END,
      CASE WHEN p_kind='applaud'  THEN 1 ELSE 0 END,
      now()
    )
    ON CONFLICT (user_id, topic_id)
    DO UPDATE SET
      score = public.user_topic_engagements.score + v_weight,
      publish_count = public.user_topic_engagements.publish_count + CASE WHEN p_kind='publish' THEN 1 ELSE 0 END,
      response_count = public.user_topic_engagements.response_count + CASE WHEN p_kind='response' THEN 1 ELSE 0 END,
      applaud_count = public.user_topic_engagements.applaud_count + CASE WHEN p_kind='applaud' THEN 1 ELSE 0 END,
      last_engaged_at = greatest(public.user_topic_engagements.last_engaged_at, now()),
      updated_at = now();
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_topic_engagements"("p_topics" "text"[], "p_kind" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_transaction_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_transaction_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_oauth_token"("token_param" character varying) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    token_data RECORD;
BEGIN
    SELECT 
        t.app_id,
        t.user_id,
        t.scopes,
        a.name as app_name,
        a.permissions as app_permissions
    INTO token_data
    FROM oauth_access_tokens t
    JOIN marketplace_apps a ON a.id = t.app_id
    WHERE t.token = token_param
      AND t.expires_at > NOW()
      AND t.revoked_at IS NULL;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    RETURN json_build_object(
        'app_id', token_data.app_id,
        'user_id', token_data.user_id,
        'scopes', token_data.scopes,
        'app_name', token_data.app_name,
        'permissions', token_data.app_permissions
    );
END;
$$;


ALTER FUNCTION "public"."validate_oauth_token"("token_param" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_plugin_status_transition"("old_status" "public"."plugin_status_enum", "new_status" "public"."plugin_status_enum") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Allow any transition from draft (initial state)
  IF old_status = 'draft' THEN
    RETURN true;
  END IF;
  
  -- Allow specific transitions based on workflow
  CASE old_status
    WHEN 'pending_review' THEN
      -- Can be approved, rejected, or returned to draft
      RETURN new_status IN ('approved', 'rejected', 'draft');
    WHEN 'approved' THEN
      -- Can be deprecated or returned to draft for major updates
      RETURN new_status IN ('deprecated', 'draft');
    WHEN 'rejected' THEN
      -- Can be returned to draft for fixes or permanently deprecated
      RETURN new_status IN ('draft', 'deprecated');
    WHEN 'deprecated' THEN
      -- Can be reactivated to draft for revival
      RETURN new_status = 'draft';
    ELSE
      RETURN false;
  END CASE;
END;
$$;


ALTER FUNCTION "public"."validate_plugin_status_transition"("old_status" "public"."plugin_status_enum", "new_status" "public"."plugin_status_enum") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "work_buddy"."create_work_buddy_profile"("p_user_id" "uuid", "p_bio" "text" DEFAULT NULL::"text", "p_working_hours" "jsonb" DEFAULT '{"end": "17:00", "start": "09:00"}'::"jsonb", "p_collaboration_preferences" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  profile_id UUID;
  default_traits JSONB;
BEGIN
  -- Set default traits for Work Buddy context
  default_traits := jsonb_build_object(
    'punctuality', 0.8,
    'collaboration', 0.8,
    'communication', 0.8,
    'availability', 0.8,
    'responsiveness', 0.8
  );

  -- Create the context profile (references public.create_user_context)
  SELECT public.create_user_context(
    p_user_id,
    'oo-work-buddy',
    p_bio,
    default_traits,
    jsonb_build_object(
      'working_hours', p_working_hours,
      'collaboration_preferences', p_collaboration_preferences
    )
  ) INTO profile_id;

  RETURN profile_id;
END;
$$;


ALTER FUNCTION "work_buddy"."create_work_buddy_profile"("p_user_id" "uuid", "p_bio" "text", "p_working_hours" "jsonb", "p_collaboration_preferences" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "work_buddy"."schedule_work_buddy_appointment"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_appointment_data" "jsonb", "p_scheduled_at" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  appointment_id UUID;
BEGIN
  -- Log the appointment interaction (references public.log_context_interaction)
  SELECT public.log_context_interaction(
    p_user_id,
    'oo-work-buddy',
    'appointment',
    p_appointment_data,
    p_target_user_id,
    p_scheduled_at
  ) INTO appointment_id;

  -- Also create a corresponding interaction for the target user
  PERFORM public.log_context_interaction(
    p_target_user_id,
    'oo-work-buddy',
    'appointment',
    jsonb_build_object(
      'appointment_id', appointment_id,
      'initiator_user_id', p_user_id,
      'role', 'participant'
    ) || p_appointment_data,
    p_user_id,
    p_scheduled_at
  );

  RETURN appointment_id;
END;
$$;


ALTER FUNCTION "work_buddy"."schedule_work_buddy_appointment"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_appointment_data" "jsonb", "p_scheduled_at" timestamp with time zone) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_ai"."insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid",
    "insight_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "confidence" numeric(3,2) NOT NULL,
    "source_app_id" "text" NOT NULL,
    "cross_app_visibility" boolean DEFAULT false NOT NULL,
    "supporting_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "insights_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "insights_insight_type_check" CHECK (("insight_type" = ANY (ARRAY['pattern'::"text", 'recommendation'::"text", 'goal_progress'::"text"])))
);


ALTER TABLE "hugo_ai"."insights" OWNER TO "postgres";


COMMENT ON TABLE "hugo_ai"."insights" IS 'AI insights with 0.7 confidence threshold for cross-app visibility';



COMMENT ON COLUMN "hugo_ai"."insights"."cross_app_visibility" IS 'True if confidence >= 0.7 (enables cross-app sharing)';



CREATE TABLE IF NOT EXISTS "hugo_ai"."sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "session_type" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ended_at" timestamp with time zone,
    "duration_seconds" integer,
    "message_count" integer DEFAULT 0 NOT NULL,
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "insights_generated" "jsonb" DEFAULT '[]'::"jsonb",
    "quality_score" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sessions_quality_score_check" CHECK ((("quality_score" >= 0) AND ("quality_score" <= 100))),
    CONSTRAINT "sessions_session_type_check" CHECK (("session_type" = ANY (ARRAY['chat'::"text", 'analysis'::"text", 'coaching'::"text", 'practice'::"text"])))
);


ALTER TABLE "hugo_ai"."sessions" OWNER TO "postgres";


COMMENT ON TABLE "hugo_ai"."sessions" IS 'AI coaching sessions from all Hugo apps';



COMMENT ON COLUMN "hugo_ai"."sessions"."context_data" IS 'Session-specific context (domain, goals, mood, etc.)';



COMMENT ON COLUMN "hugo_ai"."sessions"."insights_generated" IS 'Array of insights generated during session';



CREATE TABLE IF NOT EXISTS "hugo_career"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app_id" "text" DEFAULT 'hugo_career'::"text" NOT NULL,
    "profile_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "hugo_career"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "hugo_career"."profiles" IS 'Hugo Career professional profiles (JSONB for flexible schema)';



COMMENT ON COLUMN "hugo_career"."profiles"."profile_data" IS 'Professional profile data: role, skills, goals, education, etc.';



CREATE TABLE IF NOT EXISTS "hugo_love"."ai_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "content_type" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_documents_content_type_check" CHECK (("content_type" = ANY (ARRAY['BaseCharacteristics'::"text", 'RelationshipGoals'::"text", 'LifeEvents'::"text", 'StickingPoints'::"text"])))
);


ALTER TABLE "hugo_love"."ai_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "blocker_user_id" "uuid" NOT NULL,
    "blocked_user_id" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blocks_reason_check" CHECK (("length"("reason") <= 500)),
    CONSTRAINT "chk_no_self_block" CHECK (("blocker_user_id" <> "blocked_user_id"))
);


ALTER TABLE "hugo_love"."blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."content_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_type" "text" NOT NULL,
    "content_id" "uuid" NOT NULL,
    "flag_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "confidence" numeric(3,2) NOT NULL,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by_admin_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_flags_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "content_flags_content_type_check" CHECK (("content_type" = ANY (ARRAY['message'::"text", 'profile_bio'::"text", 'profile_interests'::"text"]))),
    CONSTRAINT "content_flags_flag_type_check" CHECK (("flag_type" = ANY (ARRAY['harassment'::"text", 'hate_speech'::"text", 'sexual_content'::"text", 'spam'::"text", 'self_harm'::"text"]))),
    CONSTRAINT "content_flags_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "content_flags_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "hugo_love"."content_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."content_moderation_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_id" "text" NOT NULL,
    "content_type" "text" NOT NULL,
    "is_approved" boolean NOT NULL,
    "confidence" numeric(3,2) NOT NULL,
    "violations" "jsonb" DEFAULT '[]'::"jsonb",
    "moderation_details" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "text" DEFAULT 'hugo_love'::"text" NOT NULL,
    CONSTRAINT "content_moderation_results_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "content_moderation_results_content_id_check" CHECK (("content_id" ~ '^[a-zA-Z0-9_-]+$'::"text")),
    CONSTRAINT "content_moderation_results_content_type_check" CHECK (("content_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'video'::"text", 'audio'::"text"])))
);


ALTER TABLE "hugo_love"."content_moderation_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "current_stage" "text" DEFAULT 'celebration'::"text" NOT NULL,
    "message_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "conversations_current_stage_check" CHECK (("current_stage" = ANY (ARRAY['celebration'::"text", 'connection'::"text", 'spark'::"text", 'payOff'::"text", 'spiral'::"text"]))),
    CONSTRAINT "conversations_title_check" CHECK (("char_length"("title") <= 200))
);


ALTER TABLE "hugo_love"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."document_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_pdf" "text" NOT NULL,
    "chunk_index" integer NOT NULL,
    "content" "text" NOT NULL,
    "embedding" "public"."vector"(1536) NOT NULL,
    "metadata" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "hugo_love"."document_chunks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."error_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text",
    "tenant_id" "text" NOT NULL,
    "error_type" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "stack_trace" "text",
    "context" "jsonb",
    "severity" "text" NOT NULL,
    "resolved" boolean DEFAULT false NOT NULL,
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "error_logs_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "valid_severity" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "hugo_love"."error_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."ice_breakers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "category" "text" NOT NULL,
    "confidence" numeric(3,2) NOT NULL,
    "personalization_factors" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ice_breakers_category_check" CHECK (("category" = ANY (ARRAY['shared_interest'::"text", 'photo_comment'::"text", 'conversation_starter'::"text"]))),
    CONSTRAINT "ice_breakers_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))
);


ALTER TABLE "hugo_love"."ice_breakers" OWNER TO "postgres";


COMMENT ON TABLE "hugo_love"."ice_breakers" IS 'AI-generated personalized ice breakers for dating profiles';



CREATE TABLE IF NOT EXISTS "hugo_love"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user1_id" "text" NOT NULL,
    "user2_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "compatibility_score" integer NOT NULL,
    "is_mutual" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "last_interaction" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "matches_compatibility_score_check" CHECK ((("compatibility_score" >= 0) AND ("compatibility_score" <= 100))),
    CONSTRAINT "matches_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'blocked'::"text"]))),
    CONSTRAINT "valid_compatibility_score" CHECK ((("compatibility_score" >= 0) AND ("compatibility_score" <= 100))),
    CONSTRAINT "valid_user_order" CHECK (("user1_id" < "user2_id"))
);


ALTER TABLE "hugo_love"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "tone" "text",
    "tags" "jsonb",
    "tic_chunk_ids" "uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_content_check" CHECK (("char_length"("content") <= 10000)),
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"]))),
    CONSTRAINT "messages_tone_check" CHECK (("tone" = ANY (ARRAY['friendly'::"text", 'supportive'::"text", 'encouraging'::"text"])))
);


ALTER TABLE "hugo_love"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."mixer_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "mixer_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'confirmed'::character varying NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"(),
    "canceled_at" timestamp with time zone,
    CONSTRAINT "mixer_registrations_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['confirmed'::character varying, 'canceled'::character varying, 'waitlist'::character varying])::"text"[])))
);


ALTER TABLE "hugo_love"."mixer_registrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."mode_switches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "from_mode" character varying(20) NOT NULL,
    "to_mode" character varying(20) NOT NULL,
    "switched_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "mode_switches_from_mode_check" CHECK ((("from_mode")::"text" = ANY ((ARRAY['single'::character varying, 'partner'::character varying])::"text"[]))),
    CONSTRAINT "mode_switches_to_mode_check" CHECK ((("to_mode")::"text" = ANY ((ARRAY['single'::character varying, 'partner'::character varying])::"text"[])))
);


ALTER TABLE "hugo_love"."mode_switches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_user_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "related_report_id" "uuid",
    "action_type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "duration_hours" integer,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_suspend_has_duration" CHECK (((("action_type" = 'suspend'::"text") AND ("duration_hours" IS NOT NULL)) OR ("action_type" <> 'suspend'::"text"))),
    CONSTRAINT "moderation_actions_action_type_check" CHECK (("action_type" = ANY (ARRAY['warn'::"text", 'suspend'::"text", 'ban'::"text", 'unban'::"text", 'delete_content'::"text", 'dismiss_report'::"text"]))),
    CONSTRAINT "moderation_actions_duration_hours_check" CHECK (("duration_hours" > 0)),
    CONSTRAINT "moderation_actions_reason_check" CHECK (("length"("reason") >= 10))
);


ALTER TABLE "hugo_love"."moderation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."moderation_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "action_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "text" DEFAULT 'hugo_love'::"text" NOT NULL,
    CONSTRAINT "moderation_audit_log_action_type_check" CHECK (("action_type" = ANY (ARRAY['report_created'::"text", 'report_resolved'::"text", 'report_dismissed'::"text", 'report_escalated'::"text", 'user_blocked'::"text", 'user_unblocked'::"text", 'content_moderated'::"text", 'config_updated'::"text"]))),
    CONSTRAINT "moderation_audit_log_entity_id_check" CHECK (("entity_id" ~ '^[a-zA-Z0-9_-]+$'::"text")),
    CONSTRAINT "moderation_audit_log_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['report'::"text", 'block'::"text", 'content'::"text", 'configuration'::"text"]))),
    CONSTRAINT "moderation_audit_log_user_id_check" CHECK (("user_id" ~ '^[a-zA-Z0-9_-]+$'::"text"))
);


ALTER TABLE "hugo_love"."moderation_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."moderation_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "auto_moderation_enabled" boolean DEFAULT true NOT NULL,
    "content_filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "report_response_time_hours" integer DEFAULT 24 NOT NULL,
    "auto_action_threshold" numeric(3,2) DEFAULT 0.8 NOT NULL,
    "manual_review_threshold" numeric(3,2) DEFAULT 0.6 NOT NULL,
    "escalation_enabled" boolean DEFAULT true NOT NULL,
    "notification_enabled" boolean DEFAULT true NOT NULL,
    "analytics_enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "text",
    CONSTRAINT "moderation_configurations_auto_action_threshold_check" CHECK ((("auto_action_threshold" >= (0)::numeric) AND ("auto_action_threshold" <= (1)::numeric))),
    CONSTRAINT "moderation_configurations_manual_review_threshold_check" CHECK ((("manual_review_threshold" >= (0)::numeric) AND ("manual_review_threshold" <= (1)::numeric))),
    CONSTRAINT "moderation_configurations_report_response_time_hours_check" CHECK (("report_response_time_hours" > 0)),
    CONSTRAINT "moderation_configurations_tenant_id_check" CHECK (("tenant_id" ~ '^[a-zA-Z0-9_-]+$'::"text")),
    CONSTRAINT "moderation_configurations_updated_by_check" CHECK ((("updated_by" IS NULL) OR ("updated_by" ~ '^[a-zA-Z0-9_-]+$'::"text")))
);


ALTER TABLE "hugo_love"."moderation_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."offline_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "operation_type" "text" NOT NULL,
    "operation_data" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 3 NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "offline_operations_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['swipe'::"text", 'rating'::"text", 'message'::"text", 'match'::"text", 'report'::"text"]))),
    CONSTRAINT "offline_operations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "valid_operation_type" CHECK (("operation_type" = ANY (ARRAY['swipe'::"text", 'rating'::"text", 'message'::"text", 'match'::"text", 'report'::"text"]))),
    CONSTRAINT "valid_retry_count" CHECK ((("retry_count" >= 0) AND ("retry_count" <= "max_retries"))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "hugo_love"."offline_operations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."partnerships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_a_id" "uuid" NOT NULL,
    "user_b_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "invitation_email" "text" NOT NULL,
    "invitation_message" "text",
    "invitation_sent_at" timestamp with time zone DEFAULT "now"(),
    "connected_at" timestamp with time zone,
    "disconnected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "different_users" CHECK (("user_a_id" <> "user_b_id")),
    CONSTRAINT "partnerships_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'disconnected'::character varying])::"text"[])))
);


ALTER TABLE "hugo_love"."partnerships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app_id" "text" DEFAULT 'hugo_love'::"text" NOT NULL,
    "profile_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "hugo_love"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "hugo_love"."profiles" IS 'Hugo Love dating profiles (JSONB for flexible schema)';



COMMENT ON COLUMN "hugo_love"."profiles"."profile_data" IS 'Dating profile data: age, gender, interests, preferences, etc.';



CREATE TABLE IF NOT EXISTS "hugo_love"."rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "endpoint" character varying(255) NOT NULL,
    "request_count" integer DEFAULT 0 NOT NULL,
    "window_start" timestamp without time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "hugo_love"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rater_id" "text" NOT NULL,
    "rated_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "attractiveness" integer NOT NULL,
    "personality" integer NOT NULL,
    "lifestyle" integer NOT NULL,
    "compatibility" integer NOT NULL,
    "overall_score" integer NOT NULL,
    "notes" "text",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ratings_attractiveness_check" CHECK ((("attractiveness" >= 0) AND ("attractiveness" <= 10))),
    CONSTRAINT "ratings_compatibility_check" CHECK ((("compatibility" >= 0) AND ("compatibility" <= 10))),
    CONSTRAINT "ratings_lifestyle_check" CHECK ((("lifestyle" >= 0) AND ("lifestyle" <= 10))),
    CONSTRAINT "ratings_overall_score_check" CHECK ((("overall_score" >= 0) AND ("overall_score" <= 100))),
    CONSTRAINT "ratings_personality_check" CHECK ((("personality" >= 0) AND ("personality" <= 10))),
    CONSTRAINT "valid_rating_range" CHECK ((("attractiveness" >= 0) AND ("attractiveness" <= 10) AND ("personality" >= 0) AND ("personality" <= 10) AND ("lifestyle" >= 0) AND ("lifestyle" <= 10) AND ("compatibility" >= 0) AND ("compatibility" <= 10)))
);


ALTER TABLE "hugo_love"."ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reporter_user_id" "uuid" NOT NULL,
    "reported_user_id" "uuid",
    "reported_message_id" "uuid",
    "report_type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "resolved_by_admin_id" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_message_report_has_message_id" CHECK (((("report_type" = 'message'::"text") AND ("reported_message_id" IS NOT NULL)) OR ("report_type" <> 'message'::"text"))),
    CONSTRAINT "chk_no_self_report" CHECK (("reporter_user_id" <> "reported_user_id")),
    CONSTRAINT "reports_description_check" CHECK (("length"("description") <= 500)),
    CONSTRAINT "reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'harassment'::"text", 'inappropriate_content'::"text", 'fake_profile'::"text", 'underage'::"text", 'other'::"text"]))),
    CONSTRAINT "reports_report_type_check" CHECK (("report_type" = ANY (ARRAY['profile'::"text", 'message'::"text", 'behavior'::"text"]))),
    CONSTRAINT "reports_resolution_notes_check" CHECK (("length"("resolution_notes") <= 1000)),
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'resolved'::"text", 'dismissed'::"text"])))
);


ALTER TABLE "hugo_love"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "tier" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "start_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "end_date" timestamp with time zone,
    "auto_renew" boolean DEFAULT false NOT NULL,
    "features" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "usage_limits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "subscriptions_tier_check" CHECK (("tier" = ANY (ARRAY['free'::"text", 'premium_matchmaking'::"text", 'premium_tic_coaching'::"text"]))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "valid_tier" CHECK (("tier" = ANY (ARRAY['free'::"text", 'premium_matchmaking'::"text", 'premium_tic_coaching'::"text"])))
);


ALTER TABLE "hugo_love"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."swipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "direction" "text" NOT NULL,
    "session_id" "text" NOT NULL,
    "device_info" "text",
    "location" "text",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "swipes_direction_check" CHECK (("direction" = ANY (ARRAY['left'::"text", 'right'::"text"]))),
    CONSTRAINT "valid_direction" CHECK (("direction" = ANY (ARRAY['left'::"text", 'right'::"text"])))
);


ALTER TABLE "hugo_love"."swipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."unlock_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "feature_type" "text" NOT NULL,
    "is_unlocked" boolean DEFAULT false NOT NULL,
    "unlock_condition" "text" NOT NULL,
    "unlocked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "unlock_status_feature_type_check" CHECK (("feature_type" = ANY (ARRAY['speed_date'::"text", 'extended_date'::"text", 'premium_features'::"text"]))),
    CONSTRAINT "valid_feature_type" CHECK (("feature_type" = ANY (ARRAY['speed_date'::"text", 'extended_date'::"text", 'premium_features'::"text"])))
);


ALTER TABLE "hugo_love"."unlock_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "hugo_love"."user_restrictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "restriction_type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "applied_by_admin_id" "uuid" NOT NULL,
    "related_action_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_ban_permanent" CHECK (((("restriction_type" = 'ban'::"text") AND ("expires_at" IS NULL)) OR ("restriction_type" <> 'ban'::"text"))),
    CONSTRAINT "chk_suspension_expires" CHECK (((("restriction_type" = 'suspension'::"text") AND ("expires_at" IS NOT NULL)) OR ("restriction_type" <> 'suspension'::"text"))),
    CONSTRAINT "user_restrictions_restriction_type_check" CHECK (("restriction_type" = ANY (ARRAY['warning'::"text", 'suspension'::"text", 'ban'::"text"])))
);


ALTER TABLE "hugo_love"."user_restrictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "live_mixers"."category_stars" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "live_mixers"."category_stars" OWNER TO "postgres";


COMMENT ON TABLE "live_mixers"."category_stars" IS 'Stores which event categories users have starred in Live Mixers';



COMMENT ON COLUMN "live_mixers"."category_stars"."user_id" IS 'User ID from auth.users.id (stored as TEXT)';



COMMENT ON COLUMN "live_mixers"."category_stars"."category_id" IS 'Category ID from the categories table';



COMMENT ON COLUMN "live_mixers"."category_stars"."created_at" IS 'When the category was starred';



COMMENT ON COLUMN "live_mixers"."category_stars"."updated_at" IS 'When the star record was last updated';



CREATE TABLE IF NOT EXISTS "live_mixers"."mixer_event_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "entry_price" integer,
    "currency" character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "google_maps_url" "text",
    "organizer_notes" "text",
    "is_featured" boolean DEFAULT false NOT NULL,
    "tags" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_mixer_event_metadata_currency" CHECK ((("currency")::"text" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "chk_mixer_event_metadata_price" CHECK ((("entry_price" IS NULL) OR ("entry_price" >= 0))),
    CONSTRAINT "chk_mixer_event_metadata_tags_count" CHECK ((("array_length"("tags", 1) IS NULL) OR ("array_length"("tags", 1) <= 10)))
);


ALTER TABLE "live_mixers"."mixer_event_metadata" OWNER TO "postgres";


COMMENT ON TABLE "live_mixers"."mixer_event_metadata" IS 'Mixer-specific metadata for events stored in Oriva API';



COMMENT ON COLUMN "live_mixers"."mixer_event_metadata"."event_id" IS 'Reference to calendar_events(id) in Oriva API';



COMMENT ON COLUMN "live_mixers"."mixer_event_metadata"."category_id" IS 'Reference to mixer_event_categories(id)';



COMMENT ON COLUMN "live_mixers"."mixer_event_metadata"."entry_price" IS 'Entry price in cents (null for free events)';



COMMENT ON COLUMN "live_mixers"."mixer_event_metadata"."currency" IS 'ISO 4217 currency code (default: USD)';



COMMENT ON COLUMN "live_mixers"."mixer_event_metadata"."google_maps_url" IS 'Google Maps URL for event location';



COMMENT ON COLUMN "live_mixers"."mixer_event_metadata"."organizer_notes" IS 'Private notes for event organizers';



COMMENT ON COLUMN "live_mixers"."mixer_event_metadata"."is_featured" IS 'Whether event should be featured prominently';



COMMENT ON COLUMN "live_mixers"."mixer_event_metadata"."tags" IS 'Array of search tags (max 10)';



CREATE TABLE IF NOT EXISTS "live_mixers"."mixer_notification_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "rule_type" "public"."mixer_notification_rule_type" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL,
    "parameters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_mixer_notification_rules_category_based" CHECK ((("rule_type" <> 'category_based'::"public"."mixer_notification_rule_type") OR (("parameters" ? 'category_ids'::"text") AND ("jsonb_typeof"(("parameters" -> 'category_ids'::"text")) = 'array'::"text")))),
    CONSTRAINT "chk_mixer_notification_rules_distance_based" CHECK ((("rule_type" <> 'distance_based'::"public"."mixer_notification_rule_type") OR (("parameters" ? 'distance_km'::"text") AND ((("parameters" ->> 'distance_km'::"text"))::integer >= 1) AND ((("parameters" ->> 'distance_km'::"text"))::integer <= 500)))),
    CONSTRAINT "chk_mixer_notification_rules_organizer_based" CHECK ((("rule_type" <> 'organizer_based'::"public"."mixer_notification_rule_type") OR (("parameters" ? 'organizer_ids'::"text") AND ("jsonb_typeof"(("parameters" -> 'organizer_ids'::"text")) = 'array'::"text")))),
    CONSTRAINT "chk_mixer_notification_rules_timing" CHECK ((("parameters" ? 'notification_timing'::"text") AND (("parameters" ->> 'notification_timing'::"text") = ANY (ARRAY['immediate'::"text", 'daily'::"text", 'weekly'::"text"]))))
);


ALTER TABLE "live_mixers"."mixer_notification_rules" OWNER TO "postgres";


COMMENT ON TABLE "live_mixers"."mixer_notification_rules" IS 'User-specific notification rules for Live Mixers events';



COMMENT ON COLUMN "live_mixers"."mixer_notification_rules"."rule_type" IS 'Type of notification rule (distance, category, or organizer-based)';



COMMENT ON COLUMN "live_mixers"."mixer_notification_rules"."is_enabled" IS 'Whether the notification rule is active';



COMMENT ON COLUMN "live_mixers"."mixer_notification_rules"."parameters" IS 'JSON object containing rule-specific parameters';



CREATE TABLE IF NOT EXISTS "live_mixers"."mixer_registration_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "registration_id" "uuid" NOT NULL,
    "user_id" "text" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "local_notes" "text",
    "reminder_sent" boolean DEFAULT false NOT NULL,
    "reminder_sent_at" timestamp with time zone,
    "check_in_time" timestamp with time zone,
    "check_out_time" timestamp with time zone,
    "rating" integer,
    "feedback" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mixer_registration_metadata_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "live_mixers"."mixer_registration_metadata" OWNER TO "postgres";


COMMENT ON TABLE "live_mixers"."mixer_registration_metadata" IS 'Live Mixers-specific metadata for user event registrations';



COMMENT ON COLUMN "live_mixers"."mixer_registration_metadata"."registration_id" IS 'Reference to public.user_registrations(id)';



COMMENT ON COLUMN "live_mixers"."mixer_registration_metadata"."local_notes" IS 'User-specific notes about their registration';



CREATE TABLE IF NOT EXISTS "live_mixers"."mixer_user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "notification_distance_km" integer DEFAULT 25 NOT NULL,
    "preferred_event_types" "text"[] DEFAULT ARRAY['offline'::"text", 'online'::"text"] NOT NULL,
    "starred_categories" "uuid"[] DEFAULT ARRAY[]::"uuid"[] NOT NULL,
    "ui_preferences" "jsonb" DEFAULT '{"theme": "auto", "default_view": "list", "show_distance": true, "show_attendee_count": true}'::"jsonb" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_mixer_user_preferences_distance" CHECK ((("notification_distance_km" >= 1) AND ("notification_distance_km" <= 500))),
    CONSTRAINT "chk_mixer_user_preferences_event_types" CHECK (("preferred_event_types" <@ ARRAY['online'::"text", 'offline'::"text", 'session'::"text", 'meeting'::"text"]))
);


ALTER TABLE "live_mixers"."mixer_user_preferences" OWNER TO "postgres";


COMMENT ON TABLE "live_mixers"."mixer_user_preferences" IS 'User-specific preferences for Live Mixers app';



COMMENT ON COLUMN "live_mixers"."mixer_user_preferences"."notification_distance_km" IS 'Distance radius for event notifications (1-500 km)';



COMMENT ON COLUMN "live_mixers"."mixer_user_preferences"."preferred_event_types" IS 'Array of preferred event types';



COMMENT ON COLUMN "live_mixers"."mixer_user_preferences"."starred_categories" IS 'Array of starred category IDs for priority display';



COMMENT ON COLUMN "live_mixers"."mixer_user_preferences"."ui_preferences" IS 'JSON object containing UI-specific preferences';



CREATE TABLE IF NOT EXISTS "oriva_platform"."apps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "schema_name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "apps_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'extracting'::"text"])))
);


ALTER TABLE "oriva_platform"."apps" OWNER TO "postgres";


COMMENT ON TABLE "oriva_platform"."apps" IS 'Registry of all applications in the platform';



COMMENT ON COLUMN "oriva_platform"."apps"."schema_name" IS 'PostgreSQL schema name for app-specific data';



CREATE TABLE IF NOT EXISTS "oriva_platform"."extraction_manifests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_app_id" "text" NOT NULL,
    "status" "text" DEFAULT 'prepared'::"text" NOT NULL,
    "target_format" "text" NOT NULL,
    "include_schemas" "text"[] DEFAULT ARRAY['profiles'::"text", 'sessions'::"text", 'insights'::"text"],
    "data_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "download_url" "text",
    "download_expires_at" timestamp with time zone,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "extraction_manifests_status_check" CHECK (("status" = ANY (ARRAY['prepared'::"text", 'executing'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "extraction_manifests_target_format_check" CHECK (("target_format" = ANY (ARRAY['json'::"text", 'csv'::"text"])))
);


ALTER TABLE "oriva_platform"."extraction_manifests" OWNER TO "postgres";


COMMENT ON TABLE "oriva_platform"."extraction_manifests" IS 'User data extraction requests for GDPR compliance';



COMMENT ON COLUMN "oriva_platform"."extraction_manifests"."status" IS 'Extraction status: prepared, executing, completed, failed';



COMMENT ON COLUMN "oriva_platform"."extraction_manifests"."target_format" IS 'Export format: json or csv';



COMMENT ON COLUMN "oriva_platform"."extraction_manifests"."include_schemas" IS 'Array of schema types to include in extraction';



COMMENT ON COLUMN "oriva_platform"."extraction_manifests"."data_summary" IS 'Summary of extracted data: record counts, size, etc.';



COMMENT ON COLUMN "oriva_platform"."extraction_manifests"."download_url" IS 'Signed URL for downloading extracted data';



COMMENT ON COLUMN "oriva_platform"."extraction_manifests"."expires_at" IS '7-day expiration for manifest and download link';



CREATE TABLE IF NOT EXISTS "oriva_platform"."mixers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "title" character varying(100) NOT NULL,
    "description" "text" NOT NULL,
    "venue_id" "uuid" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "capacity" integer NOT NULL,
    "image_url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "visibility" character varying(20) DEFAULT 'public'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "mixers_capacity_check" CHECK ((("capacity" >= 5) AND ("capacity" <= 500))),
    CONSTRAINT "mixers_visibility_check" CHECK ((("visibility")::"text" = ANY ((ARRAY['public'::character varying, 'invite_only'::character varying, 'partner_only'::character varying])::"text"[]))),
    CONSTRAINT "valid_time_range" CHECK (("end_time" > "start_time"))
);


ALTER TABLE "oriva_platform"."mixers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "oriva_platform"."user_app_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_active_at" timestamp with time zone,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "user_app_access_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'admin'::"text", 'owner'::"text"]))),
    CONSTRAINT "user_app_access_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text", 'deleted'::"text"])))
);


ALTER TABLE "oriva_platform"."user_app_access" OWNER TO "postgres";


COMMENT ON TABLE "oriva_platform"."user_app_access" IS 'User access control and roles per app';



CREATE TABLE IF NOT EXISTS "oriva_platform"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "auth_provider" "text" DEFAULT 'oriva_sso'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_active_at" timestamp with time zone
);


ALTER TABLE "oriva_platform"."users" OWNER TO "postgres";


COMMENT ON TABLE "oriva_platform"."users" IS 'Platform-wide user registry (single source of truth)';



CREATE TABLE IF NOT EXISTS "oriva_platform"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "address" "text" NOT NULL,
    "city" character varying(100) NOT NULL,
    "state" character varying(2) NOT NULL,
    "latitude" numeric(10,7) NOT NULL,
    "longitude" numeric(10,7) NOT NULL,
    "location" "public"."geography"(Point,4326) GENERATED ALWAYS AS ("public"."st_setsrid"("public"."st_makepoint"(("longitude")::double precision, ("latitude")::double precision), 4326)) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "venues_latitude_check" CHECK ((("latitude" >= ('-90'::integer)::numeric) AND ("latitude" <= (90)::numeric))),
    CONSTRAINT "venues_longitude_check" CHECK ((("longitude" >= ('-180'::integer)::numeric) AND ("longitude" <= (180)::numeric)))
);


ALTER TABLE "oriva_platform"."venues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agreement_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agreement_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "agreed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agreement_participants_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'agreed'::"text", 'disagreed'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."agreement_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "status" "public"."agreement_status" DEFAULT 'draft'::"public"."agreement_status",
    "entry_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profile_id" "uuid",
    "collection_id" "uuid"
);


ALTER TABLE "public"."agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Conversation'::"text" NOT NULL,
    "retention_days" integer,
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_conversations_title_length" CHECK ((("char_length"("title") > 0) AND ("char_length"("title") <= 200)))
);


ALTER TABLE "public"."ai_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_messages_valid_role" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."ai_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_api_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "endpoint" character varying(255),
    "method" character varying(10),
    "status_code" integer,
    "response_time_ms" integer,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_api_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_oauth_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "uuid" NOT NULL,
    "client_id" character varying(255) NOT NULL,
    "client_secret" character varying(255) NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_oauth_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rating" integer,
    "review_text" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "app_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."app_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_webhooks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "app_id" "text" NOT NULL,
    "webhook_url" "text" NOT NULL,
    "webhook_secret" "text" NOT NULL,
    "subscribed_events" "text"[] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_delivery_at" timestamp with time zone,
    "last_success_at" timestamp with time zone,
    "last_failure_at" timestamp with time zone,
    "consecutive_failures" integer DEFAULT 0 NOT NULL,
    "total_deliveries" integer DEFAULT 0 NOT NULL,
    "total_failures" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 5 NOT NULL,
    "retry_backoff_seconds" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_webhooks_max_retries_check" CHECK ((("max_retries" >= 1) AND ("max_retries" <= 10))),
    CONSTRAINT "app_webhooks_subscribed_events_check" CHECK (("array_length"("subscribed_events", 1) > 0)),
    CONSTRAINT "app_webhooks_webhook_secret_check" CHECK (("length"("webhook_secret") >= 32)),
    CONSTRAINT "app_webhooks_webhook_url_check" CHECK (("webhook_url" ~~ 'https://%'::"text"))
);


ALTER TABLE "public"."app_webhooks" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_webhooks" IS 'Webhook subscriptions for third-party apps';



COMMENT ON COLUMN "public"."app_webhooks"."webhook_url" IS 'HTTPS endpoint for webhook delivery';



COMMENT ON COLUMN "public"."app_webhooks"."webhook_secret" IS 'Secret for HMAC signature verification (min 32 chars)';



COMMENT ON COLUMN "public"."app_webhooks"."subscribed_events" IS 'Array of event type patterns (supports wildcards)';



COMMENT ON COLUMN "public"."app_webhooks"."consecutive_failures" IS 'Auto-disable webhook after 100 consecutive failures';



CREATE TABLE IF NOT EXISTS "public"."audiences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."audience_type" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audiences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "added_by" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"(),
    "order" integer
);


ALTER TABLE "public"."collection_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collection_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_private" boolean DEFAULT true,
    "color" "text",
    "organization_rules" "jsonb" DEFAULT '{}'::"jsonb",
    "parent_id" "uuid",
    "type" "text" DEFAULT 'standard'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "collections_type_check" CHECK (("type" = ANY (ARRAY['standard'::"text", 'smart'::"text"])))
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "collection_type" "text" DEFAULT 'standard'::"text",
    "source_content" "text",
    "parsing_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "user_id" "uuid",
    "profile_id" "uuid",
    "audience" "jsonb" DEFAULT '{"type": "private"}'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "entry_count" integer DEFAULT 0,
    "view_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_at" timestamp with time zone,
    CONSTRAINT "content_collections_collection_type_check" CHECK (("collection_type" = ANY (ARRAY['standard'::"text", 'telescope'::"text", 'thread'::"text", 'series'::"text"]))),
    CONSTRAINT "content_collections_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."content_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "topic_slug" "text" NOT NULL,
    "topic_label" "text" NOT NULL,
    "confidence_score" numeric(3,2) NOT NULL,
    "source" "text" DEFAULT 'ai'::"text" NOT NULL,
    "extraction_method" "text",
    "keywords" "text"[],
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "content_topics_confidence_score_check" CHECK ((("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric))),
    CONSTRAINT "content_topics_source_check" CHECK (("source" = ANY (ARRAY['ai'::"text", 'manual'::"text", 'suggested'::"text"])))
);


ALTER TABLE "public"."content_topics" OWNER TO "postgres";


COMMENT ON TABLE "public"."content_topics" IS 'Stores AI-extracted topics from entry content for improved discovery and search';



COMMENT ON COLUMN "public"."content_topics"."topic_slug" IS 'URL-friendly slug like "pink-puppy", "sustainable-fashion"';



COMMENT ON COLUMN "public"."content_topics"."topic_label" IS 'Human-readable label like "Pink Puppy", "Sustainable Fashion"';



COMMENT ON COLUMN "public"."content_topics"."confidence_score" IS 'AI confidence score from 0.0 to 1.0';



COMMENT ON COLUMN "public"."content_topics"."source" IS 'Origin of topic: ai (extracted), manual (user-added), suggested (recommended)';



COMMENT ON COLUMN "public"."content_topics"."extraction_method" IS 'Method used for extraction: openai-gpt4, keyword-matching, etc.';



CREATE TABLE IF NOT EXISTS "public"."context_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "context" "text" NOT NULL,
    "type" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "target_user_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "scheduled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "context_interactions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'cancelled'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."context_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."context_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "context" "text" NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "data_type" "text" DEFAULT 'string'::"text",
    "is_user_configurable" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "context_settings_data_type_check" CHECK (("data_type" = ANY (ARRAY['string'::"text", 'number'::"text", 'boolean'::"text", 'object'::"text", 'array'::"text"])))
);


ALTER TABLE "public"."context_settings" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."context_usage_stats" AS
 SELECT "context",
    "count"(DISTINCT "user_id") AS "active_users",
    "count"(*) AS "total_interactions",
    "count"(
        CASE
            WHEN ("created_at" >= ("now"() - '24:00:00'::interval)) THEN 1
            ELSE NULL::integer
        END) AS "interactions_24h",
    "count"(
        CASE
            WHEN ("created_at" >= ("now"() - '7 days'::interval)) THEN 1
            ELSE NULL::integer
        END) AS "interactions_7d",
    "count"(
        CASE
            WHEN ("created_at" >= ("now"() - '30 days'::interval)) THEN 1
            ELSE NULL::integer
        END) AS "interactions_30d"
   FROM "public"."context_interactions"
  GROUP BY "context";


ALTER VIEW "public"."context_usage_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."developer_api_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "key_prefix" "text" NOT NULL,
    "permissions" "text"[] DEFAULT ARRAY['read:profile'::"text", 'read:entries'::"text"] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "last_used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "developer_api_keys_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 100)))
);


ALTER TABLE "public"."developer_api_keys" OWNER TO "postgres";


COMMENT ON TABLE "public"."developer_api_keys" IS 'Stores developer API keys for marketplace applications';



COMMENT ON COLUMN "public"."developer_api_keys"."key_hash" IS 'SHA-256 hash of the full API key for secure storage';



COMMENT ON COLUMN "public"."developer_api_keys"."key_prefix" IS 'First 8 characters of key for display purposes';



COMMENT ON COLUMN "public"."developer_api_keys"."permissions" IS 'Array of permission strings (e.g., read:entries, write:entries)';



CREATE TABLE IF NOT EXISTS "public"."developers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_name" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "hashed_api_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "api_key" character varying(255),
    "status" character varying(50) DEFAULT 'active'::character varying,
    "name" character varying(255)
);


ALTER TABLE "public"."developers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dm_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant_ids" "uuid"[] NOT NULL,
    "last_message_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "dm_conversations_exactly_two_participants" CHECK (("array_length"("participant_ids", 1) = 2))
);


ALTER TABLE "public"."dm_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dm_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "read_by" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dm_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "public"."entry_status" DEFAULT 'published'::"public"."entry_status",
    "template_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "audience" "jsonb" DEFAULT '{"type": "public", "users": [], "groups": []}'::"jsonb",
    "template" "jsonb",
    "sections" "jsonb" DEFAULT '[]'::"jsonb",
    "auto_saved" boolean DEFAULT false,
    "response_count" "jsonb" DEFAULT '{"total": 0, "curate": 0, "applaud": 0, "iterate": 0, "moderate": 0}'::"jsonb",
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "has_tasks" boolean DEFAULT false,
    "phase_number" integer,
    "collection_id" "uuid",
    "task_count" integer DEFAULT 0,
    "parent_id" "uuid",
    "display_order" integer DEFAULT 0,
    "content_embedding" "public"."vector"(1536),
    "title_embedding" "public"."vector"(1536),
    "combined_embedding" "public"."vector"(1536),
    "topics" "text"[],
    "embedding_model" "text" DEFAULT 'text-embedding-ada-002'::"text",
    "embedding_updated_at" timestamp with time zone,
    "media" "jsonb" DEFAULT '[]'::"jsonb",
    "telescope_collection_id" "uuid",
    "heading_level" integer DEFAULT 1,
    "creation_method" "text" DEFAULT 'manual'::"text",
    "word_count" integer DEFAULT 0,
    "estimated_read_time" integer DEFAULT 0,
    "relation_count" integer DEFAULT 0,
    CONSTRAINT "chk_entries_no_self_reference" CHECK (("id" <> "parent_id")),
    CONSTRAINT "entries_creation_method_check" CHECK (("creation_method" = ANY (ARRAY['manual'::"text", 'parsed'::"text"])))
);


ALTER TABLE "public"."entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."entries" IS 'User journal entries with RLS enabled. Users can only access entries belonging to their own profile_id.';



COMMENT ON COLUMN "public"."entries"."user_id" IS 'Reference to auth.users.id - owner of the entry';



COMMENT ON COLUMN "public"."entries"."audience" IS 'JSON object storing audience selection: {type: "everyone"|"following"|"group"|"custom", groups: [], users: []}';



COMMENT ON COLUMN "public"."entries"."template" IS 'JSON object storing template reference and metadata';



COMMENT ON COLUMN "public"."entries"."sections" IS 'JSON array storing structured entry sections with type, content, formatting';



COMMENT ON COLUMN "public"."entries"."auto_saved" IS 'Boolean flag indicating if entry was auto-saved';



COMMENT ON COLUMN "public"."entries"."is_anonymous" IS 'Whether this entry was 
  submitted anonymously';



COMMENT ON COLUMN "public"."entries"."has_tasks" IS 'Automatically updated flag indicating if entry contains tasks';



COMMENT ON COLUMN "public"."entries"."phase_number" IS 'Phase number for entries with phase headers';



COMMENT ON COLUMN "public"."entries"."collection_id" IS 'Groups related entries together for agreements';



COMMENT ON COLUMN "public"."entries"."task_count" IS 'Automatically updated count of tasks in this entry';



COMMENT ON COLUMN "public"."entries"."media" IS 'Array of media attachments (images, videos, files) for the entry';



CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "entry_id" "uuid",
    "agreement_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "profile_id" "uuid",
    CONSTRAINT "favorites_check" CHECK (((("entry_id" IS NOT NULL) AND ("agreement_id" IS NULL)) OR (("entry_id" IS NULL) AND ("agreement_id" IS NOT NULL))))
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "response_type" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "profile_id" "uuid",
    "parent_response_id" "uuid",
    CONSTRAINT "responses_response_type_check" CHECK (("response_type" = ANY (ARRAY['moderate'::"text", 'curate'::"text", 'iterate'::"text", 'applaud'::"text"])))
);


ALTER TABLE "public"."responses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."responses"."is_anonymous" IS 'Whether this response 
  was submitted anonymously';



CREATE OR REPLACE VIEW "public"."entry_engagement" AS
 WITH "r" AS (
         SELECT "responses"."entry_id",
            ("count"(*))::integer AS "c"
           FROM "public"."responses"
          GROUP BY "responses"."entry_id"
        ), "f" AS (
         SELECT "favorites"."entry_id",
            ("count"(*))::integer AS "c"
           FROM "public"."favorites"
          GROUP BY "favorites"."entry_id"
        ), "a" AS (
         SELECT "agreements"."entry_id",
            ("count"(*))::integer AS "c"
           FROM "public"."agreements"
          GROUP BY "agreements"."entry_id"
        )
 SELECT "e"."id" AS "entry_id",
    COALESCE(0, 0) AS "view_count",
    COALESCE("r"."c", 0) AS "response_count",
    COALESCE("a"."c", 0) AS "applaud_count",
    COALESCE(0, 0) AS "share_count",
    COALESCE("f"."c", 0) AS "bookmark_count",
    ((((COALESCE(0, 0))::numeric * 0.3) + ((COALESCE("r"."c", 0))::numeric * 0.4)) + ((COALESCE("a"."c", 0))::numeric * 0.3)) AS "trending_score",
        CASE
            WHEN (COALESCE("r"."c", 0) > 0) THEN ((COALESCE("a"."c", 0))::numeric / (GREATEST(COALESCE("r"."c", 0), 1))::numeric)
            ELSE (0)::numeric
        END AS "quality_score",
    (((COALESCE(0, 0) + COALESCE("r"."c", 0)) + COALESCE("a"."c", 0)))::numeric AS "popularity_score",
    "now"() AS "last_engaged_at",
    "now"() AS "score_updated_at",
    "now"() AS "created_at",
    "now"() AS "updated_at"
   FROM ((("public"."entries" "e"
     LEFT JOIN "r" ON (("r"."entry_id" = "e"."id")))
     LEFT JOIN "f" ON (("f"."entry_id" = "e"."id")))
     LEFT JOIN "a" ON (("a"."entry_id" = "e"."id")));


ALTER VIEW "public"."entry_engagement" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entry_historical_context" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "period_slug" "text" NOT NULL,
    "period_label" "text" NOT NULL,
    "level" integer DEFAULT 0 NOT NULL,
    "start_year" integer,
    "end_year" integer,
    "confidence_score" real DEFAULT 0.5 NOT NULL,
    "context" "text",
    "extraction_method" "text" DEFAULT 'ai'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."entry_historical_context" OWNER TO "postgres";


COMMENT ON TABLE "public"."entry_historical_context" IS 'Stores historical periods and contexts extracted from entry content for Timeline-Based threadcrumbs. Enables "Oriva Pulse" - organizing entries by historical period rather than post time.';



CREATE TABLE IF NOT EXISTS "public"."entry_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_entry_id" "uuid" NOT NULL,
    "target_entry_id" "uuid" NOT NULL,
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "relation_type" character varying(50) DEFAULT 'related-to'::character varying NOT NULL,
    CONSTRAINT "entry_relations_not_self_referencing" CHECK (("source_entry_id" <> "target_entry_id"))
);


ALTER TABLE "public"."entry_relations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entry_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_entry_id" "uuid" NOT NULL,
    "target_entry_id" "uuid" NOT NULL,
    "relationship_type" "text" DEFAULT 'related'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "entry_relationships_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['related'::"text", 'blocks'::"text", 'depends'::"text", 'references'::"text"])))
);


ALTER TABLE "public"."entry_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entry_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."entry_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."entry_topics" (
    "entry_id" "uuid" NOT NULL,
    "topic_slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."entry_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "description" "text",
    "icon" character varying(50),
    "color" character varying(7),
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_event_categories_color_format" CHECK ((("color" IS NULL) OR (("color")::"text" ~ '^#[0-9A-Fa-f]{6}$'::"text"))),
    CONSTRAINT "chk_event_categories_name_length" CHECK ((("char_length"(("name")::"text") >= 1) AND ("char_length"(("name")::"text") <= 50)))
);


ALTER TABLE "public"."event_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."event_categories" IS 'Generic event categories shared across all Oriva apps';



COMMENT ON COLUMN "public"."event_categories"."name" IS 'Category name (1-50 characters, unique)';



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "organizer_id" "text" NOT NULL,
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone NOT NULL,
    "location" character varying(255),
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "is_online" boolean DEFAULT false NOT NULL,
    "max_participants" integer,
    "current_participants" integer DEFAULT 0 NOT NULL,
    "price" numeric(10,2),
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "requirements" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_events_coordinates" CHECK (((("latitude" IS NULL) AND ("longitude" IS NULL)) OR (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL) AND ("latitude" >= ('-90'::integer)::numeric) AND ("latitude" <= (90)::numeric) AND ("longitude" >= ('-180'::integer)::numeric) AND ("longitude" <= (180)::numeric)))),
    CONSTRAINT "chk_events_current_participants" CHECK (("current_participants" >= 0)),
    CONSTRAINT "chk_events_max_participants" CHECK ((("max_participants" IS NULL) OR ("max_participants" > 0))),
    CONSTRAINT "chk_events_price" CHECK ((("price" IS NULL) OR ("price" >= (0)::numeric))),
    CONSTRAINT "chk_events_time_valid" CHECK (("end_time" > "start_time")),
    CONSTRAINT "chk_events_title_length" CHECK ((("char_length"(("title")::"text") >= 1) AND ("char_length"(("title")::"text") <= 255)))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON TABLE "public"."events" IS 'Generic events table shared across all Oriva apps - core platform knows about events generically';



CREATE TABLE IF NOT EXISTS "public"."expo_push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "expo_push_token" "text" NOT NULL,
    "device_name" "text",
    "platform" character varying(20),
    "is_active" boolean DEFAULT true NOT NULL,
    "last_used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expo_push_tokens_platform_check" CHECK ((("platform")::"text" = ANY (ARRAY[('ios'::character varying)::"text", ('android'::character varying)::"text", ('web'::character varying)::"text"])))
);


ALTER TABLE "public"."expo_push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "response_id" "uuid",
    "source_type" character varying(20) NOT NULL,
    "relevance_score" double precision DEFAULT 0.0 NOT NULL,
    "feed_position" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    CONSTRAINT "feed_items_source_type_check" CHECK ((("source_type")::"text" = ANY (ARRAY[('following'::character varying)::"text", ('trending'::character varying)::"text", ('personalized'::character varying)::"text", ('collections'::character varying)::"text"])))
);


ALTER TABLE "public"."feed_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by" "uuid",
    CONSTRAINT "group_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'moderator'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_members" IS 'Membership tracking for groups with roles';



COMMENT ON COLUMN "public"."group_members"."role" IS 'Member role: admin (full control), moderator (manage content), member (participate)';



CREATE TABLE IF NOT EXISTS "public"."group_notice_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notified_at" timestamp with time zone
);


ALTER TABLE "public"."group_notice_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."group_notice_list" IS 'Stores users interested in Premium groups before payment integration (OCR-81)';



CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'personal'::"text",
    "is_private" boolean DEFAULT false,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid",
    "image_url" "text",
    "external_link" "text",
    CONSTRAINT "groups_category_check" CHECK ((("category" IS NULL) OR (("category" IS NOT NULL) AND ("char_length"(TRIM(BOTH FROM "category")) > 0))))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."groups" IS 'User-created groups for organizing discussions and content';



COMMENT ON COLUMN "public"."groups"."created_by" IS 'UUID of the user who created this group (references auth.users.id)';



COMMENT ON COLUMN "public"."groups"."image_url" IS 'Optional group image URL (OCR-82)';



COMMENT ON COLUMN "public"."groups"."external_link" IS 'Optional external link for group (e.g., website, social media) (OCR-82)';



COMMENT ON CONSTRAINT "groups_category_check" ON "public"."groups" IS 'Category must be NULL or a non-empty string. Allows free-form categories as the UI supports.';



CREATE TABLE IF NOT EXISTS "public"."groups_new" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'personal'::"text",
    "is_private" boolean DEFAULT true,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "members" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "groups_new_description_check" CHECK ((("description" IS NULL) OR ("length"("description") <= 500))),
    CONSTRAINT "groups_new_name_check" CHECK ((("length"("name") > 0) AND ("length"("name") <= 100)))
);


ALTER TABLE "public"."groups_new" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hugo_analysis_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "analysis_type" "text" NOT NULL,
    "analysis_data" "jsonb" NOT NULL,
    "processing_time" integer,
    "analysis_depth" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hugo_analysis_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hugo_apps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "app_id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "knowledge_base_ids" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "requires_subscription" boolean DEFAULT false,
    "description" "text",
    "icon_url" "text",
    "app_store_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "personality_schema_id" "uuid",
    CONSTRAINT "hugo_apps_domain_check" CHECK (("domain" = ANY (ARRAY['dating'::"text", 'career'::"text", 'health'::"text", 'finance'::"text", 'relationships'::"text", 'general'::"text"]))),
    CONSTRAINT "hugo_apps_kb_ids_check" CHECK ((("array_length"("knowledge_base_ids", 1) IS NULL) OR ("array_length"("knowledge_base_ids", 1) > 0)))
);


ALTER TABLE "public"."hugo_apps" OWNER TO "postgres";


COMMENT ON TABLE "public"."hugo_apps" IS 'Registry of Hugo coaching applications in Oriva ecosystem';



COMMENT ON COLUMN "public"."hugo_apps"."app_id" IS 'Unique app identifier (lowercase_with_underscores)';



COMMENT ON COLUMN "public"."hugo_apps"."domain" IS 'App domain: dating, career, health, finance, relationships, general';



COMMENT ON COLUMN "public"."hugo_apps"."knowledge_base_ids" IS 'Array of knowledge base IDs accessible by this app';



COMMENT ON COLUMN "public"."hugo_apps"."personality_schema_id" IS 'Reference to active personality schema';



CREATE TABLE IF NOT EXISTS "public"."hugo_collaboration_memory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app_id" "text" NOT NULL,
    "context_type" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "content_embedding" "public"."vector"(768),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "privacy_level" "text" DEFAULT 'private'::"text",
    "shared_with_core" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "hugo_collaboration_memory_privacy_level_check" CHECK (("privacy_level" = ANY (ARRAY['private'::"text", 'app_shared'::"text", 'core_shared'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."hugo_collaboration_memory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hugo_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "title" "text",
    "message_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "hugo_conversations_message_count_check" CHECK (("message_count" >= 0))
);


ALTER TABLE "public"."hugo_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."hugo_conversations" IS 'Hugo chat sessions between users and coaching apps';



COMMENT ON COLUMN "public"."hugo_conversations"."session_id" IS 'Client-generated UUID for idempotency';



COMMENT ON COLUMN "public"."hugo_conversations"."title" IS 'Auto-generated from first message';



COMMENT ON COLUMN "public"."hugo_conversations"."message_count" IS 'Cached count for performance';



CREATE TABLE IF NOT EXISTS "public"."hugo_knowledge_base" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "context" "text" NOT NULL,
    "category" "text" NOT NULL,
    "input" "jsonb" NOT NULL,
    "output" "text" NOT NULL,
    "confidence_score" double precision DEFAULT 1.0,
    "usage_count" integer DEFAULT 0,
    "success_rate" double precision DEFAULT 0.0,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "language" "text" DEFAULT 'en'::"text",
    "version" integer DEFAULT 1,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_used_at" timestamp with time zone,
    "source" "text",
    "content_embedding" "public"."vector"(768),
    CONSTRAINT "hugo_knowledge_base_confidence_score_check" CHECK ((("confidence_score" >= (0)::double precision) AND ("confidence_score" <= (1)::double precision))),
    CONSTRAINT "hugo_knowledge_base_success_rate_check" CHECK ((("success_rate" >= (0)::double precision) AND ("success_rate" <= (1)::double precision)))
);


ALTER TABLE "public"."hugo_knowledge_base" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hugo_knowledge_bases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kb_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "app_ids" "text"[] NOT NULL,
    "owner_org" "text" DEFAULT 'oriva'::"text",
    "version" "text" DEFAULT '1.0.0'::"text",
    "parent_kb_id" "text",
    "entry_count" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kb_app_ids_check" CHECK (("array_length"("app_ids", 1) > 0)),
    CONSTRAINT "kb_entry_count_check" CHECK (("entry_count" >= 0))
);


ALTER TABLE "public"."hugo_knowledge_bases" OWNER TO "postgres";


COMMENT ON TABLE "public"."hugo_knowledge_bases" IS 'Domain expertise collections (e.g., Intimacy Code)';



COMMENT ON COLUMN "public"."hugo_knowledge_bases"."kb_id" IS 'Unique knowledge base identifier (lowercase_with_underscores)';



COMMENT ON COLUMN "public"."hugo_knowledge_bases"."app_ids" IS 'Apps that can access this knowledge base';



COMMENT ON COLUMN "public"."hugo_knowledge_bases"."version" IS 'Semantic version (X.Y.Z)';



CREATE TABLE IF NOT EXISTS "public"."hugo_knowledge_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "knowledge_base_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "category" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "section_number" integer,
    "search_vector" "tsvector",
    "vector_store_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "access_count" integer DEFAULT 0,
    "last_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ke_access_count_check" CHECK (("access_count" >= 0)),
    CONSTRAINT "ke_content_check" CHECK ((("length"("title") > 0) AND ("length"("content") > 0))),
    CONSTRAINT "ke_section_number_check" CHECK ((("section_number" IS NULL) OR ("section_number" >= 0)))
);


ALTER TABLE "public"."hugo_knowledge_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."hugo_knowledge_entries" IS 'Individual knowledge items with full-text search';



COMMENT ON COLUMN "public"."hugo_knowledge_entries"."search_vector" IS 'Auto-generated tsvector for full-text search (weighted: title=A, content=B, tags=C)';



COMMENT ON COLUMN "public"."hugo_knowledge_entries"."vector_store_id" IS 'Future: reference to Pinecone/Qdrant entry';



CREATE TABLE IF NOT EXISTS "public"."hugo_learning_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "interaction_data" "jsonb" NOT NULL,
    "outcome_data" "jsonb",
    "feedback_data" "jsonb",
    "processing_time" integer,
    "model_version" "text",
    "confidence" double precision,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hugo_learning_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hugo_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "model" "text",
    "confidence_score" numeric(3,2),
    "intimacy_code_reference" "text",
    "generation_time_ms" integer,
    "tokens_used" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "messages_confidence_check" CHECK ((("confidence_score" IS NULL) OR (("confidence_score" >= 0.0) AND ("confidence_score" <= 1.0)))),
    CONSTRAINT "messages_content_check" CHECK (("length"("content") > 0)),
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."hugo_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."hugo_messages" IS 'Individual chat exchanges between users and AI coaches';



COMMENT ON COLUMN "public"."hugo_messages"."role" IS 'Message role: user or assistant';



COMMENT ON COLUMN "public"."hugo_messages"."confidence_score" IS 'AI confidence score (0.00-1.00)';



COMMENT ON COLUMN "public"."hugo_messages"."intimacy_code_reference" IS 'Referenced principle for assistant messages';



CREATE TABLE IF NOT EXISTS "public"."hugo_personality_schemas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schema_id" "text" NOT NULL,
    "version" "text" NOT NULL,
    "layer" "text" NOT NULL,
    "parent_schema_id" "uuid",
    "schema" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text",
    "rollout_percentage" integer DEFAULT 0,
    "ab_test_group" "text",
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activated_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    CONSTRAINT "ps_layer_check" CHECK (("layer" = ANY (ARRAY['base'::"text", 'overlay'::"text"]))),
    CONSTRAINT "ps_overlay_parent_check" CHECK (((("layer" = 'overlay'::"text") AND ("parent_schema_id" IS NOT NULL)) OR (("layer" = 'base'::"text") AND ("parent_schema_id" IS NULL)))),
    CONSTRAINT "ps_rollout_check" CHECK ((("rollout_percentage" >= 0) AND ("rollout_percentage" <= 100))),
    CONSTRAINT "ps_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'testing'::"text", 'active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."hugo_personality_schemas" OWNER TO "postgres";


COMMENT ON TABLE "public"."hugo_personality_schemas" IS 'Coaching personality definitions with layering support';



COMMENT ON COLUMN "public"."hugo_personality_schemas"."layer" IS 'Schema layer: base (Core HugoAI) or overlay (app-specific)';



COMMENT ON COLUMN "public"."hugo_personality_schemas"."schema" IS 'JSONB: {tone, focus, constraints, examples, voice_characteristics}';



COMMENT ON COLUMN "public"."hugo_personality_schemas"."status" IS 'Lifecycle: draft → testing → active → archived';



COMMENT ON COLUMN "public"."hugo_personality_schemas"."rollout_percentage" IS 'Gradual deployment: 0-100%';



CREATE TABLE IF NOT EXISTS "public"."hugo_user_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "insight_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "significance" "text",
    "priority" "text",
    "estimated_impact" "text",
    "evidence" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    CONSTRAINT "hugo_user_insights_estimated_impact_check" CHECK (("estimated_impact" = ANY (ARRAY['minimal'::"text", 'moderate'::"text", 'significant'::"text", 'transformative'::"text"]))),
    CONSTRAINT "hugo_user_insights_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "hugo_user_insights_significance_check" CHECK (("significance" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."hugo_user_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hugo_user_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "conversation_id" "uuid",
    "memory_type" "text" NOT NULL,
    "content" "text" NOT NULL,
    "importance" numeric(3,2) DEFAULT 0.50,
    "relevance_decay_rate" numeric(3,2) DEFAULT 0.05,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_accessed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    CONSTRAINT "um_content_check" CHECK (("length"("content") > 0)),
    CONSTRAINT "um_decay_check" CHECK ((("relevance_decay_rate" >= 0.0) AND ("relevance_decay_rate" <= 1.0))),
    CONSTRAINT "um_importance_check" CHECK ((("importance" >= 0.0) AND ("importance" <= 1.0))),
    CONSTRAINT "um_memory_type_check" CHECK (("memory_type" = ANY (ARRAY['conversation_context'::"text", 'user_preference'::"text", 'milestone'::"text", 'insight'::"text"])))
);


ALTER TABLE "public"."hugo_user_memories" OWNER TO "postgres";


COMMENT ON TABLE "public"."hugo_user_memories" IS 'User context and memory for personalized coaching';



COMMENT ON COLUMN "public"."hugo_user_memories"."memory_type" IS 'Type: conversation_context, user_preference, milestone, insight';



COMMENT ON COLUMN "public"."hugo_user_memories"."importance" IS 'Memory importance score (0.00-1.00)';



COMMENT ON COLUMN "public"."hugo_user_memories"."relevance_decay_rate" IS 'How fast importance decreases (0.00-1.00)';



CREATE TABLE IF NOT EXISTS "public"."hugo_user_profiles" (
    "user_id" "uuid" NOT NULL,
    "life_goals" "jsonb" DEFAULT '[]'::"jsonb",
    "fears" "jsonb" DEFAULT '[]'::"jsonb",
    "skill_set" "jsonb" DEFAULT '[]'::"jsonb",
    "core_values" "jsonb" DEFAULT '[]'::"jsonb",
    "life_lessons" "jsonb" DEFAULT '[]'::"jsonb",
    "lifestyle_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "cognitive_profile" "jsonb" DEFAULT '{}'::"jsonb",
    "data_sharing_consent" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."hugo_user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hugo_user_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "metrics" "jsonb" NOT NULL,
    "milestones" "jsonb" DEFAULT '[]'::"jsonb",
    "progress_percentage" double precision,
    "growth_rate" double precision,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "progress_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "milestones_reached" "text"[] DEFAULT '{}'::"text"[],
    "current_focus_area" "text",
    "total_conversations" integer DEFAULT 0,
    "total_messages" integer DEFAULT 0,
    CONSTRAINT "up_conversations_check" CHECK (("total_conversations" >= 0)),
    CONSTRAINT "up_messages_check" CHECK (("total_messages" >= 0))
);


ALTER TABLE "public"."hugo_user_progress" OWNER TO "postgres";


COMMENT ON TABLE "public"."hugo_user_progress" IS 'User learning progress tracking per app';



COMMENT ON COLUMN "public"."hugo_user_progress"."progress_data" IS 'JSONB: {principles_learned, skill_levels, current_focus}';



COMMENT ON COLUMN "public"."hugo_user_progress"."milestones_reached" IS 'Array of milestone identifiers';



COMMENT ON COLUMN "public"."hugo_user_progress"."total_conversations" IS 'Cached conversation count';



CREATE TABLE IF NOT EXISTS "public"."markdown_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "oriva_id" "uuid" NOT NULL,
    "path" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "is_private" boolean DEFAULT false,
    "content" "text",
    "content_hash" "text",
    "sync_status" character varying(20) DEFAULT 'synced'::character varying,
    "last_local_modified" timestamp with time zone,
    "last_cloud_modified" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "markdown_files_sync_status_check" CHECK ((("sync_status")::"text" = ANY (ARRAY[('synced'::character varying)::"text", ('pending'::character varying)::"text", ('conflict'::character varying)::"text", ('error'::character varying)::"text"])))
);


ALTER TABLE "public"."markdown_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."markdown_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid",
    "entry_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "heading_level" integer DEFAULT 1,
    "order_index" integer NOT NULL,
    "parent_section_id" "uuid",
    "response_count" integer DEFAULT 0,
    "last_response_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "markdown_sections_heading_level_check" CHECK ((("heading_level" >= 1) AND ("heading_level" <= 6)))
);


ALTER TABLE "public"."markdown_sections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_apps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "tagline" character varying(255),
    "description" "text",
    "category" character varying(50),
    "developer_id" "uuid" NOT NULL,
    "developer_name" character varying(255),
    "version" character varying(50),
    "webhook_url" character varying(500),
    "oauth_redirect_uri" character varying(500),
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "icon_url" character varying(500),
    "screenshots" "jsonb" DEFAULT '[]'::"jsonb",
    "pricing_model" character varying(20) DEFAULT 'free'::character varying,
    "pricing_config" "jsonb" DEFAULT '{}'::"jsonb",
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "review_notes" "text",
    "install_count" integer DEFAULT 0,
    "rating_average" numeric(3,2),
    "rating_count" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "valid_pricing_model" CHECK ((("pricing_model")::"text" = ANY (ARRAY[('free'::character varying)::"text", ('freemium'::character varying)::"text", ('paid'::character varying)::"text", ('subscription'::character varying)::"text"]))),
    CONSTRAINT "valid_rating" CHECK ((("rating_average" IS NULL) OR (("rating_average" >= (0)::numeric) AND ("rating_average" <= (5)::numeric)))),
    CONSTRAINT "valid_status" CHECK ((("status")::"text" = ANY (ARRAY[('draft'::character varying)::"text", ('review'::character varying)::"text", ('approved'::character varying)::"text", ('rejected'::character varying)::"text", ('suspended'::character varying)::"text"])))
);


ALTER TABLE "public"."marketplace_apps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mention_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "mentioned_user_id" "uuid" NOT NULL,
    "mentioning_user_id" "uuid" NOT NULL,
    "mention_position" integer,
    "notification_sent" boolean DEFAULT false NOT NULL,
    "notification_sent_at" timestamp with time zone,
    "notification_read" boolean DEFAULT false NOT NULL,
    "notification_read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mention_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mentions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "mentioned_user_id" "uuid" NOT NULL,
    "mentioner_user_id" "uuid",
    "position_start" integer NOT NULL,
    "position_end" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_counters" (
    "user_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "opportunity_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "notification_counters_opportunity_count_check" CHECK ((("opportunity_count" >= 0) AND ("opportunity_count" <= 3)))
);


ALTER TABLE "public"."notification_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(20) NOT NULL,
    "session_id" "uuid" NOT NULL,
    "session_time" timestamp with time zone NOT NULL,
    "session_title" "text",
    "participant_name" "text",
    "participant_avatar_url" "text",
    "chemistry_score" integer,
    "group_id" "uuid",
    "group_name" "text",
    "status" character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "expo_push_token" "text",
    "push_receipt_id" "text",
    "push_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "check_opportunity_context" CHECK ((((("type")::"text" = 'reminder'::"text") AND ("chemistry_score" IS NULL) AND ("group_id" IS NULL)) OR ((("type")::"text" = 'opportunity'::"text") AND (("chemistry_score" IS NOT NULL) OR ("group_id" IS NOT NULL))))),
    CONSTRAINT "notifications_chemistry_score_check" CHECK ((("chemistry_score" IS NULL) OR (("chemistry_score" >= 0) AND ("chemistry_score" <= 100)))),
    CONSTRAINT "notifications_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('sent'::character varying)::"text", ('delivered'::character varying)::"text", ('dismissed'::character varying)::"text", ('failed'::character varying)::"text"]))),
    CONSTRAINT "notifications_type_check" CHECK ((("type")::"text" = ANY (ARRAY[('reminder'::character varying)::"text", ('opportunity'::character varying)::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."notification_delivery_metrics" AS
 SELECT "date"("sent_at") AS "delivery_date",
    "type",
    "count"(*) AS "total_sent",
    "count"("delivered_at") AS "total_delivered",
    "round"(((("count"("delivered_at"))::numeric / (NULLIF("count"(*), 0))::numeric) * (100)::numeric), 2) AS "delivery_rate",
    "round"("avg"(EXTRACT(epoch FROM ("delivered_at" - "scheduled_at"))), 2) AS "avg_delivery_seconds",
    "percentile_cont"((0.95)::double precision) WITHIN GROUP (ORDER BY ((EXTRACT(epoch FROM ("delivered_at" - "scheduled_at")))::double precision)) AS "p95_delivery_seconds"
   FROM "public"."notifications"
  WHERE ("sent_at" IS NOT NULL)
  GROUP BY ("date"("sent_at")), "type"
  ORDER BY ("date"("sent_at")) DESC, "type";


ALTER VIEW "public"."notification_delivery_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "reminders_enabled" boolean DEFAULT true NOT NULL,
    "opportunities_enabled" boolean DEFAULT true NOT NULL,
    "quiet_hours_enabled" boolean DEFAULT false NOT NULL,
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_state" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'unread'::"text" NOT NULL,
    "sent_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "dismissed_from" "text",
    "click_action" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_state_status_check" CHECK (("status" = ANY (ARRAY['unread'::"text", 'read'::"text", 'dismissed'::"text", 'clicked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."notification_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."notification_state" IS 'Per-user mutable state for notifications';



COMMENT ON COLUMN "public"."notification_state"."status" IS 'Current state: unread, read, dismissed, clicked, expired';



COMMENT ON COLUMN "public"."notification_state"."dismissed_from" IS 'Source of dismissal (app_id or oriva_core)';



CREATE TABLE IF NOT EXISTS "public"."notification_sync_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "sync_status" character varying(20) NOT NULL,
    "attempt_number" integer DEFAULT 1 NOT NULL,
    "error_message" "text",
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_sync_log_attempt_number_check" CHECK ((("attempt_number" >= 1) AND ("attempt_number" <= 3))),
    CONSTRAINT "notification_sync_log_sync_status_check" CHECK ((("sync_status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('success'::character varying)::"text", ('failed'::character varying)::"text", ('retrying'::character varying)::"text"])))
);


ALTER TABLE "public"."notification_sync_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_access_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" character varying(255) NOT NULL,
    "app_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scopes" "jsonb" DEFAULT '[]'::"jsonb",
    "expires_at" timestamp without time zone NOT NULL,
    "revoked_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "expires_in_future" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."oauth_access_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_authorization_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(255) NOT NULL,
    "app_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scopes" "jsonb" DEFAULT '[]'::"jsonb",
    "redirect_uri" character varying(500),
    "expires_at" timestamp without time zone NOT NULL,
    "used_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "expires_in_future" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."oauth_authorization_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "app_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_category" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_events_entity_id_check" CHECK (("length"("entity_id") > 0)),
    CONSTRAINT "platform_events_event_category_check" CHECK (("event_category" = ANY (ARRAY['notification'::"text", 'user'::"text", 'session'::"text", 'transaction'::"text"]))),
    CONSTRAINT "platform_events_event_type_check" CHECK (("event_type" ~ '^[a-z_]+$'::"text"))
);


ALTER TABLE "public"."platform_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_events" IS 'Generic event log for all platform events';



COMMENT ON COLUMN "public"."platform_events"."event_category" IS 'High-level grouping: notification, user, session, transaction';



COMMENT ON COLUMN "public"."platform_events"."event_type" IS 'Specific action (lowercase with underscores)';



COMMENT ON COLUMN "public"."platform_events"."entity_type" IS 'Type of affected entity';



COMMENT ON COLUMN "public"."platform_events"."entity_id" IS 'ID of affected entity';



COMMENT ON COLUMN "public"."platform_events"."event_data" IS 'Flexible JSONB payload for event details';



CREATE TABLE IF NOT EXISTS "public"."platform_notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "app_id" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "action_url" "text",
    "action_label" "text",
    "image_url" "text",
    "icon_url" "text",
    "context_data" "jsonb" DEFAULT '{}'::"jsonb",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "platform_notifications_action_label_check" CHECK ((("action_label" IS NULL) OR ("length"("action_label") <= 50))),
    CONSTRAINT "platform_notifications_body_check" CHECK ((("length"("body") >= 1) AND ("length"("body") <= 1000))),
    CONSTRAINT "platform_notifications_check" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "created_at"))),
    CONSTRAINT "platform_notifications_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "platform_notifications_title_check" CHECK ((("length"("title") >= 1) AND ("length"("title") <= 200)))
);


ALTER TABLE "public"."platform_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_notifications" IS 'Notification content from third-party apps (immutable)';



COMMENT ON COLUMN "public"."platform_notifications"."external_id" IS 'App-specific notification identifier';



COMMENT ON COLUMN "public"."platform_notifications"."title" IS 'Notification title (1-200 chars)';



COMMENT ON COLUMN "public"."platform_notifications"."body" IS 'Notification body (1-1000 chars)';



COMMENT ON COLUMN "public"."platform_notifications"."priority" IS 'Display priority: low, normal, high, urgent';



CREATE TABLE IF NOT EXISTS "public"."plugin_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plugin_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plugin_executions_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "app_id" "uuid",
    "session_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "status" "text" DEFAULT 'running'::"text",
    "error_message" "text",
    "execution_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "plugin_executions_log_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."plugin_executions_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plugin_installs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plugin_id" "uuid" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "installed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."plugin_installs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plugin_marketplace_apps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "developer_id" "uuid" NOT NULL,
    "developer_name" "text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text",
    "tagline" "text",
    "description" "text" NOT NULL,
    "version" "text" DEFAULT '1.0.0'::"text" NOT NULL,
    "category" "text" DEFAULT 'productivity'::"text" NOT NULL,
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "repository_url" "text",
    "homepage" "text",
    "support_email" "text" NOT NULL,
    "permissions" "text"[] DEFAULT ARRAY[]::"text"[] NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "submitted_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewer_notes" "text",
    "is_active" boolean DEFAULT false NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "featured_order" integer DEFAULT 0,
    "icon_url" "text",
    "screenshots" "text"[] DEFAULT ARRAY[]::"text"[],
    "pricing_model" "text" DEFAULT 'free'::"text",
    "pricing_config" "jsonb" DEFAULT '{}'::"jsonb",
    "install_count" integer DEFAULT 0 NOT NULL,
    "rating_average" numeric(3,2) DEFAULT 0.0,
    "rating_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "execution_url" "text",
    "hosting_type" "text" DEFAULT 'external'::"text",
    "display_config" "jsonb" DEFAULT '{"min_width": 400, "min_height": 300, "responsive": true, "preferred_mode": "fullscreen", "supports_panel": true, "supports_fullscreen": true}'::"jsonb",
    "iframe_options" "jsonb" DEFAULT '{"custom_sandbox": ["allow-scripts", "allow-same-origin", "allow-forms", "allow-popups", "allow-modals", "allow-pointer-lock", "allow-top-navigation-by-user-activation"], "allow_frame_ancestors": true, "bypass_xframe_protection": false}'::"jsonb",
    "sandbox_config" "jsonb" DEFAULT '{"maxMemoryMB": 500, "allowStorage": false, "allowLocation": false, "allowedDomains": [], "allowNetworking": false, "maxExecutionTime": 300000}'::"jsonb",
    CONSTRAINT "plugin_marketplace_apps_hosting_type_check" CHECK (("hosting_type" = ANY (ARRAY['external'::"text", 'oriva_hosted'::"text"]))),
    CONSTRAINT "plugin_marketplace_apps_name_check" CHECK ((("length"("name") >= 1) AND ("length"("name") <= 100))),
    CONSTRAINT "plugin_marketplace_apps_pricing_model_check" CHECK (("pricing_model" = ANY (ARRAY['free'::"text", 'paid'::"text", 'freemium'::"text", 'subscription'::"text"]))),
    CONSTRAINT "plugin_marketplace_apps_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."plugin_marketplace_apps" OWNER TO "postgres";


COMMENT ON COLUMN "public"."plugin_marketplace_apps"."execution_url" IS 'URL for executing/launching the app in a sandboxed environment';



COMMENT ON COLUMN "public"."plugin_marketplace_apps"."hosting_type" IS 'Hosting model: external (developer hosts) or oriva_hosted (Oriva hosts)';



COMMENT ON COLUMN "public"."plugin_marketplace_apps"."display_config" IS 'App display configuration for launcher (preferred_mode, supports_panel, supports_fullscreen, min_width, min_height, responsive)';



COMMENT ON COLUMN "public"."plugin_marketplace_apps"."iframe_options" IS 'Iframe embedding options (allow_frame_ancestors, custom_sandbox, bypass_xframe_protection)';



COMMENT ON COLUMN "public"."plugin_marketplace_apps"."sandbox_config" IS 'Security and resource limit configuration (allowedDomains, allowStorage, allowNetworking, allowLocation, maxMemoryMB, maxExecutionTime)';



CREATE TABLE IF NOT EXISTS "public"."plugin_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plugin_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "review_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plugin_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."plugin_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plugin_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plugin_id" "uuid" NOT NULL,
    "version" "text" NOT NULL,
    "manifest" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "assets_url" "text",
    "changelog" "text",
    "approved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" character varying(50) DEFAULT 'approved'::character varying
);


ALTER TABLE "public"."plugin_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plugins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "category_id" "uuid",
    "developer_id" "uuid" NOT NULL,
    "latest_version" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    CONSTRAINT "plugins_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'approved'::"text", 'suspended'::"text", 'deprecated'::"text"])))
);


ALTER TABLE "public"."plugins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."profile_memberships" OWNER TO "postgres";


COMMENT ON TABLE "public"."profile_memberships" IS 'Associates profiles with groups/audiences';



CREATE TABLE IF NOT EXISTS "public"."profile_social_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "platform" "text" NOT NULL,
    "label" "text",
    "url" "text" NOT NULL,
    "display_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "label_length" CHECK (("char_length"("label") <= 50)),
    CONSTRAINT "valid_platform" CHECK (("platform" = ANY (ARRAY['twitter'::"text", 'linkedin'::"text", 'github'::"text", 'instagram'::"text", 'youtube'::"text", 'tiktok'::"text", 'website'::"text", 'custom'::"text"]))),
    CONSTRAINT "valid_url" CHECK (("url" ~ '^https?://'::"text"))
);


ALTER TABLE "public"."profile_social_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "username" "text",
    "display_name" "text" NOT NULL,
    "bio" "text",
    "location" "text",
    "website_url" "text",
    "avatar_url" "text",
    "is_default" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_anonymous" boolean DEFAULT false,
    "profileurl" "text",
    "profile_about" "text",
    CONSTRAINT "bio_length" CHECK (("char_length"("bio") <= 500)),
    CONSTRAINT "display_name_length" CHECK ((("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 50))),
    CONSTRAINT "location_length" CHECK (("char_length"("location") <= 100)),
    CONSTRAINT "profile_about_length" CHECK ((("profile_about" IS NULL) OR ("char_length"("profile_about") <= 10000))),
    CONSTRAINT "profileurl_format" CHECK ((("profileurl" IS NULL) OR ("profileurl" ~ '^[a-z0-9_]+$'::"text"))),
    CONSTRAINT "profileurl_length" CHECK ((("profileurl" IS NULL) OR (("char_length"("profileurl") >= 3) AND ("char_length"("profileurl") <= 30)))),
    CONSTRAINT "username_format" CHECK (("username" ~ '^[a-zA-Z0-9_]+$'::"text")),
    CONSTRAINT "username_length" CHECK ((("char_length"("username") >= 3) AND ("char_length"("username") <= 30)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'User profiles table with proper RLS policies for social features';



COMMENT ON COLUMN "public"."profiles"."is_default" IS 'Each account must have exactly one default profile';



COMMENT ON COLUMN "public"."profiles"."is_active" IS 'Soft delete - inactive profiles are hidden but data preserved';



COMMENT ON COLUMN "public"."profiles"."profileurl" IS 'Custom URL name for profile (e.g., oriva.io/profileurl). Must be unique, lowercase, alphanumeric with underscores only, 3-30 characters.';



COMMENT ON COLUMN "public"."profiles"."profile_about" IS 'Full-screen document editor content for profile About tab. Separate from bio field which is used for short intro text. Maximum 10,000 characters.';



CREATE TABLE IF NOT EXISTS "public"."response_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid",
    "user_id" "uuid",
    "interaction_type" character varying(20) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "response_interactions_interaction_type_check" CHECK ((("interaction_type")::"text" = ANY (ARRAY[('applaud'::character varying)::"text", ('bookmark'::character varying)::"text", ('report'::character varying)::"text", ('view'::character varying)::"text"])))
);


ALTER TABLE "public"."response_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."response_votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "response_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vote_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "response_votes_vote_type_check" CHECK (("vote_type" = ANY (ARRAY['upvote'::"text", 'downvote'::"text"])))
);


ALTER TABLE "public"."response_votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."section_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section_entry_id" "uuid",
    "user_id" "uuid",
    "type" character varying(20) NOT NULL,
    "content" "text" NOT NULL,
    "parent_response_id" "uuid",
    "thread_depth" integer DEFAULT 0,
    "thread_path" "text"[],
    "reply_count" integer DEFAULT 0,
    "applaud_count" integer DEFAULT 0,
    "curation_count" integer DEFAULT 0,
    "view_count" integer DEFAULT 0,
    "relevance_score" double precision DEFAULT 0.0,
    "traction_score" double precision DEFAULT 0.0,
    "quality_score" double precision DEFAULT 0.0,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_pinned" boolean DEFAULT false,
    "is_resolved" boolean DEFAULT false,
    "resolved_by_user_id" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "section_responses_quality_score_check" CHECK ((("quality_score" >= (0)::double precision) AND ("quality_score" <= (1)::double precision))),
    CONSTRAINT "section_responses_relevance_score_check" CHECK ((("relevance_score" >= (0)::double precision) AND ("relevance_score" <= (1)::double precision))),
    CONSTRAINT "section_responses_traction_score_check" CHECK ((("traction_score" >= (0)::double precision) AND ("traction_score" <= (1)::double precision))),
    CONSTRAINT "section_responses_type_check" CHECK ((("type")::"text" = ANY (ARRAY[('moderate'::character varying)::"text", ('iterate'::character varying)::"text", ('curate'::character varying)::"text", ('applaud'::character varying)::"text"])))
);


ALTER TABLE "public"."section_responses" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."sync_failures" AS
 SELECT "nsl"."id" AS "sync_log_id",
    "nsl"."notification_id",
    "n"."user_id",
    "n"."type",
    "nsl"."attempt_number",
    "nsl"."error_message",
    "nsl"."created_at"
   FROM ("public"."notification_sync_log" "nsl"
     JOIN "public"."notifications" "n" ON (("nsl"."notification_id" = "n"."id")))
  WHERE (("nsl"."sync_status")::"text" = 'failed'::"text")
  ORDER BY "nsl"."created_at" DESC;


ALTER VIEW "public"."sync_failures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "file_id" "uuid",
    "operation_type" character varying(20) NOT NULL,
    "status" character varying(20) NOT NULL,
    "details" "jsonb",
    "error_message" "text",
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sync_logs_operation_type_check" CHECK ((("operation_type")::"text" = ANY (ARRAY[('upload'::character varying)::"text", ('download'::character varying)::"text", ('conflict'::character varying)::"text", ('resolve'::character varying)::"text", ('delete'::character varying)::"text"]))),
    CONSTRAINT "sync_logs_status_check" CHECK ((("status")::"text" = ANY (ARRAY[('success'::character varying)::"text", ('error'::character varying)::"text", ('partial'::character varying)::"text"])))
);


ALTER TABLE "public"."sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "usage_count" integer DEFAULT 0,
    "is_system_tag" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "assignee_id" "uuid",
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" timestamp with time zone,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telescope_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "collection_id" "uuid",
    "focus_entry_id" "uuid",
    "zoom_level" integer DEFAULT 0,
    "scroll_position" integer DEFAULT 0,
    "view_mode" "text" DEFAULT 'standard'::"text",
    "navigation_path" "jsonb" DEFAULT '[]'::"jsonb",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "entries_viewed" integer DEFAULT 0,
    "session_duration" integer DEFAULT 0,
    "last_viewed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "telescope_sessions_view_mode_check" CHECK (("view_mode" = ANY (ARRAY['standard'::"text", 'compact'::"text", 'focus'::"text"])))
);


ALTER TABLE "public"."telescope_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "content" "jsonb" NOT NULL,
    "is_public" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "profile_id" "uuid"
);


ALTER TABLE "public"."templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_app_installs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "app_id" "uuid" NOT NULL,
    "installed_at" timestamp without time zone DEFAULT "now"(),
    "last_used_at" timestamp without time zone,
    "permissions_granted" "jsonb" DEFAULT '[]'::"jsonb",
    "subscription_status" character varying(20),
    "subscription_expires_at" timestamp without time zone,
    "is_active" boolean DEFAULT true NOT NULL,
    "app_settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "valid_subscription_status" CHECK ((("subscription_status" IS NULL) OR (("subscription_status")::"text" = ANY (ARRAY[('active'::character varying)::"text", ('cancelled'::character varying)::"text", ('expired'::character varying)::"text"]))))
);


ALTER TABLE "public"."user_app_installs" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_app_installs" IS 'Tracks which marketplace apps users have installed';



CREATE TABLE IF NOT EXISTS "public"."user_contexts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "context" "text" NOT NULL,
    "bio" "text",
    "traits" "jsonb" DEFAULT '{}'::"jsonb",
    "score" integer DEFAULT 0,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_contexts_score_check" CHECK ((("score" >= 0) AND ("score" <= 100)))
);


ALTER TABLE "public"."user_contexts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_context_summary" AS
 SELECT "uc"."user_id",
    "uc"."context",
    "uc"."bio",
    "uc"."score",
    "uc"."is_active",
    "uc"."created_at",
    "count"("ci"."id") AS "interaction_count",
    "max"("ci"."created_at") AS "last_interaction_at"
   FROM ("public"."user_contexts" "uc"
     LEFT JOIN "public"."context_interactions" "ci" ON ((("uc"."user_id" = "ci"."user_id") AND ("uc"."context" = "ci"."context"))))
  GROUP BY "uc"."user_id", "uc"."context", "uc"."bio", "uc"."score", "uc"."is_active", "uc"."created_at";


ALTER VIEW "public"."user_context_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_filter_presets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "scope" "text" DEFAULT 'global'::"text" NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "facets" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "ranking" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_filter_presets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_personalization_cache" (
    "user_id" "uuid" NOT NULL,
    "cached_preferences" "jsonb" NOT NULL,
    "cached_topic_weights" "jsonb" NOT NULL,
    "cache_version" integer DEFAULT 1,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_personalization_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_personalization_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "personalization_enabled" boolean DEFAULT true,
    "learning_mode" "text" DEFAULT 'balanced'::"text",
    "privacy_mode" "text" DEFAULT 'normal'::"text",
    "discoverability_mode" "text" DEFAULT 'balanced'::"text",
    "novelty_weight" numeric(3,2) DEFAULT 0.3,
    "quality_threshold" numeric(3,2) DEFAULT 0.6,
    "diversity_factor" numeric(3,2) DEFAULT 0.5,
    "default_time_window" "text" DEFAULT 'week'::"text",
    "semantic_search_enabled" boolean DEFAULT true,
    "hybrid_search_weight" numeric(3,2) DEFAULT 0.7,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_personalization_preferences_default_time_window_check" CHECK (("default_time_window" = ANY (ARRAY['day'::"text", 'week'::"text", 'month'::"text", 'all'::"text"]))),
    CONSTRAINT "user_personalization_preferences_discoverability_mode_check" CHECK (("discoverability_mode" = ANY (ARRAY['focused'::"text", 'balanced'::"text", 'exploratory'::"text"]))),
    CONSTRAINT "user_personalization_preferences_diversity_factor_check" CHECK ((("diversity_factor" >= (0)::numeric) AND ("diversity_factor" <= (1)::numeric))),
    CONSTRAINT "user_personalization_preferences_hybrid_search_weight_check" CHECK ((("hybrid_search_weight" >= (0)::numeric) AND ("hybrid_search_weight" <= (1)::numeric))),
    CONSTRAINT "user_personalization_preferences_learning_mode_check" CHECK (("learning_mode" = ANY (ARRAY['aggressive'::"text", 'balanced'::"text", 'conservative'::"text"]))),
    CONSTRAINT "user_personalization_preferences_novelty_weight_check" CHECK ((("novelty_weight" >= (0)::numeric) AND ("novelty_weight" <= (1)::numeric))),
    CONSTRAINT "user_personalization_preferences_privacy_mode_check" CHECK (("privacy_mode" = ANY (ARRAY['strict'::"text", 'normal'::"text", 'open'::"text"]))),
    CONSTRAINT "user_personalization_preferences_quality_threshold_check" CHECK ((("quality_threshold" >= (0)::numeric) AND ("quality_threshold" <= (1)::numeric)))
);


ALTER TABLE "public"."user_personalization_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "display_name" "text",
    "bio" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "status" character varying(50) DEFAULT 'registered'::character varying NOT NULL,
    "registered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cancelled_at" timestamp with time zone,
    "attended_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_user_registrations_status" CHECK ((("status")::"text" = ANY ((ARRAY['registered'::character varying, 'cancelled'::character varying, 'attended'::character varying])::"text"[])))
);


ALTER TABLE "public"."user_registrations" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_registrations" IS 'Generic user event registrations shared across all Oriva apps';



CREATE TABLE IF NOT EXISTS "public"."user_topic_engagements" (
    "user_id" "uuid" NOT NULL,
    "topic_id" "uuid" NOT NULL,
    "topic_slug" "text" NOT NULL,
    "topic_label" "text" NOT NULL,
    "score" numeric DEFAULT 0 NOT NULL,
    "publish_count" integer DEFAULT 0 NOT NULL,
    "response_count" integer DEFAULT 0 NOT NULL,
    "applaud_count" integer DEFAULT 0 NOT NULL,
    "last_engaged_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_topic_engagements" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_topic_engagements" IS 'Tracks user engagement with topics based on publishing, responding, and applauding';



CREATE TABLE IF NOT EXISTS "public"."user_topic_intensities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "topic_slug" "text" NOT NULL,
    "topic_label" "text" NOT NULL,
    "manual_intensity" numeric(3,2) DEFAULT 0.5,
    "learned_intensity" numeric(3,2) DEFAULT 0.5,
    "combined_intensity" numeric(3,2) GENERATED ALWAYS AS (
CASE
    WHEN ("manual_intensity" > (0)::numeric) THEN (("manual_intensity" * 0.7) + ("learned_intensity" * 0.3))
    ELSE "learned_intensity"
END) STORED,
    "confidence_score" numeric(3,2) DEFAULT 0.5,
    "adjustment_source" "text" DEFAULT 'learned'::"text",
    "last_manual_adjustment" timestamp with time zone,
    "learning_sample_size" integer DEFAULT 0,
    "positive_signals" integer DEFAULT 0,
    "negative_signals" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_topic_intensities_adjustment_source_check" CHECK (("adjustment_source" = ANY (ARRAY['manual'::"text", 'learned'::"text", 'hybrid'::"text"]))),
    CONSTRAINT "user_topic_intensities_confidence_score_check" CHECK ((("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric))),
    CONSTRAINT "user_topic_intensities_learned_intensity_check" CHECK ((("learned_intensity" >= (0)::numeric) AND ("learned_intensity" <= (1)::numeric))),
    CONSTRAINT "user_topic_intensities_learning_sample_size_check" CHECK (("learning_sample_size" >= 0)),
    CONSTRAINT "user_topic_intensities_manual_intensity_check" CHECK ((("manual_intensity" >= (0)::numeric) AND ("manual_intensity" <= (1)::numeric))),
    CONSTRAINT "user_topic_intensities_negative_signals_check" CHECK (("negative_signals" >= 0)),
    CONSTRAINT "user_topic_intensities_positive_signals_check" CHECK (("positive_signals" >= 0))
);


ALTER TABLE "public"."user_topic_intensities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "display_name" "text",
    "username" "text",
    "bio" "text",
    "avatar" "text",
    "followers_count" integer DEFAULT 0,
    "following_count" integer DEFAULT 0,
    "entries_count" integer DEFAULT 0,
    "developer_mode" boolean DEFAULT false,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."is_active" IS 'Whether user account is active. Inactive users cannot receive mention notifications (FR-017).';



CREATE TABLE IF NOT EXISTS "public"."webhook_delivery_log" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "webhook_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status_code" integer,
    "response_body" "text",
    "response_headers" "jsonb",
    "delivery_attempt" integer NOT NULL,
    "delivered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "response_time_ms" integer,
    "success" boolean NOT NULL,
    "error_message" "text",
    CONSTRAINT "webhook_delivery_log_delivery_attempt_check" CHECK ((("delivery_attempt" >= 1) AND ("delivery_attempt" <= 10))),
    CONSTRAINT "webhook_delivery_log_status_code_check" CHECK ((("status_code" IS NULL) OR (("status_code" >= 100) AND ("status_code" <= 599))))
);


ALTER TABLE "public"."webhook_delivery_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."webhook_delivery_log" IS 'Audit trail for webhook delivery attempts';



COMMENT ON COLUMN "public"."webhook_delivery_log"."delivery_attempt" IS 'Attempt number (1-based, max 5)';



COMMENT ON COLUMN "public"."webhook_delivery_log"."success" IS 'True if status_code 200-299';



CREATE TABLE IF NOT EXISTS "work_buddy"."availability_slots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "days" "text"[] NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "status" "text" NOT NULL,
    "is_recurring" boolean DEFAULT false,
    "recurring_pattern" "text",
    "session_duration" "text" NOT NULL,
    "max_participants" integer DEFAULT 3,
    "group_restrictions" "text"[] DEFAULT '{}'::"text"[],
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "monthly_type" "text" DEFAULT 'date'::"text",
    "monthly_value" integer DEFAULT 1,
    "work_type" "text" DEFAULT 'desk'::"text" NOT NULL,
    CONSTRAINT "availability_slots_monthly_type_check" CHECK (("monthly_type" = ANY (ARRAY['date'::"text", 'weekday'::"text"]))),
    CONSTRAINT "availability_slots_monthly_value_check" CHECK ((("monthly_value" >= 1) AND ("monthly_value" <= 31))),
    CONSTRAINT "availability_slots_recurring_pattern_check" CHECK (("recurring_pattern" = ANY (ARRAY['weekly'::"text", 'bi-weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "availability_slots_session_duration_check" CHECK (("session_duration" = ANY (ARRAY['25'::"text", '45'::"text", '60'::"text", '90'::"text", '120'::"text"]))),
    CONSTRAINT "availability_slots_status_check" CHECK (("status" = ANY (ARRAY['free'::"text", 'limited'::"text", 'unavailable'::"text"]))),
    CONSTRAINT "availability_slots_work_type_check" CHECK (("work_type" = ANY (ARRAY['desk'::"text", 'moving'::"text", 'anything'::"text"])))
);


ALTER TABLE "work_buddy"."availability_slots" OWNER TO "postgres";


COMMENT ON TABLE "work_buddy"."availability_slots" IS 'User availability slots for appointment scheduling in Work Buddy';



COMMENT ON COLUMN "work_buddy"."availability_slots"."work_type" IS 'Type of work for
   this availability slot: desk (sitting), moving (walking), or 
  anything (flexible)';



CREATE TABLE IF NOT EXISTS "work_buddy"."calendar_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "provider" character varying(50) NOT NULL,
    "provider_account_id" "text" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "calendar_id" "text" NOT NULL,
    "calendar_name" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "last_sync_at" timestamp with time zone,
    "sync_errors" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_calendar_connections_provider" CHECK ((("provider")::"text" = ANY ((ARRAY['google'::character varying, 'apple'::character varying, 'outlook'::character varying, 'ical'::character varying])::"text"[])))
);


ALTER TABLE "work_buddy"."calendar_connections" OWNER TO "postgres";


COMMENT ON TABLE "work_buddy"."calendar_connections" IS 'Calendar integration connections for Work Buddy users';



COMMENT ON COLUMN "work_buddy"."calendar_connections"."provider" IS 'Calendar provider: google, apple, outlook, or ical';



COMMENT ON COLUMN "work_buddy"."calendar_connections"."calendar_id" IS 'Provider-specific calendar identifier';



CREATE TABLE IF NOT EXISTS "work_buddy"."chemistry_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rater_user_id" "text" NOT NULL,
    "rated_user_id" "text" NOT NULL,
    "rating" integer NOT NULL,
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chemistry_ratings_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "work_buddy"."chemistry_ratings" OWNER TO "postgres";


COMMENT ON TABLE "work_buddy"."chemistry_ratings" IS 'Chemistry Kit ratings between users - supports Work Buddy widget functionality';



CREATE TABLE IF NOT EXISTS "work_buddy"."session_metadata" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "oriva_session_id" "text" NOT NULL,
    "work_type" "text" NOT NULL,
    "focus_level" integer DEFAULT 5,
    "productivity_notes" "text",
    "effectiveness_rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "session_metadata_effectiveness_rating_check" CHECK ((("effectiveness_rating" >= 1) AND ("effectiveness_rating" <= 5))),
    CONSTRAINT "session_metadata_focus_level_check" CHECK ((("focus_level" >= 1) AND ("focus_level" <= 10))),
    CONSTRAINT "session_metadata_work_type_check" CHECK (("work_type" = ANY (ARRAY['desk'::"text", 'moving'::"text", 'anything'::"text"])))
);


ALTER TABLE "work_buddy"."session_metadata" OWNER TO "postgres";


COMMENT ON TABLE "work_buddy"."session_metadata" IS 'Metadata for Work Buddy sessions linked to Oriva session IDs';



CREATE TABLE IF NOT EXISTS "work_buddy"."session_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "profile_id" "text" NOT NULL,
    "user_id" "text",
    "is_suggestor" boolean DEFAULT false,
    "role" "text" DEFAULT 'participant'::"text",
    "status" "text" DEFAULT 'joined'::"text",
    "work_description" "text",
    "display_name" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work_buddy"."session_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work_buddy"."user_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "session_id" "text" NOT NULL,
    "focus_time_minutes" integer NOT NULL,
    "productivity_score" integer NOT NULL,
    "session_rating" integer NOT NULL,
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_analytics_productivity_score_check" CHECK ((("productivity_score" >= 1) AND ("productivity_score" <= 10))),
    CONSTRAINT "user_analytics_session_rating_check" CHECK ((("session_rating" >= 1) AND ("session_rating" <= 5)))
);


ALTER TABLE "work_buddy"."user_analytics" OWNER TO "postgres";


COMMENT ON TABLE "work_buddy"."user_analytics" IS 'User productivity analytics and session ratings';



CREATE TABLE IF NOT EXISTS "work_buddy"."work_appointments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "host_user_id" "text" NOT NULL,
    "participants" "jsonb" DEFAULT '[]'::"jsonb",
    "title" "text" NOT NULL,
    "description" "text",
    "work_type" "text" DEFAULT 'anything'::"text" NOT NULL,
    "scheduled_start" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scheduled_end" timestamp with time zone,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "max_participants" integer DEFAULT 3 NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "focus_level" integer,
    "productivity_notes" "text",
    "effectiveness_rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work_buddy"."work_appointments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "work_buddy"."work_buddy_appointments" AS
 SELECT "ci"."id",
    "ci"."user_id",
    "ci"."target_user_id",
    "ci"."data",
    "ci"."scheduled_at",
    "ci"."status",
    "ci"."created_at",
    "u1"."email" AS "user_email",
    "u2"."email" AS "target_user_email",
        CASE
            WHEN ("ci"."scheduled_at" > "now"()) THEN 'upcoming'::"text"
            WHEN (("ci"."scheduled_at" <= "now"()) AND ("ci"."status" = 'completed'::"text")) THEN 'completed'::"text"
            WHEN (("ci"."scheduled_at" <= "now"()) AND ("ci"."status" <> 'completed'::"text")) THEN 'overdue'::"text"
            ELSE 'unknown'::"text"
        END AS "appointment_status"
   FROM (("public"."context_interactions" "ci"
     LEFT JOIN "auth"."users" "u1" ON (("ci"."user_id" = "u1"."id")))
     LEFT JOIN "auth"."users" "u2" ON (("ci"."target_user_id" = "u2"."id")))
  WHERE (("ci"."context" = 'oo-work-buddy'::"text") AND ("ci"."type" = 'appointment'::"text"))
  ORDER BY "ci"."scheduled_at" DESC;


ALTER VIEW "work_buddy"."work_buddy_appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work_buddy"."work_buddy_interaction_types" (
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "data_schema" "jsonb",
    "is_schedulable" boolean DEFAULT false,
    "default_duration" integer,
    "requires_other_user" boolean DEFAULT false
);


ALTER TABLE "work_buddy"."work_buddy_interaction_types" OWNER TO "postgres";


CREATE OR REPLACE VIEW "work_buddy"."work_buddy_user_dashboard" AS
 SELECT "uc"."user_id",
    "uc"."bio",
    "uc"."traits",
    "uc"."score",
    "uc"."preferences",
    "count"(
        CASE
            WHEN (("ci"."type" = 'appointment'::"text") AND ("ci"."scheduled_at" >= "now"())) THEN 1
            ELSE NULL::integer
        END) AS "upcoming_appointments",
    "count"(
        CASE
            WHEN (("ci"."type" = 'appointment'::"text") AND ("ci"."scheduled_at" < "now"()) AND ("ci"."status" = 'completed'::"text")) THEN 1
            ELSE NULL::integer
        END) AS "completed_appointments",
    "count"(
        CASE
            WHEN (("ci"."type" = 'productivity_log'::"text") AND ("ci"."created_at" >= ("now"() - '7 days'::interval))) THEN 1
            ELSE NULL::integer
        END) AS "productivity_logs_week",
    "avg"(
        CASE
            WHEN (("ci"."type" = 'productivity_log'::"text") AND ("ci"."created_at" >= ("now"() - '30 days'::interval))) THEN (("ci"."data" ->> 'focus_rating'::"text"))::integer
            ELSE NULL::integer
        END) AS "avg_focus_rating_month",
    "uc"."updated_at" AS "profile_updated_at"
   FROM ("public"."user_contexts" "uc"
     LEFT JOIN "public"."context_interactions" "ci" ON ((("uc"."user_id" = "ci"."user_id") AND ("ci"."context" = 'oo-work-buddy'::"text"))))
  WHERE (("uc"."context" = 'oo-work-buddy'::"text") AND ("uc"."is_active" = true))
  GROUP BY "uc"."user_id", "uc"."bio", "uc"."traits", "uc"."score", "uc"."preferences", "uc"."updated_at";


ALTER VIEW "work_buddy"."work_buddy_user_dashboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work_buddy"."work_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "host_user_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "work_type" "text" DEFAULT 'anything'::"text" NOT NULL,
    "scheduled_start" timestamp with time zone NOT NULL,
    "scheduled_end" timestamp with time zone,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "max_participants" integer DEFAULT 3 NOT NULL,
    "is_private" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "participants" "jsonb" DEFAULT '[]'::"jsonb",
    "focus_level" integer,
    "productivity_notes" "text",
    "effectiveness_rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "work_buddy"."work_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "work_buddy"."workbuddy_user_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "notifications" boolean DEFAULT true,
    "sound_effects" boolean DEFAULT true,
    "default_session_duration" integer DEFAULT 25,
    "focus_mode" "text" DEFAULT 'pomodoro'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "workbuddy_user_settings_focus_mode_check" CHECK (("focus_mode" = ANY (ARRAY['pomodoro'::"text", 'deep'::"text", 'collaborative'::"text"])))
);


ALTER TABLE "work_buddy"."workbuddy_user_settings" OWNER TO "postgres";


COMMENT ON TABLE "work_buddy"."workbuddy_user_settings" IS 'Work Buddy user preferences and settings';



ALTER TABLE ONLY "hugo_ai"."insights"
    ADD CONSTRAINT "insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_ai"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_career"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_career"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "hugo_love"."ai_documents"
    ADD CONSTRAINT "ai_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."blocks"
    ADD CONSTRAINT "blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."content_flags"
    ADD CONSTRAINT "content_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."content_moderation_results"
    ADD CONSTRAINT "content_moderation_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."document_chunks"
    ADD CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."error_logs"
    ADD CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."ice_breakers"
    ADD CONSTRAINT "ice_breakers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."matches"
    ADD CONSTRAINT "matches_user1_id_user2_id_tenant_id_key" UNIQUE ("user1_id", "user2_id", "tenant_id");



ALTER TABLE ONLY "hugo_love"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."mixer_registrations"
    ADD CONSTRAINT "mixer_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."mode_switches"
    ADD CONSTRAINT "mode_switches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."moderation_audit_log"
    ADD CONSTRAINT "moderation_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."moderation_configurations"
    ADD CONSTRAINT "moderation_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."moderation_configurations"
    ADD CONSTRAINT "moderation_configurations_tenant_id_key" UNIQUE ("tenant_id");



ALTER TABLE ONLY "hugo_love"."offline_operations"
    ADD CONSTRAINT "offline_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."partnerships"
    ADD CONSTRAINT "partnerships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "hugo_love"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."ratings"
    ADD CONSTRAINT "ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."ratings"
    ADD CONSTRAINT "ratings_rater_id_rated_id_tenant_id_key" UNIQUE ("rater_id", "rated_id", "tenant_id");



ALTER TABLE ONLY "hugo_love"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id");



ALTER TABLE ONLY "hugo_love"."swipes"
    ADD CONSTRAINT "swipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."swipes"
    ADD CONSTRAINT "swipes_user_id_profile_id_tenant_id_key" UNIQUE ("user_id", "profile_id", "tenant_id");



ALTER TABLE ONLY "hugo_love"."mixer_registrations"
    ADD CONSTRAINT "unique_active_registration" UNIQUE ("user_id", "mixer_id");



ALTER TABLE ONLY "hugo_love"."partnerships"
    ADD CONSTRAINT "unique_partnership" UNIQUE ("user_a_id", "user_b_id");



ALTER TABLE ONLY "hugo_love"."rate_limits"
    ADD CONSTRAINT "unique_rate_limit_window" UNIQUE ("user_id", "endpoint", "window_start");



ALTER TABLE ONLY "hugo_love"."unlock_status"
    ADD CONSTRAINT "unlock_status_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "hugo_love"."unlock_status"
    ADD CONSTRAINT "unlock_status_user_id_conversation_id_feature_type_tenant_i_key" UNIQUE ("user_id", "conversation_id", "feature_type", "tenant_id");



ALTER TABLE ONLY "hugo_love"."user_restrictions"
    ADD CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "live_mixers"."category_stars"
    ADD CONSTRAINT "category_stars_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "live_mixers"."category_stars"
    ADD CONSTRAINT "category_stars_user_id_category_id_key" UNIQUE ("user_id", "category_id");



ALTER TABLE ONLY "live_mixers"."mixer_event_metadata"
    ADD CONSTRAINT "mixer_event_metadata_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "live_mixers"."mixer_event_metadata"
    ADD CONSTRAINT "mixer_event_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "live_mixers"."mixer_notification_rules"
    ADD CONSTRAINT "mixer_notification_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "live_mixers"."mixer_registration_metadata"
    ADD CONSTRAINT "mixer_registration_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "live_mixers"."mixer_user_preferences"
    ADD CONSTRAINT "mixer_user_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "live_mixers"."mixer_user_preferences"
    ADD CONSTRAINT "mixer_user_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "live_mixers"."mixer_registration_metadata"
    ADD CONSTRAINT "unique_registration_metadata" UNIQUE ("registration_id");



ALTER TABLE ONLY "oriva_platform"."apps"
    ADD CONSTRAINT "apps_app_id_key" UNIQUE ("app_id");



ALTER TABLE ONLY "oriva_platform"."apps"
    ADD CONSTRAINT "apps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "oriva_platform"."apps"
    ADD CONSTRAINT "apps_schema_name_key" UNIQUE ("schema_name");



ALTER TABLE ONLY "oriva_platform"."extraction_manifests"
    ADD CONSTRAINT "extraction_manifests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "oriva_platform"."mixers"
    ADD CONSTRAINT "mixers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "oriva_platform"."user_app_access"
    ADD CONSTRAINT "user_app_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "oriva_platform"."user_app_access"
    ADD CONSTRAINT "user_app_access_user_id_app_id_key" UNIQUE ("user_id", "app_id");



ALTER TABLE ONLY "oriva_platform"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "oriva_platform"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "oriva_platform"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agreement_participants"
    ADD CONSTRAINT "agreement_participants_agreement_id_user_id_key" UNIQUE ("agreement_id", "user_id");



ALTER TABLE ONLY "public"."agreement_participants"
    ADD CONSTRAINT "agreement_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_conversations"
    ADD CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_api_usage"
    ADD CONSTRAINT "app_api_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_oauth_credentials"
    ADD CONSTRAINT "app_oauth_credentials_client_id_key" UNIQUE ("client_id");



ALTER TABLE ONLY "public"."app_oauth_credentials"
    ADD CONSTRAINT "app_oauth_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_reviews"
    ADD CONSTRAINT "app_reviews_app_id_user_id_key" UNIQUE ("app_id", "user_id");



ALTER TABLE ONLY "public"."app_reviews"
    ADD CONSTRAINT "app_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_webhooks"
    ADD CONSTRAINT "app_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audiences"
    ADD CONSTRAINT "audiences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_entries"
    ADD CONSTRAINT "collection_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_entries"
    ADD CONSTRAINT "collection_entries_unique" UNIQUE ("collection_id", "entry_id");



ALTER TABLE ONLY "public"."collection_tags"
    ADD CONSTRAINT "collection_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_tags"
    ADD CONSTRAINT "collection_tags_unique" UNIQUE ("collection_id", "tag_id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_user_name_unique" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."content_collections"
    ADD CONSTRAINT "content_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_topics"
    ADD CONSTRAINT "content_topics_entry_id_topic_slug_key" UNIQUE ("entry_id", "topic_slug");



ALTER TABLE ONLY "public"."content_topics"
    ADD CONSTRAINT "content_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."context_interactions"
    ADD CONSTRAINT "context_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."context_settings"
    ADD CONSTRAINT "context_settings_context_key_key" UNIQUE ("context", "key");



ALTER TABLE ONLY "public"."context_settings"
    ADD CONSTRAINT "context_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."developer_api_keys"
    ADD CONSTRAINT "developer_api_keys_key_hash_key" UNIQUE ("key_hash");



ALTER TABLE ONLY "public"."developer_api_keys"
    ADD CONSTRAINT "developer_api_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."developer_api_keys"
    ADD CONSTRAINT "developer_api_keys_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."developers"
    ADD CONSTRAINT "developers_api_key_key" UNIQUE ("api_key");



ALTER TABLE ONLY "public"."developers"
    ADD CONSTRAINT "developers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_conversations"
    ADD CONSTRAINT "dm_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dm_messages"
    ADD CONSTRAINT "dm_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entry_historical_context"
    ADD CONSTRAINT "entry_historical_context_entry_id_period_slug_key" UNIQUE ("entry_id", "period_slug");



ALTER TABLE ONLY "public"."entry_historical_context"
    ADD CONSTRAINT "entry_historical_context_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entry_relations"
    ADD CONSTRAINT "entry_relations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entry_relationships"
    ADD CONSTRAINT "entry_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entry_relationships"
    ADD CONSTRAINT "entry_relationships_source_entry_id_target_entry_id_relatio_key" UNIQUE ("source_entry_id", "target_entry_id", "relationship_type");



ALTER TABLE ONLY "public"."entry_tags"
    ADD CONSTRAINT "entry_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."entry_tags"
    ADD CONSTRAINT "entry_tags_unique" UNIQUE ("entry_id", "tag_id");



ALTER TABLE ONLY "public"."entry_topics"
    ADD CONSTRAINT "entry_topics_pkey" PRIMARY KEY ("entry_id", "topic_slug");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."event_categories"
    ADD CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expo_push_tokens"
    ADD CONSTRAINT "expo_push_tokens_expo_push_token_key" UNIQUE ("expo_push_token");



ALTER TABLE ONLY "public"."expo_push_tokens"
    ADD CONSTRAINT "expo_push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expo_push_tokens"
    ADD CONSTRAINT "expo_push_tokens_user_id_expo_push_token_key" UNIQUE ("user_id", "expo_push_token");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_agreement_id_key" UNIQUE ("user_id", "agreement_id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_entry_id_key" UNIQUE ("user_id", "entry_id");



ALTER TABLE ONLY "public"."feed_items"
    ADD CONSTRAINT "feed_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_items"
    ADD CONSTRAINT "feed_items_user_id_response_id_key" UNIQUE ("user_id", "response_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_notice_list"
    ADD CONSTRAINT "group_notice_list_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_notice_list"
    ADD CONSTRAINT "group_notice_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups_new"
    ADD CONSTRAINT "groups_new_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_analysis_results"
    ADD CONSTRAINT "hugo_analysis_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_apps"
    ADD CONSTRAINT "hugo_apps_app_id_key" UNIQUE ("app_id");



ALTER TABLE ONLY "public"."hugo_apps"
    ADD CONSTRAINT "hugo_apps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_collaboration_memory"
    ADD CONSTRAINT "hugo_collaboration_memory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_conversations"
    ADD CONSTRAINT "hugo_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_conversations"
    ADD CONSTRAINT "hugo_conversations_session_id_key" UNIQUE ("session_id");



ALTER TABLE ONLY "public"."hugo_knowledge_base"
    ADD CONSTRAINT "hugo_knowledge_base_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_knowledge_bases"
    ADD CONSTRAINT "hugo_knowledge_bases_kb_id_key" UNIQUE ("kb_id");



ALTER TABLE ONLY "public"."hugo_knowledge_bases"
    ADD CONSTRAINT "hugo_knowledge_bases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_knowledge_entries"
    ADD CONSTRAINT "hugo_knowledge_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_learning_data"
    ADD CONSTRAINT "hugo_learning_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_messages"
    ADD CONSTRAINT "hugo_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_personality_schemas"
    ADD CONSTRAINT "hugo_personality_schemas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_user_insights"
    ADD CONSTRAINT "hugo_user_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_user_memories"
    ADD CONSTRAINT "hugo_user_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hugo_user_profiles"
    ADD CONSTRAINT "hugo_user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."hugo_user_progress"
    ADD CONSTRAINT "hugo_user_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."markdown_files"
    ADD CONSTRAINT "markdown_files_oriva_id_key" UNIQUE ("oriva_id");



ALTER TABLE ONLY "public"."markdown_files"
    ADD CONSTRAINT "markdown_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."markdown_sections"
    ADD CONSTRAINT "markdown_sections_entry_id_key" UNIQUE ("entry_id");



ALTER TABLE ONLY "public"."markdown_sections"
    ADD CONSTRAINT "markdown_sections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_apps"
    ADD CONSTRAINT "marketplace_apps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_apps"
    ADD CONSTRAINT "marketplace_apps_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."mention_notifications"
    ADD CONSTRAINT "mention_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mentions"
    ADD CONSTRAINT "mentions_entry_id_mentioned_user_id_position_start_key" UNIQUE ("entry_id", "mentioned_user_id", "position_start");



ALTER TABLE ONLY "public"."mentions"
    ADD CONSTRAINT "mentions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_counters"
    ADD CONSTRAINT "notification_counters_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."notification_state"
    ADD CONSTRAINT "notification_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_sync_log"
    ADD CONSTRAINT "notification_sync_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_access_tokens"
    ADD CONSTRAINT "oauth_access_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_access_tokens"
    ADD CONSTRAINT "oauth_access_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."oauth_authorization_codes"
    ADD CONSTRAINT "oauth_authorization_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."oauth_authorization_codes"
    ADD CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_events"
    ADD CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_notifications"
    ADD CONSTRAINT "platform_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plugin_categories"
    ADD CONSTRAINT "plugin_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."plugin_categories"
    ADD CONSTRAINT "plugin_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plugin_executions_log"
    ADD CONSTRAINT "plugin_executions_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plugin_installs"
    ADD CONSTRAINT "plugin_installs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plugin_installs"
    ADD CONSTRAINT "plugin_installs_user_id_plugin_id_key" UNIQUE ("user_id", "plugin_id");



ALTER TABLE ONLY "public"."plugin_marketplace_apps"
    ADD CONSTRAINT "plugin_marketplace_apps_developer_id_name_key" UNIQUE ("developer_id", "name");



ALTER TABLE ONLY "public"."plugin_marketplace_apps"
    ADD CONSTRAINT "plugin_marketplace_apps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plugin_marketplace_apps"
    ADD CONSTRAINT "plugin_marketplace_apps_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."plugin_reviews"
    ADD CONSTRAINT "plugin_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plugin_reviews"
    ADD CONSTRAINT "plugin_reviews_user_id_plugin_id_key" UNIQUE ("user_id", "plugin_id");



ALTER TABLE ONLY "public"."plugin_versions"
    ADD CONSTRAINT "plugin_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plugin_versions"
    ADD CONSTRAINT "plugin_versions_plugin_id_version_key" UNIQUE ("plugin_id", "version");



ALTER TABLE ONLY "public"."plugins"
    ADD CONSTRAINT "plugins_developer_id_key" UNIQUE ("developer_id");



ALTER TABLE ONLY "public"."plugins"
    ADD CONSTRAINT "plugins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plugins"
    ADD CONSTRAINT "plugins_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profile_memberships"
    ADD CONSTRAINT "profile_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_memberships"
    ADD CONSTRAINT "profile_memberships_profile_id_group_id_key" UNIQUE ("profile_id", "group_id");



ALTER TABLE ONLY "public"."profile_social_links"
    ADD CONSTRAINT "profile_social_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."response_interactions"
    ADD CONSTRAINT "response_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."response_interactions"
    ADD CONSTRAINT "response_interactions_response_id_user_id_interaction_type_key" UNIQUE ("response_id", "user_id", "interaction_type");



ALTER TABLE ONLY "public"."response_votes"
    ADD CONSTRAINT "response_votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."response_votes"
    ADD CONSTRAINT "response_votes_response_id_user_id_key" UNIQUE ("response_id", "user_id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_entry_id_user_id_key" UNIQUE ("entry_id", "user_id");



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."section_responses"
    ADD CONSTRAINT "section_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_logs"
    ADD CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_name_unique" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telescope_sessions"
    ADD CONSTRAINT "telescope_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telescope_sessions"
    ADD CONSTRAINT "telescope_sessions_user_id_collection_id_key" UNIQUE ("user_id", "collection_id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topics"
    ADD CONSTRAINT "topics_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."platform_notifications"
    ADD CONSTRAINT "unique_app_external_id" UNIQUE ("app_id", "external_id");



ALTER TABLE ONLY "public"."notification_state"
    ADD CONSTRAINT "unique_notification_user" UNIQUE ("notification_id", "user_id");



ALTER TABLE ONLY "public"."user_registrations"
    ADD CONSTRAINT "unique_user_event_registration" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."user_filter_presets"
    ADD CONSTRAINT "uq_user_preset_name" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."user_app_installs"
    ADD CONSTRAINT "user_app_installs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_app_installs"
    ADD CONSTRAINT "user_app_installs_user_id_app_id_key" UNIQUE ("user_id", "app_id");



ALTER TABLE ONLY "public"."user_contexts"
    ADD CONSTRAINT "user_contexts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_contexts"
    ADD CONSTRAINT "user_contexts_user_id_context_key" UNIQUE ("user_id", "context");



ALTER TABLE ONLY "public"."user_filter_presets"
    ADD CONSTRAINT "user_filter_presets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_personalization_cache"
    ADD CONSTRAINT "user_personalization_cache_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_personalization_preferences"
    ADD CONSTRAINT "user_personalization_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_personalization_preferences"
    ADD CONSTRAINT "user_personalization_preferences_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."user_registrations"
    ADD CONSTRAINT "user_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_topic_engagements"
    ADD CONSTRAINT "user_topic_engagements_pkey" PRIMARY KEY ("user_id", "topic_id");



ALTER TABLE ONLY "public"."user_topic_intensities"
    ADD CONSTRAINT "user_topic_intensities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_topic_intensities"
    ADD CONSTRAINT "user_topic_intensities_unique" UNIQUE ("user_id", "topic_slug");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_delivery_log"
    ADD CONSTRAINT "webhook_delivery_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."availability_slots"
    ADD CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."calendar_connections"
    ADD CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."chemistry_ratings"
    ADD CONSTRAINT "chemistry_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."chemistry_ratings"
    ADD CONSTRAINT "chemistry_ratings_rater_user_id_rated_user_id_key" UNIQUE ("rater_user_id", "rated_user_id");



ALTER TABLE ONLY "work_buddy"."session_metadata"
    ADD CONSTRAINT "session_metadata_oriva_session_id_key" UNIQUE ("oriva_session_id");



ALTER TABLE ONLY "work_buddy"."session_metadata"
    ADD CONSTRAINT "session_metadata_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."session_participants"
    ADD CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."calendar_connections"
    ADD CONSTRAINT "unique_user_provider_calendar" UNIQUE ("user_id", "provider", "calendar_id");



ALTER TABLE ONLY "work_buddy"."user_analytics"
    ADD CONSTRAINT "user_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."work_appointments"
    ADD CONSTRAINT "work_appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."work_buddy_interaction_types"
    ADD CONSTRAINT "work_buddy_interaction_types_pkey" PRIMARY KEY ("type");



ALTER TABLE ONLY "work_buddy"."work_sessions"
    ADD CONSTRAINT "work_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."workbuddy_user_settings"
    ADD CONSTRAINT "workbuddy_user_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "work_buddy"."workbuddy_user_settings"
    ADD CONSTRAINT "workbuddy_user_settings_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_insights_confidence" ON "hugo_ai"."insights" USING "btree" ("confidence");



CREATE INDEX "idx_insights_cross_app_visibility" ON "hugo_ai"."insights" USING "btree" ("cross_app_visibility");



CREATE INDEX "idx_insights_session_id" ON "hugo_ai"."insights" USING "btree" ("session_id");



CREATE INDEX "idx_insights_source_app_id" ON "hugo_ai"."insights" USING "btree" ("source_app_id");



CREATE INDEX "idx_insights_user_id" ON "hugo_ai"."insights" USING "btree" ("user_id");



CREATE INDEX "idx_sessions_app_id" ON "hugo_ai"."sessions" USING "btree" ("app_id");



CREATE INDEX "idx_sessions_session_type" ON "hugo_ai"."sessions" USING "btree" ("session_type");



CREATE INDEX "idx_sessions_started_at" ON "hugo_ai"."sessions" USING "btree" ("started_at");



CREATE INDEX "idx_sessions_user_id" ON "hugo_ai"."sessions" USING "btree" ("user_id");



CREATE INDEX "idx_hugo_career_profiles_user_id" ON "hugo_career"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_hugo_love_profiles_user_id" ON "hugo_love"."profiles" USING "btree" ("user_id");



CREATE INDEX "idx_ice_breakers_confidence" ON "hugo_love"."ice_breakers" USING "btree" ("confidence");



CREATE INDEX "idx_ice_breakers_profile_id" ON "hugo_love"."ice_breakers" USING "btree" ("profile_id");



CREATE INDEX "idx_category_stars_category_id" ON "live_mixers"."category_stars" USING "btree" ("category_id");



CREATE INDEX "idx_category_stars_created_at" ON "live_mixers"."category_stars" USING "btree" ("created_at");



CREATE INDEX "idx_category_stars_user_id" ON "live_mixers"."category_stars" USING "btree" ("user_id");



CREATE INDEX "idx_mixer_event_metadata_category_id" ON "live_mixers"."mixer_event_metadata" USING "btree" ("category_id");



CREATE UNIQUE INDEX "idx_mixer_event_metadata_event_id" ON "live_mixers"."mixer_event_metadata" USING "btree" ("event_id");



CREATE INDEX "idx_mixer_event_metadata_featured" ON "live_mixers"."mixer_event_metadata" USING "btree" ("is_featured");



CREATE INDEX "idx_mixer_event_metadata_tags" ON "live_mixers"."mixer_event_metadata" USING "gin" ("tags");



CREATE INDEX "idx_mixer_event_metadata_updated" ON "live_mixers"."mixer_event_metadata" USING "btree" ("updated_at");



CREATE INDEX "idx_mixer_notification_rules_enabled" ON "live_mixers"."mixer_notification_rules" USING "btree" ("is_enabled");



CREATE INDEX "idx_mixer_notification_rules_type" ON "live_mixers"."mixer_notification_rules" USING "btree" ("rule_type");



CREATE INDEX "idx_mixer_notification_rules_updated" ON "live_mixers"."mixer_notification_rules" USING "btree" ("updated_at");



CREATE INDEX "idx_mixer_notification_rules_user_id" ON "live_mixers"."mixer_notification_rules" USING "btree" ("user_id");



CREATE INDEX "idx_mixer_registration_metadata_event_id" ON "live_mixers"."mixer_registration_metadata" USING "btree" ("event_id");



CREATE INDEX "idx_mixer_registration_metadata_registration_id" ON "live_mixers"."mixer_registration_metadata" USING "btree" ("registration_id");



CREATE INDEX "idx_mixer_registration_metadata_reminder_sent" ON "live_mixers"."mixer_registration_metadata" USING "btree" ("reminder_sent");



CREATE INDEX "idx_mixer_registration_metadata_user_id" ON "live_mixers"."mixer_registration_metadata" USING "btree" ("user_id");



CREATE INDEX "idx_mixer_user_preferences_starred_categories" ON "live_mixers"."mixer_user_preferences" USING "gin" ("starred_categories");



CREATE INDEX "idx_mixer_user_preferences_updated" ON "live_mixers"."mixer_user_preferences" USING "btree" ("updated_at");



CREATE UNIQUE INDEX "idx_mixer_user_preferences_user_id" ON "live_mixers"."mixer_user_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_apps_app_id" ON "oriva_platform"."apps" USING "btree" ("app_id");



CREATE INDEX "idx_apps_status" ON "oriva_platform"."apps" USING "btree" ("status");



CREATE INDEX "idx_extraction_manifests_created_at" ON "oriva_platform"."extraction_manifests" USING "btree" ("created_at");



CREATE INDEX "idx_extraction_manifests_expires_at" ON "oriva_platform"."extraction_manifests" USING "btree" ("expires_at");



CREATE INDEX "idx_extraction_manifests_status" ON "oriva_platform"."extraction_manifests" USING "btree" ("status");



CREATE INDEX "idx_extraction_manifests_user_id" ON "oriva_platform"."extraction_manifests" USING "btree" ("user_id");



CREATE INDEX "idx_user_app_access_app_id" ON "oriva_platform"."user_app_access" USING "btree" ("app_id");



CREATE INDEX "idx_user_app_access_status" ON "oriva_platform"."user_app_access" USING "btree" ("status");



CREATE INDEX "idx_user_app_access_user_id" ON "oriva_platform"."user_app_access" USING "btree" ("user_id");



CREATE INDEX "idx_users_email" ON "oriva_platform"."users" USING "btree" ("email");



CREATE INDEX "idx_users_last_active_at" ON "oriva_platform"."users" USING "btree" ("last_active_at");



CREATE INDEX "apps_personality_idx" ON "public"."hugo_apps" USING "btree" ("personality_schema_id");



CREATE INDEX "collection_entries_added_by_idx" ON "public"."collection_entries" USING "btree" ("added_by");



CREATE INDEX "collection_entries_collection_id_idx" ON "public"."collection_entries" USING "btree" ("collection_id");



CREATE INDEX "collection_entries_entry_id_idx" ON "public"."collection_entries" USING "btree" ("entry_id");



CREATE INDEX "collection_tags_collection_id_idx" ON "public"."collection_tags" USING "btree" ("collection_id");



CREATE INDEX "collection_tags_tag_id_idx" ON "public"."collection_tags" USING "btree" ("tag_id");



CREATE INDEX "collections_parent_id_idx" ON "public"."collections" USING "btree" ("parent_id");



CREATE INDEX "collections_type_idx" ON "public"."collections" USING "btree" ("type");



CREATE INDEX "collections_user_id_idx" ON "public"."collections" USING "btree" ("user_id");



CREATE INDEX "entries_combined_embedding_idx" ON "public"."entries" USING "ivfflat" ("combined_embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "entries_content_embedding_idx" ON "public"."entries" USING "ivfflat" ("content_embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "entries_title_embedding_idx" ON "public"."entries" USING "ivfflat" ("title_embedding" "public"."vector_cosine_ops") WITH ("lists"='100');



CREATE INDEX "entries_topics_idx" ON "public"."entries" USING "gin" ("topics");



CREATE INDEX "entry_tags_entry_id_idx" ON "public"."entry_tags" USING "btree" ("entry_id");



CREATE INDEX "entry_tags_tag_id_idx" ON "public"."entry_tags" USING "btree" ("tag_id");



CREATE INDEX "groups_new_created_by_idx" ON "public"."groups_new" USING "btree" ("created_by");



CREATE INDEX "groups_new_members_gin_idx" ON "public"."groups_new" USING "gin" ("members");



CREATE INDEX "hugo_apps_active_idx" ON "public"."hugo_apps" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "hugo_apps_app_id_idx" ON "public"."hugo_apps" USING "btree" ("app_id");



CREATE INDEX "hugo_apps_domain_idx" ON "public"."hugo_apps" USING "btree" ("domain");



CREATE INDEX "hugo_conversations_recent_idx" ON "public"."hugo_conversations" USING "btree" ("last_message_at" DESC);



CREATE UNIQUE INDEX "hugo_conversations_session_id_idx" ON "public"."hugo_conversations" USING "btree" ("session_id");



CREATE INDEX "hugo_conversations_user_app_idx" ON "public"."hugo_conversations" USING "btree" ("user_id", "app_id");



CREATE INDEX "idx_agreements_created_by" ON "public"."agreements" USING "btree" ("created_by");



CREATE INDEX "idx_agreements_profile_id" ON "public"."agreements" USING "btree" ("profile_id");



CREATE INDEX "idx_agreements_status" ON "public"."agreements" USING "btree" ("status");



CREATE INDEX "idx_ai_conversations_last_message_at" ON "public"."ai_conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_ai_conversations_user_id" ON "public"."ai_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_ai_messages_conversation_id" ON "public"."ai_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_ai_messages_created_at" ON "public"."ai_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_app_api_usage_app" ON "public"."app_api_usage" USING "btree" ("app_id");



CREATE INDEX "idx_app_api_usage_created" ON "public"."app_api_usage" USING "btree" ("created_at");



CREATE INDEX "idx_app_reviews_app" ON "public"."app_reviews" USING "btree" ("app_id");



CREATE INDEX "idx_app_user" ON "public"."hugo_collaboration_memory" USING "btree" ("app_id", "user_id");



CREATE INDEX "idx_app_webhooks_active" ON "public"."app_webhooks" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_app_webhooks_app_id" ON "public"."app_webhooks" USING "btree" ("app_id");



CREATE INDEX "idx_audiences_created_by" ON "public"."audiences" USING "btree" ("created_by");



CREATE INDEX "idx_category" ON "public"."hugo_knowledge_base" USING "btree" ("category");



CREATE INDEX "idx_collections_published" ON "public"."content_collections" USING "btree" ("published_at" DESC) WHERE ("status" = 'published'::"text");



CREATE INDEX "idx_collections_user_status" ON "public"."content_collections" USING "btree" ("user_id", "status");



CREATE INDEX "idx_content_topics_confidence" ON "public"."content_topics" USING "btree" ("confidence_score" DESC);



CREATE INDEX "idx_content_topics_created_at" ON "public"."content_topics" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_content_topics_entry_id" ON "public"."content_topics" USING "btree" ("entry_id");



CREATE INDEX "idx_content_topics_topic_slug" ON "public"."content_topics" USING "btree" ("topic_slug");



CREATE INDEX "idx_context_interactions_context" ON "public"."context_interactions" USING "btree" ("context");



CREATE INDEX "idx_context_interactions_context_status" ON "public"."context_interactions" USING "btree" ("context", "status", "created_at" DESC);



CREATE INDEX "idx_context_interactions_created" ON "public"."context_interactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_context_interactions_scheduled" ON "public"."context_interactions" USING "btree" ("scheduled_at");



CREATE INDEX "idx_context_interactions_status" ON "public"."context_interactions" USING "btree" ("status");



CREATE INDEX "idx_context_interactions_type" ON "public"."context_interactions" USING "btree" ("context", "type");



CREATE INDEX "idx_context_interactions_user" ON "public"."context_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_context_interactions_user_context" ON "public"."context_interactions" USING "btree" ("user_id", "context");



CREATE INDEX "idx_context_settings_configurable" ON "public"."context_settings" USING "btree" ("context", "is_user_configurable");



CREATE INDEX "idx_context_settings_context" ON "public"."context_settings" USING "btree" ("context");



CREATE INDEX "idx_created_at" ON "public"."hugo_collaboration_memory" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_created_learning" ON "public"."hugo_learning_data" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_developer_api_keys_active" ON "public"."developer_api_keys" USING "btree" ("is_active");



CREATE INDEX "idx_developer_api_keys_key_hash" ON "public"."developer_api_keys" USING "btree" ("key_hash");



CREATE INDEX "idx_developer_api_keys_user_id" ON "public"."developer_api_keys" USING "btree" ("user_id");



CREATE INDEX "idx_developers_api_key" ON "public"."developers" USING "btree" ("api_key");



CREATE INDEX "idx_dm_conversations_last_message_at" ON "public"."dm_conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_dm_conversations_participant_ids" ON "public"."dm_conversations" USING "gin" ("participant_ids");



CREATE INDEX "idx_dm_messages_conversation_id" ON "public"."dm_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_dm_messages_created_at" ON "public"."dm_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_dm_messages_sender_id" ON "public"."dm_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_domain" ON "public"."hugo_learning_data" USING "btree" ("domain");



CREATE INDEX "idx_domain_insights" ON "public"."hugo_user_insights" USING "btree" ("domain", "insight_type");



CREATE INDEX "idx_entries_audience_gin" ON "public"."entries" USING "gin" ("audience");



CREATE INDEX "idx_entries_auto_saved" ON "public"."entries" USING "btree" ("auto_saved");



CREATE INDEX "idx_entries_collection_id" ON "public"."entries" USING "btree" ("collection_id") WHERE ("collection_id" IS NOT NULL);



CREATE INDEX "idx_entries_created_by" ON "public"."entries" USING "btree" ("created_by");



CREATE INDEX "idx_entries_has_tasks" ON "public"."entries" USING "btree" ("has_tasks") WHERE ("has_tasks" = true);



CREATE INDEX "idx_entries_is_anonymous" ON "public"."entries" USING "btree" ("is_anonymous");



CREATE INDEX "idx_entries_media" ON "public"."entries" USING "gin" ("media");



CREATE INDEX "idx_entries_parent_id" ON "public"."entries" USING "btree" ("parent_id");



CREATE INDEX "idx_entries_parent_order" ON "public"."entries" USING "btree" ("parent_id", "display_order");



CREATE INDEX "idx_entries_profile_id" ON "public"."entries" USING "btree" ("profile_id");



CREATE INDEX "idx_entries_status" ON "public"."entries" USING "btree" ("status");



CREATE INDEX "idx_entries_telescope_collection" ON "public"."entries" USING "btree" ("telescope_collection_id", "display_order");



CREATE INDEX "idx_entries_user_id" ON "public"."entries" USING "btree" ("user_id");



CREATE INDEX "idx_entries_user_status" ON "public"."entries" USING "btree" ("user_id", "status");



CREATE INDEX "idx_entry_relations_bidirectional" ON "public"."entry_relations" USING "btree" ("source_entry_id", "target_entry_id") WHERE ("active" = true);



CREATE INDEX "idx_entry_relations_created_at" ON "public"."entry_relations" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_entry_relations_creator" ON "public"."entry_relations" USING "btree" ("created_by_user_id");



CREATE INDEX "idx_entry_relations_source" ON "public"."entry_relations" USING "btree" ("source_entry_id") WHERE ("active" = true);



CREATE INDEX "idx_entry_relations_target" ON "public"."entry_relations" USING "btree" ("target_entry_id") WHERE ("active" = true);



CREATE INDEX "idx_entry_topics_entry" ON "public"."entry_topics" USING "btree" ("entry_id");



CREATE INDEX "idx_entry_topics_slug" ON "public"."entry_topics" USING "btree" ("topic_slug");



CREATE INDEX "idx_event_categories_active" ON "public"."event_categories" USING "btree" ("is_active");



CREATE UNIQUE INDEX "idx_event_categories_name" ON "public"."event_categories" USING "btree" ("name");



CREATE INDEX "idx_event_categories_updated" ON "public"."event_categories" USING "btree" ("updated_at");



CREATE INDEX "idx_events_category_id" ON "public"."events" USING "btree" ("category_id");



CREATE INDEX "idx_events_end_time" ON "public"."events" USING "btree" ("end_time");



CREATE INDEX "idx_events_geo" ON "public"."events" USING "btree" ("latitude", "longitude") WHERE (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL));



CREATE INDEX "idx_events_is_active" ON "public"."events" USING "btree" ("is_active");



CREATE INDEX "idx_events_is_online" ON "public"."events" USING "btree" ("is_online");



CREATE INDEX "idx_events_location" ON "public"."events" USING "btree" ("location");



CREATE INDEX "idx_events_organizer_id" ON "public"."events" USING "btree" ("organizer_id");



CREATE INDEX "idx_events_start_time" ON "public"."events" USING "btree" ("start_time");



CREATE INDEX "idx_events_updated_at" ON "public"."events" USING "btree" ("updated_at");



CREATE INDEX "idx_expires_at" ON "public"."hugo_collaboration_memory" USING "btree" ("expires_at");



CREATE INDEX "idx_expo_tokens_active" ON "public"."expo_push_tokens" USING "btree" ("user_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_expo_tokens_user_id" ON "public"."expo_push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_favorites_profile_id" ON "public"."favorites" USING "btree" ("profile_id");



CREATE INDEX "idx_favorites_user_id" ON "public"."favorites" USING "btree" ("user_id");



CREATE INDEX "idx_feed_items_expires" ON "public"."feed_items" USING "btree" ("expires_at");



CREATE INDEX "idx_feed_items_relevance" ON "public"."feed_items" USING "btree" ("user_id", "relevance_score" DESC);



CREATE INDEX "idx_feed_items_user_position" ON "public"."feed_items" USING "btree" ("user_id", "feed_position");



CREATE INDEX "idx_group_members_group_id" ON "public"."group_members" USING "btree" ("group_id");



CREATE INDEX "idx_group_members_role" ON "public"."group_members" USING "btree" ("role");



CREATE INDEX "idx_group_members_user_id" ON "public"."group_members" USING "btree" ("user_id");



CREATE INDEX "idx_group_notice_list_created_at" ON "public"."group_notice_list" USING "btree" ("created_at");



CREATE INDEX "idx_group_notice_list_group_id" ON "public"."group_notice_list" USING "btree" ("group_id");



CREATE INDEX "idx_group_notice_list_user_id" ON "public"."group_notice_list" USING "btree" ("user_id");



CREATE INDEX "idx_groups_category" ON "public"."groups" USING "btree" ("category");



CREATE INDEX "idx_groups_created_at" ON "public"."groups" USING "btree" ("created_at");



CREATE INDEX "idx_groups_created_by" ON "public"."groups" USING "btree" ("created_by");



CREATE INDEX "idx_groups_is_private" ON "public"."groups" USING "btree" ("is_private");



CREATE INDEX "idx_historical_context_confidence" ON "public"."entry_historical_context" USING "btree" ("confidence_score") WHERE ("confidence_score" >= (0.3)::double precision);



CREATE INDEX "idx_historical_context_entry_id" ON "public"."entry_historical_context" USING "btree" ("entry_id");



CREATE INDEX "idx_historical_context_start_year" ON "public"."entry_historical_context" USING "btree" ("start_year") WHERE ("start_year" IS NOT NULL);



CREATE INDEX "idx_hugo_kb_active" ON "public"."hugo_knowledge_base" USING "btree" ("context", "is_active");



CREATE INDEX "idx_hugo_kb_category" ON "public"."hugo_knowledge_base" USING "btree" ("context", "category");



CREATE INDEX "idx_hugo_kb_confidence" ON "public"."hugo_knowledge_base" USING "btree" ("context", "confidence_score" DESC);



CREATE INDEX "idx_hugo_kb_context" ON "public"."hugo_knowledge_base" USING "btree" ("context");



CREATE INDEX "idx_hugo_kb_tags" ON "public"."hugo_knowledge_base" USING "gin" ("tags");



CREATE INDEX "idx_hugo_kb_usage" ON "public"."hugo_knowledge_base" USING "btree" ("usage_count" DESC);



CREATE INDEX "idx_knowledge_created" ON "public"."hugo_knowledge_base" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_markdown_files_oriva_id" ON "public"."markdown_files" USING "btree" ("oriva_id");



CREATE INDEX "idx_markdown_files_path" ON "public"."markdown_files" USING "btree" ("user_id", "path");



CREATE INDEX "idx_markdown_files_sync_status" ON "public"."markdown_files" USING "btree" ("sync_status");



CREATE INDEX "idx_markdown_files_updated_at" ON "public"."markdown_files" USING "btree" ("updated_at");



CREATE INDEX "idx_markdown_files_user_id" ON "public"."markdown_files" USING "btree" ("user_id");



CREATE INDEX "idx_markdown_sections_entry_id" ON "public"."markdown_sections" USING "btree" ("entry_id");



CREATE INDEX "idx_markdown_sections_file_id" ON "public"."markdown_sections" USING "btree" ("file_id");



CREATE INDEX "idx_markdown_sections_order" ON "public"."markdown_sections" USING "btree" ("file_id", "order_index");



CREATE INDEX "idx_markdown_sections_parent" ON "public"."markdown_sections" USING "btree" ("parent_section_id");



CREATE INDEX "idx_markdown_sections_response_count" ON "public"."markdown_sections" USING "btree" ("response_count" DESC);



CREATE INDEX "idx_marketplace_apps_category" ON "public"."marketplace_apps" USING "btree" ("category");



CREATE INDEX "idx_marketplace_apps_developer" ON "public"."marketplace_apps" USING "btree" ("developer_id");



CREATE INDEX "idx_marketplace_apps_status" ON "public"."marketplace_apps" USING "btree" ("status");



CREATE INDEX "idx_mention_notifications_created_at" ON "public"."mention_notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_mention_notifications_entry" ON "public"."mention_notifications" USING "btree" ("entry_id");



CREATE INDEX "idx_mention_notifications_unread" ON "public"."mention_notifications" USING "btree" ("mentioned_user_id") WHERE ("notification_read" = false);



CREATE INDEX "idx_mention_notifications_user" ON "public"."mention_notifications" USING "btree" ("mentioned_user_id");



CREATE INDEX "idx_metadata_tags" ON "public"."hugo_collaboration_memory" USING "gin" ((("metadata" -> 'tags'::"text")) "jsonb_path_ops");



CREATE INDEX "idx_notification_counters_date" ON "public"."notification_counters" USING "btree" ("date");



CREATE INDEX "idx_notification_counters_user_date" ON "public"."notification_counters" USING "btree" ("user_id", "date");



CREATE INDEX "idx_notification_state_notification" ON "public"."notification_state" USING "btree" ("notification_id");



CREATE INDEX "idx_notification_state_user_status_time" ON "public"."notification_state" USING "btree" ("user_id", "status", "updated_at" DESC);



CREATE INDEX "idx_notifications_cleanup" ON "public"."notifications" USING "btree" ("session_time");



CREATE INDEX "idx_notifications_pending_reminders" ON "public"."notifications" USING "btree" ("scheduled_at", "status") WHERE ((("status")::"text" = 'pending'::"text") AND (("type")::"text" = 'reminder'::"text"));



CREATE INDEX "idx_notifications_session_id" ON "public"."notifications" USING "btree" ("session_id");



CREATE INDEX "idx_notifications_session_time" ON "public"."notifications" USING "btree" ("session_time");



CREATE INDEX "idx_notifications_status" ON "public"."notifications" USING "btree" ("status");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_oauth_codes_app" ON "public"."oauth_authorization_codes" USING "btree" ("app_id");



CREATE INDEX "idx_oauth_tokens_app" ON "public"."oauth_access_tokens" USING "btree" ("app_id");



CREATE INDEX "idx_oauth_tokens_expires" ON "public"."oauth_access_tokens" USING "btree" ("expires_at");



CREATE INDEX "idx_platform_events_app_user_time" ON "public"."platform_events" USING "btree" ("app_id", "user_id", "created_at" DESC);



CREATE INDEX "idx_platform_events_category_type" ON "public"."platform_events" USING "btree" ("event_category", "event_type", "created_at" DESC);



CREATE INDEX "idx_platform_events_data" ON "public"."platform_events" USING "gin" ("event_data" "jsonb_path_ops");



CREATE INDEX "idx_platform_events_entity" ON "public"."platform_events" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_platform_events_user_time" ON "public"."platform_events" USING "btree" ("user_id", "timestamp" DESC);



CREATE INDEX "idx_platform_notifications_app_user_time" ON "public"."platform_notifications" USING "btree" ("app_id", "user_id", "created_at" DESC);



CREATE INDEX "idx_platform_notifications_context_data" ON "public"."platform_notifications" USING "gin" ("context_data" "jsonb_path_ops");



CREATE INDEX "idx_platform_notifications_type" ON "public"."platform_notifications" USING "btree" ("notification_type");



CREATE INDEX "idx_platform_notifications_user_expiry" ON "public"."platform_notifications" USING "btree" ("user_id", "created_at" DESC, "expires_at");



CREATE INDEX "idx_platform_notifications_user_time" ON "public"."platform_notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_plugin_marketplace_apps_execution_url" ON "public"."plugin_marketplace_apps" USING "btree" ("execution_url");



CREATE INDEX "idx_plugin_marketplace_apps_hosting_type" ON "public"."plugin_marketplace_apps" USING "btree" ("hosting_type");



CREATE INDEX "idx_plugin_versions_approved" ON "public"."plugin_versions" USING "btree" ("plugin_id") WHERE ("approved" = true);



CREATE INDEX "idx_plugin_versions_manifest_gin" ON "public"."plugin_versions" USING "gin" ("manifest");



CREATE INDEX "idx_plugins_category" ON "public"."plugins" USING "btree" ("category_id");



CREATE INDEX "idx_plugins_created_at" ON "public"."plugins" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_plugins_metadata_gin" ON "public"."plugins" USING "gin" ("metadata");



CREATE INDEX "idx_plugins_name_trgm" ON "public"."plugins" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_plugins_status" ON "public"."plugins" USING "btree" ("status");



CREATE INDEX "idx_profile_memberships_group_id" ON "public"."profile_memberships" USING "btree" ("group_id");



CREATE INDEX "idx_profile_memberships_profile_id" ON "public"."profile_memberships" USING "btree" ("profile_id");



CREATE INDEX "idx_profile_social_links_platform" ON "public"."profile_social_links" USING "btree" ("profile_id", "platform");



CREATE INDEX "idx_profile_social_links_profile_id" ON "public"."profile_social_links" USING "btree" ("profile_id");



CREATE INDEX "idx_profiles_account_active" ON "public"."profiles" USING "btree" ("account_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_profiles_account_id" ON "public"."profiles" USING "btree" ("account_id");



CREATE INDEX "idx_profiles_account_id_active" ON "public"."profiles" USING "btree" ("account_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_profiles_is_active" ON "public"."profiles" USING "btree" ("is_active");



CREATE INDEX "idx_profiles_is_anonymous" ON "public"."profiles" USING "btree" ("is_anonymous");



CREATE INDEX "idx_profiles_username" ON "public"."profiles" USING "btree" ("username") WHERE ("username" IS NOT NULL);



CREATE UNIQUE INDEX "idx_profiles_username_unique" ON "public"."profiles" USING "btree" ("username") WHERE ("username" IS NOT NULL);



CREATE INDEX "idx_response_interactions_response" ON "public"."response_interactions" USING "btree" ("response_id");



CREATE INDEX "idx_response_interactions_type" ON "public"."response_interactions" USING "btree" ("interaction_type");



CREATE INDEX "idx_response_interactions_user" ON "public"."response_interactions" USING "btree" ("user_id");



CREATE INDEX "idx_responses_entry_id" ON "public"."responses" USING "btree" ("entry_id");



CREATE INDEX "idx_responses_is_anonymous" ON "public"."responses" USING "btree" ("is_anonymous");



CREATE INDEX "idx_responses_parent_response_id" ON "public"."responses" USING "btree" ("parent_response_id");



CREATE INDEX "idx_responses_profile_id" ON "public"."responses" USING "btree" ("profile_id");



CREATE INDEX "idx_responses_type" ON "public"."responses" USING "btree" ("response_type");



CREATE INDEX "idx_responses_user_id" ON "public"."responses" USING "btree" ("user_id");



CREATE INDEX "idx_section_responses_activity" ON "public"."section_responses" USING "btree" ("last_activity_at" DESC);



CREATE INDEX "idx_section_responses_created" ON "public"."section_responses" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_section_responses_feed" ON "public"."section_responses" USING "btree" ("section_entry_id", "traction_score" DESC, "created_at" DESC);



CREATE INDEX "idx_section_responses_parent" ON "public"."section_responses" USING "btree" ("parent_response_id");



CREATE INDEX "idx_section_responses_relevance" ON "public"."section_responses" USING "btree" ("relevance_score" DESC);



CREATE INDEX "idx_section_responses_section" ON "public"."section_responses" USING "btree" ("section_entry_id");



CREATE INDEX "idx_section_responses_thread" ON "public"."section_responses" USING "btree" ("parent_response_id", "created_at");



CREATE INDEX "idx_section_responses_thread_depth" ON "public"."section_responses" USING "btree" ("thread_depth");



CREATE INDEX "idx_section_responses_traction" ON "public"."section_responses" USING "btree" ("traction_score" DESC);



CREATE INDEX "idx_section_responses_type" ON "public"."section_responses" USING "btree" ("type");



CREATE INDEX "idx_section_responses_user" ON "public"."section_responses" USING "btree" ("user_id");



CREATE INDEX "idx_sync_log_notification_id" ON "public"."notification_sync_log" USING "btree" ("notification_id");



CREATE INDEX "idx_sync_log_pending" ON "public"."notification_sync_log" USING "btree" ("sync_status", "attempt_number", "created_at") WHERE (("sync_status")::"text" = ANY (ARRAY[('pending'::character varying)::"text", ('retrying'::character varying)::"text"]));



CREATE INDEX "idx_sync_logs_created" ON "public"."sync_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sync_logs_file" ON "public"."sync_logs" USING "btree" ("file_id");



CREATE INDEX "idx_sync_logs_operation" ON "public"."sync_logs" USING "btree" ("operation_type");



CREATE INDEX "idx_sync_logs_status" ON "public"."sync_logs" USING "btree" ("status");



CREATE INDEX "idx_sync_logs_user" ON "public"."sync_logs" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_assignee_id" ON "public"."tasks" USING "btree" ("assignee_id");



CREATE INDEX "idx_tasks_entry_id" ON "public"."tasks" USING "btree" ("entry_id");



CREATE INDEX "idx_telescope_user_active" ON "public"."telescope_sessions" USING "btree" ("user_id", "last_viewed_at" DESC);



CREATE INDEX "idx_templates_created_by" ON "public"."templates" USING "btree" ("created_by");



CREATE INDEX "idx_templates_profile_id" ON "public"."templates" USING "btree" ("profile_id");



CREATE INDEX "idx_user_analysis" ON "public"."hugo_analysis_results" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_app_installs_active" ON "public"."user_app_installs" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_user_app_installs_app" ON "public"."user_app_installs" USING "btree" ("app_id");



CREATE INDEX "idx_user_app_installs_app_id" ON "public"."user_app_installs" USING "btree" ("app_id");



CREATE INDEX "idx_user_app_installs_installed_at" ON "public"."user_app_installs" USING "btree" ("installed_at" DESC);



CREATE INDEX "idx_user_app_installs_user" ON "public"."user_app_installs" USING "btree" ("user_id");



CREATE INDEX "idx_user_app_installs_user_active" ON "public"."user_app_installs" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_user_app_installs_user_id" ON "public"."user_app_installs" USING "btree" ("user_id");



CREATE INDEX "idx_user_context" ON "public"."hugo_collaboration_memory" USING "btree" ("user_id", "context_type");



CREATE INDEX "idx_user_contexts_active" ON "public"."user_contexts" USING "btree" ("context", "is_active");



CREATE INDEX "idx_user_contexts_context" ON "public"."user_contexts" USING "btree" ("context");



CREATE INDEX "idx_user_contexts_score" ON "public"."user_contexts" USING "btree" ("context", "score" DESC);



CREATE INDEX "idx_user_contexts_user_id" ON "public"."user_contexts" USING "btree" ("user_id");



CREATE INDEX "idx_user_filter_presets_facets_gin" ON "public"."user_filter_presets" USING "gin" ("facets");



CREATE INDEX "idx_user_filter_presets_scope" ON "public"."user_filter_presets" USING "btree" ("scope");



CREATE INDEX "idx_user_filter_presets_user" ON "public"."user_filter_presets" USING "btree" ("user_id");



CREATE INDEX "idx_user_insights" ON "public"."hugo_user_insights" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_personalization_cache_expires" ON "public"."user_personalization_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_user_personalization_preferences_user" ON "public"."user_personalization_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_preferences_developer_mode" ON "public"."user_preferences" USING "btree" ("developer_mode");



CREATE INDEX "idx_user_preferences_notifications" ON "public"."user_preferences" USING "btree" ("notifications_enabled");



CREATE INDEX "idx_user_preferences_profile_visibility" ON "public"."user_preferences" USING "btree" ("profile_visibility");



CREATE INDEX "idx_user_preferences_user_id" ON "public"."user_preferences" USING "btree" ("user_id");



CREATE INDEX "idx_user_progress" ON "public"."hugo_user_progress" USING "btree" ("user_id", "domain", "timestamp" DESC);



CREATE INDEX "idx_user_registrations_event_id" ON "public"."user_registrations" USING "btree" ("event_id");



CREATE INDEX "idx_user_registrations_registered_at" ON "public"."user_registrations" USING "btree" ("registered_at");



CREATE INDEX "idx_user_registrations_status" ON "public"."user_registrations" USING "btree" ("status");



CREATE INDEX "idx_user_registrations_user_event" ON "public"."user_registrations" USING "btree" ("user_id", "event_id");



CREATE INDEX "idx_user_registrations_user_id" ON "public"."user_registrations" USING "btree" ("user_id");



CREATE INDEX "idx_user_session" ON "public"."hugo_learning_data" USING "btree" ("user_id", "session_id");



CREATE INDEX "idx_user_topic_engagements_last_engaged" ON "public"."user_topic_engagements" USING "btree" ("last_engaged_at" DESC);



CREATE INDEX "idx_user_topic_engagements_score" ON "public"."user_topic_engagements" USING "btree" ("user_id", "score" DESC);



CREATE INDEX "idx_user_topic_engagements_topic" ON "public"."user_topic_engagements" USING "btree" ("topic_id");



CREATE INDEX "idx_user_topic_engagements_topic_slug" ON "public"."user_topic_engagements" USING "btree" ("topic_slug");



CREATE INDEX "idx_user_topic_engagements_user_id" ON "public"."user_topic_engagements" USING "btree" ("user_id");



CREATE INDEX "idx_user_topic_engagements_user_score" ON "public"."user_topic_engagements" USING "btree" ("user_id", "score" DESC);



CREATE INDEX "idx_user_topic_intensities_topic" ON "public"."user_topic_intensities" USING "btree" ("topic_slug");



CREATE INDEX "idx_user_topic_intensities_user_combined" ON "public"."user_topic_intensities" USING "btree" ("user_id", "combined_intensity" DESC);



CREATE INDEX "idx_user_topic_intensities_user_updated" ON "public"."user_topic_intensities" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_users_developer_mode" ON "public"."users" USING "btree" ("developer_mode");



CREATE INDEX "idx_users_username_active" ON "public"."users" USING "btree" ("username") WHERE ("is_active" = true);



CREATE INDEX "idx_webhook_delivery_log_event" ON "public"."webhook_delivery_log" USING "btree" ("event_id");



CREATE INDEX "idx_webhook_delivery_log_retry" ON "public"."webhook_delivery_log" USING "btree" ("webhook_id", "delivered_at") WHERE (("success" = false) AND ("delivery_attempt" < 5));



CREATE INDEX "idx_webhook_delivery_log_success_time" ON "public"."webhook_delivery_log" USING "btree" ("success", "delivered_at" DESC);



CREATE INDEX "idx_webhook_delivery_log_webhook_time" ON "public"."webhook_delivery_log" USING "btree" ("webhook_id", "delivered_at" DESC);



CREATE INDEX "kb_active_idx" ON "public"."hugo_knowledge_bases" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "kb_app_ids_idx" ON "public"."hugo_knowledge_bases" USING "gin" ("app_ids");



CREATE UNIQUE INDEX "kb_kb_id_idx" ON "public"."hugo_knowledge_bases" USING "btree" ("kb_id");



CREATE INDEX "ke_category_idx" ON "public"."hugo_knowledge_entries" USING "btree" ("category");



CREATE INDEX "ke_kb_id_idx" ON "public"."hugo_knowledge_entries" USING "btree" ("knowledge_base_id");



CREATE INDEX "ke_popular_idx" ON "public"."hugo_knowledge_entries" USING "btree" ("access_count" DESC);



CREATE INDEX "ke_search_idx" ON "public"."hugo_knowledge_entries" USING "gin" ("search_vector");



CREATE INDEX "ke_tags_idx" ON "public"."hugo_knowledge_entries" USING "gin" ("tags");



CREATE INDEX "messages_conversation_idx" ON "public"."hugo_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "messages_role_idx" ON "public"."hugo_messages" USING "btree" ("role");



CREATE INDEX "notification_preferences_user_id_idx" ON "public"."notification_preferences" USING "btree" ("user_id");



CREATE UNIQUE INDEX "profiles_profileurl_unique" ON "public"."profiles" USING "btree" ("profileurl") WHERE ("profileurl" IS NOT NULL);



CREATE INDEX "ps_active_idx" ON "public"."hugo_personality_schemas" USING "btree" ("status", "rollout_percentage") WHERE (("status" = 'active'::"text") AND ("rollout_percentage" > 0));



CREATE INDEX "ps_layer_idx" ON "public"."hugo_personality_schemas" USING "btree" ("layer");



CREATE INDEX "ps_schema_id_version_idx" ON "public"."hugo_personality_schemas" USING "btree" ("schema_id", "version");



CREATE INDEX "ps_status_idx" ON "public"."hugo_personality_schemas" USING "btree" ("status");



CREATE UNIQUE INDEX "ps_unique_active_schema" ON "public"."hugo_personality_schemas" USING "btree" ("schema_id") WHERE (("status" = 'active'::"text") AND ("rollout_percentage" = 100));



CREATE INDEX "tags_name_idx" ON "public"."tags" USING "btree" ("name");



CREATE INDEX "tags_user_id_idx" ON "public"."tags" USING "btree" ("user_id");



CREATE INDEX "um_expires_idx" ON "public"."hugo_user_memories" USING "btree" ("expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "um_importance_idx" ON "public"."hugo_user_memories" USING "btree" ("importance" DESC);



CREATE INDEX "um_type_idx" ON "public"."hugo_user_memories" USING "btree" ("memory_type");



CREATE INDEX "um_user_app_idx" ON "public"."hugo_user_memories" USING "btree" ("user_id", "app_id");



CREATE UNIQUE INDEX "unique_default_per_account" ON "public"."profiles" USING "btree" ("account_id") WHERE ("is_default" = true);



COMMENT ON INDEX "public"."unique_default_per_account" IS 'Ensures each account has at most one default profile (is_default=true). Allows multiple non-default profiles.';



CREATE INDEX "up_milestones_idx" ON "public"."hugo_user_progress" USING "gin" ("milestones_reached");



CREATE INDEX "up_user_app_idx" ON "public"."hugo_user_progress" USING "btree" ("user_id", "app_id");



CREATE UNIQUE INDEX "uq_user_scope_default" ON "public"."user_filter_presets" USING "btree" ("user_id", "scope") WHERE ("is_default" = true);



CREATE INDEX "idx_availability_slots_days" ON "work_buddy"."availability_slots" USING "gin" ("days");



CREATE INDEX "idx_availability_slots_user_id" ON "work_buddy"."availability_slots" USING "btree" ("user_id");



CREATE INDEX "idx_availability_slots_work_type" ON "work_buddy"."availability_slots" USING "btree" ("work_type");



CREATE INDEX "idx_calendar_connections_active" ON "work_buddy"."calendar_connections" USING "btree" ("is_active");



CREATE INDEX "idx_calendar_connections_provider" ON "work_buddy"."calendar_connections" USING "btree" ("provider");



CREATE INDEX "idx_calendar_connections_user_id" ON "work_buddy"."calendar_connections" USING "btree" ("user_id");



CREATE INDEX "idx_calendar_connections_user_provider" ON "work_buddy"."calendar_connections" USING "btree" ("user_id", "provider");



CREATE INDEX "idx_chemistry_ratings_rated" ON "work_buddy"."chemistry_ratings" USING "btree" ("rated_user_id");



CREATE INDEX "idx_chemistry_ratings_rater" ON "work_buddy"."chemistry_ratings" USING "btree" ("rater_user_id");



CREATE INDEX "idx_session_metadata_oriva_id" ON "work_buddy"."session_metadata" USING "btree" ("oriva_session_id");



CREATE INDEX "idx_user_analytics_user_date" ON "work_buddy"."user_analytics" USING "btree" ("user_id", "date");



CREATE INDEX "idx_work_appointments_host" ON "work_buddy"."work_appointments" USING "btree" ("host_user_id");



CREATE INDEX "idx_work_appointments_scheduled_start" ON "work_buddy"."work_appointments" USING "btree" ("scheduled_start");



CREATE INDEX "idx_work_appointments_status" ON "work_buddy"."work_appointments" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "update_hugo_career_profiles_updated_at" BEFORE UPDATE ON "hugo_career"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hugo_love_profiles_updated_at" BEFORE UPDATE ON "hugo_love"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_mixer_event_metadata_updated_at" BEFORE UPDATE ON "live_mixers"."mixer_event_metadata" FOR EACH ROW EXECUTE FUNCTION "live_mixers"."update_mixer_event_metadata_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_mixer_notification_rules_updated_at" BEFORE UPDATE ON "live_mixers"."mixer_notification_rules" FOR EACH ROW EXECUTE FUNCTION "live_mixers"."update_mixer_notification_rules_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_mixer_user_preferences_updated_at" BEFORE UPDATE ON "live_mixers"."mixer_user_preferences" FOR EACH ROW EXECUTE FUNCTION "live_mixers"."update_mixer_user_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "update_category_stars_updated_at" BEFORE UPDATE ON "live_mixers"."category_stars" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_apps_updated_at" BEFORE UPDATE ON "oriva_platform"."apps" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "oriva_platform"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "add_creator_as_admin_trigger" AFTER INSERT ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."add_creator_as_admin"();



CREATE OR REPLACE TRIGGER "decrement_tag_usage_on_entry_tag" AFTER DELETE ON "public"."entry_tags" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_tag_usage"();



CREATE OR REPLACE TRIGGER "entries_mention_notifications_trigger" AFTER INSERT OR UPDATE OF "status" ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_mention_notifications"();



CREATE OR REPLACE TRIGGER "entry_relation_count_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."entry_relations" FOR EACH ROW EXECUTE FUNCTION "public"."update_entry_relation_count"();



CREATE OR REPLACE TRIGGER "increment_tag_usage_on_entry_tag" AFTER INSERT ON "public"."entry_tags" FOR EACH ROW EXECUTE FUNCTION "public"."increment_tag_usage"();



CREATE OR REPLACE TRIGGER "ke_search_vector_update" BEFORE INSERT OR UPDATE OF "title", "content", "tags" ON "public"."hugo_knowledge_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_ke_search_vector"();



CREATE OR REPLACE TRIGGER "trg_developers_updated_at" BEFORE UPDATE ON "public"."developers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plugin_categories_updated_at" BEFORE UPDATE ON "public"."plugin_categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plugin_reviews_updated_at" BEFORE UPDATE ON "public"."plugin_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plugins_updated_at" BEFORE UPDATE ON "public"."plugins" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_filter_presets_updated_at" BEFORE UPDATE ON "public"."user_filter_presets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_expo_tokens_updated_at" BEFORE UPDATE ON "public"."expo_push_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_notifications_updated_at" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_app_rating" AFTER INSERT OR DELETE OR UPDATE ON "public"."app_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_app_rating"();



CREATE OR REPLACE TRIGGER "trigger_update_entry_response_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_entry_response_count"();



CREATE OR REPLACE TRIGGER "trigger_update_entry_task_flags" AFTER INSERT OR DELETE OR UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_entry_task_flags"();



CREATE OR REPLACE TRIGGER "trigger_update_install_count" AFTER INSERT OR DELETE ON "public"."user_app_installs" FOR EACH ROW EXECUTE FUNCTION "public"."update_install_count"();



CREATE OR REPLACE TRIGGER "update_agreements_updated_at" BEFORE UPDATE ON "public"."agreements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_app_webhooks_timestamp" BEFORE UPDATE ON "public"."app_webhooks" FOR EACH ROW EXECUTE FUNCTION "public"."update_transaction_timestamp"();



CREATE OR REPLACE TRIGGER "update_audiences_updated_at" BEFORE UPDATE ON "public"."audiences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_collections_updated_at" BEFORE UPDATE ON "public"."collections" FOR EACH ROW EXECUTE FUNCTION "public"."update_collection_updated_at"();



CREATE OR REPLACE TRIGGER "update_content_topics_updated_at" BEFORE UPDATE ON "public"."content_topics" FOR EACH ROW EXECUTE FUNCTION "public"."update_content_topics_updated_at"();



CREATE OR REPLACE TRIGGER "update_context_interactions_updated_at" BEFORE UPDATE ON "public"."context_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_context_settings_updated_at" BEFORE UPDATE ON "public"."context_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_developer_api_keys_updated_at_trigger" BEFORE UPDATE ON "public"."developer_api_keys" FOR EACH ROW EXECUTE FUNCTION "public"."update_developer_api_keys_updated_at"();



CREATE OR REPLACE TRIGGER "update_entries_updated_at" BEFORE UPDATE ON "public"."entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_groups_updated_at" BEFORE UPDATE ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_historical_context_updated_at_trigger" BEFORE UPDATE ON "public"."entry_historical_context" FOR EACH ROW EXECUTE FUNCTION "public"."update_historical_context_updated_at"();



CREATE OR REPLACE TRIGGER "update_hugo_collaboration_memory_updated_at" BEFORE UPDATE ON "public"."hugo_collaboration_memory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hugo_kb_updated_at" BEFORE UPDATE ON "public"."hugo_knowledge_base" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hugo_knowledge_base_updated_at" BEFORE UPDATE ON "public"."hugo_knowledge_base" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_hugo_user_profiles_updated_at" BEFORE UPDATE ON "public"."hugo_user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_markdown_files_updated_at" BEFORE UPDATE ON "public"."markdown_files" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_markdown_sections_updated_at" BEFORE UPDATE ON "public"."markdown_sections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_preferences_updated_at" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_state_timestamp" BEFORE UPDATE ON "public"."notification_state" FOR EACH ROW EXECUTE FUNCTION "public"."update_transaction_timestamp"();



CREATE OR REPLACE TRIGGER "update_platform_notifications_timestamp" BEFORE UPDATE ON "public"."platform_notifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_transaction_timestamp"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_response_counts_trigger" AFTER INSERT ON "public"."section_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_response_counts"();



CREATE OR REPLACE TRIGGER "update_section_responses_updated_at" BEFORE UPDATE ON "public"."section_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tags_updated_at" BEFORE UPDATE ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."update_tag_updated_at"();



CREATE OR REPLACE TRIGGER "update_templates_updated_at" BEFORE UPDATE ON "public"."templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_thread_path_trigger" BEFORE INSERT ON "public"."section_responses" FOR EACH ROW EXECUTE FUNCTION "public"."update_thread_path"();



CREATE OR REPLACE TRIGGER "update_user_contexts_updated_at" BEFORE UPDATE ON "public"."user_contexts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_availability_slots_updated_at" BEFORE UPDATE ON "work_buddy"."availability_slots" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_session_metadata_updated_at" BEFORE UPDATE ON "work_buddy"."session_metadata" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_workbuddy_user_settings_updated_at" BEFORE UPDATE ON "work_buddy"."workbuddy_user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "hugo_ai"."insights"
    ADD CONSTRAINT "insights_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "hugo_ai"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_ai"."insights"
    ADD CONSTRAINT "insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "oriva_platform"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_ai"."sessions"
    ADD CONSTRAINT "sessions_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "oriva_platform"."apps"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "hugo_ai"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "oriva_platform"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_career"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "oriva_platform"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."ai_documents"
    ADD CONSTRAINT "ai_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."blocks"
    ADD CONSTRAINT "blocks_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."blocks"
    ADD CONSTRAINT "blocks_blocker_user_id_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."content_flags"
    ADD CONSTRAINT "content_flags_reviewed_by_admin_id_fkey" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "hugo_love"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."rate_limits"
    ADD CONSTRAINT "fk_user" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."ice_breakers"
    ADD CONSTRAINT "ice_breakers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "hugo_love"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "hugo_love"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."messages"
    ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."mixer_registrations"
    ADD CONSTRAINT "mixer_registrations_mixer_id_fkey" FOREIGN KEY ("mixer_id") REFERENCES "oriva_platform"."mixers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."mixer_registrations"
    ADD CONSTRAINT "mixer_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."mode_switches"
    ADD CONSTRAINT "mode_switches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "hugo_love"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_related_report_id_fkey" FOREIGN KEY ("related_report_id") REFERENCES "hugo_love"."reports"("id");



ALTER TABLE ONLY "hugo_love"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "hugo_love"."partnerships"
    ADD CONSTRAINT "partnerships_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."partnerships"
    ADD CONSTRAINT "partnerships_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "oriva_platform"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."reports"
    ADD CONSTRAINT "reports_reported_message_id_fkey" FOREIGN KEY ("reported_message_id") REFERENCES "hugo_love"."messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "hugo_love"."reports"
    ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "hugo_love"."reports"
    ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."reports"
    ADD CONSTRAINT "reports_resolved_by_admin_id_fkey" FOREIGN KEY ("resolved_by_admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "hugo_love"."swipes"
    ADD CONSTRAINT "swipes_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "hugo_love"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."unlock_status"
    ADD CONSTRAINT "unlock_status_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "hugo_love"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "hugo_love"."user_restrictions"
    ADD CONSTRAINT "user_restrictions_applied_by_admin_id_fkey" FOREIGN KEY ("applied_by_admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "hugo_love"."user_restrictions"
    ADD CONSTRAINT "user_restrictions_related_action_id_fkey" FOREIGN KEY ("related_action_id") REFERENCES "hugo_love"."moderation_actions"("id");



ALTER TABLE ONLY "hugo_love"."user_restrictions"
    ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "live_mixers"."mixer_event_metadata"
    ADD CONSTRAINT "mixer_event_metadata_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "live_mixers"."mixer_event_metadata"
    ADD CONSTRAINT "mixer_event_metadata_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "live_mixers"."mixer_registration_metadata"
    ADD CONSTRAINT "mixer_registration_metadata_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "live_mixers"."mixer_registration_metadata"
    ADD CONSTRAINT "mixer_registration_metadata_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."user_registrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "oriva_platform"."extraction_manifests"
    ADD CONSTRAINT "extraction_manifests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "oriva_platform"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "oriva_platform"."mixers"
    ADD CONSTRAINT "mixers_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "oriva_platform"."venues"("id");



ALTER TABLE ONLY "oriva_platform"."user_app_access"
    ADD CONSTRAINT "user_app_access_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "oriva_platform"."apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "oriva_platform"."user_app_access"
    ADD CONSTRAINT "user_app_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "oriva_platform"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agreement_participants"
    ADD CONSTRAINT "agreement_participants_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agreement_participants"
    ADD CONSTRAINT "agreement_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_messages"
    ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_api_usage"
    ADD CONSTRAINT "app_api_usage_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."marketplace_apps"("id");



ALTER TABLE ONLY "public"."app_api_usage"
    ADD CONSTRAINT "app_api_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."app_oauth_credentials"
    ADD CONSTRAINT "app_oauth_credentials_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."marketplace_apps"("id");



ALTER TABLE ONLY "public"."app_reviews"
    ADD CONSTRAINT "app_reviews_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."marketplace_apps"("id");



ALTER TABLE ONLY "public"."app_reviews"
    ADD CONSTRAINT "app_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."audiences"
    ADD CONSTRAINT "audiences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_entries"
    ADD CONSTRAINT "collection_entries_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_entries"
    ADD CONSTRAINT "collection_entries_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_entries"
    ADD CONSTRAINT "collection_entries_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_tags"
    ADD CONSTRAINT "collection_tags_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collection_tags"
    ADD CONSTRAINT "collection_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."collections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_collections"
    ADD CONSTRAINT "content_collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."content_topics"
    ADD CONSTRAINT "content_topics_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."context_interactions"
    ADD CONSTRAINT "context_interactions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."context_interactions"
    ADD CONSTRAINT "context_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."developer_api_keys"
    ADD CONSTRAINT "developer_api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."developers"
    ADD CONSTRAINT "developers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dm_messages"
    ADD CONSTRAINT "dm_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."dm_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_telescope_collection_id_fkey" FOREIGN KEY ("telescope_collection_id") REFERENCES "public"."content_collections"("id");



ALTER TABLE ONLY "public"."entries"
    ADD CONSTRAINT "entries_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entry_historical_context"
    ADD CONSTRAINT "entry_historical_context_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entry_relations"
    ADD CONSTRAINT "entry_relations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."entry_relations"
    ADD CONSTRAINT "entry_relations_source_entry_id_fkey" FOREIGN KEY ("source_entry_id") REFERENCES "public"."entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entry_relations"
    ADD CONSTRAINT "entry_relations_target_entry_id_fkey" FOREIGN KEY ("target_entry_id") REFERENCES "public"."entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entry_relationships"
    ADD CONSTRAINT "entry_relationships_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."entry_relationships"
    ADD CONSTRAINT "entry_relationships_source_entry_id_fkey" FOREIGN KEY ("source_entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entry_relationships"
    ADD CONSTRAINT "entry_relationships_target_entry_id_fkey" FOREIGN KEY ("target_entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entry_tags"
    ADD CONSTRAINT "entry_tags_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entry_tags"
    ADD CONSTRAINT "entry_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."entry_topics"
    ADD CONSTRAINT "entry_topics_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."event_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."expo_push_tokens"
    ADD CONSTRAINT "expo_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_agreement_id_fkey" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_items"
    ADD CONSTRAINT "feed_items_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."section_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_items"
    ADD CONSTRAINT "feed_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_webhooks"
    ADD CONSTRAINT "fk_app_webhooks_app_id" FOREIGN KEY ("app_id") REFERENCES "public"."hugo_apps"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_events"
    ADD CONSTRAINT "fk_platform_events_app_id" FOREIGN KEY ("app_id") REFERENCES "public"."hugo_apps"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_notifications"
    ADD CONSTRAINT "fk_platform_notifications_app_id" FOREIGN KEY ("app_id") REFERENCES "public"."hugo_apps"("app_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_app_installs"
    ADD CONSTRAINT "fk_user_app_installs_app" FOREIGN KEY ("app_id") REFERENCES "public"."plugin_marketplace_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_notice_list"
    ADD CONSTRAINT "group_notice_list_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_notice_list"
    ADD CONSTRAINT "group_notice_list_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groups_new"
    ADD CONSTRAINT "groups_new_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hugo_apps"
    ADD CONSTRAINT "hugo_apps_personality_schema_id_fkey" FOREIGN KEY ("personality_schema_id") REFERENCES "public"."hugo_personality_schemas"("id");



ALTER TABLE ONLY "public"."hugo_conversations"
    ADD CONSTRAINT "hugo_conversations_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."hugo_apps"("id");



ALTER TABLE ONLY "public"."hugo_conversations"
    ADD CONSTRAINT "hugo_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hugo_knowledge_entries"
    ADD CONSTRAINT "hugo_knowledge_entries_knowledge_base_id_fkey" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."hugo_knowledge_bases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hugo_personality_schemas"
    ADD CONSTRAINT "hugo_personality_schemas_parent_schema_id_fkey" FOREIGN KEY ("parent_schema_id") REFERENCES "public"."hugo_personality_schemas"("id");



ALTER TABLE ONLY "public"."hugo_user_memories"
    ADD CONSTRAINT "hugo_user_memories_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."hugo_apps"("id");



ALTER TABLE ONLY "public"."hugo_user_memories"
    ADD CONSTRAINT "hugo_user_memories_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."hugo_conversations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hugo_user_memories"
    ADD CONSTRAINT "hugo_user_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."hugo_user_progress"
    ADD CONSTRAINT "hugo_user_progress_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."hugo_apps"("id");



ALTER TABLE ONLY "public"."markdown_files"
    ADD CONSTRAINT "markdown_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."markdown_sections"
    ADD CONSTRAINT "markdown_sections_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."markdown_files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."markdown_sections"
    ADD CONSTRAINT "markdown_sections_parent_section_id_fkey" FOREIGN KEY ("parent_section_id") REFERENCES "public"."markdown_sections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_apps"
    ADD CONSTRAINT "marketplace_apps_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."mention_notifications"
    ADD CONSTRAINT "mention_notifications_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mention_notifications"
    ADD CONSTRAINT "mention_notifications_mentioned_user_id_fkey" FOREIGN KEY ("mentioned_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mention_notifications"
    ADD CONSTRAINT "mention_notifications_mentioning_user_id_fkey" FOREIGN KEY ("mentioning_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mentions"
    ADD CONSTRAINT "mentions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentions"
    ADD CONSTRAINT "mentions_mentioned_user_id_fkey" FOREIGN KEY ("mentioned_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mentions"
    ADD CONSTRAINT "mentions_mentioner_user_id_fkey" FOREIGN KEY ("mentioner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_counters"
    ADD CONSTRAINT "notification_counters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_state"
    ADD CONSTRAINT "notification_state_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."platform_notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_state"
    ADD CONSTRAINT "notification_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_sync_log"
    ADD CONSTRAINT "notification_sync_log_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."oauth_access_tokens"
    ADD CONSTRAINT "oauth_access_tokens_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."marketplace_apps"("id");



ALTER TABLE ONLY "public"."oauth_access_tokens"
    ADD CONSTRAINT "oauth_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."oauth_authorization_codes"
    ADD CONSTRAINT "oauth_authorization_codes_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."marketplace_apps"("id");



ALTER TABLE ONLY "public"."oauth_authorization_codes"
    ADD CONSTRAINT "oauth_authorization_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."platform_events"
    ADD CONSTRAINT "platform_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_notifications"
    ADD CONSTRAINT "platform_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_executions_log"
    ADD CONSTRAINT "plugin_executions_log_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."plugin_marketplace_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_executions_log"
    ADD CONSTRAINT "plugin_executions_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_installs"
    ADD CONSTRAINT "plugin_installs_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_installs"
    ADD CONSTRAINT "plugin_installs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_marketplace_apps"
    ADD CONSTRAINT "plugin_marketplace_apps_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_marketplace_apps"
    ADD CONSTRAINT "plugin_marketplace_apps_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."plugin_reviews"
    ADD CONSTRAINT "plugin_reviews_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_reviews"
    ADD CONSTRAINT "plugin_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugin_versions"
    ADD CONSTRAINT "plugin_versions_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plugins"
    ADD CONSTRAINT "plugins_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."plugin_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."plugins"
    ADD CONSTRAINT "plugins_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "public"."developers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_memberships"
    ADD CONSTRAINT "profile_memberships_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."audiences"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_memberships"
    ADD CONSTRAINT "profile_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_social_links"
    ADD CONSTRAINT "profile_social_links_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."response_interactions"
    ADD CONSTRAINT "response_interactions_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."section_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."response_interactions"
    ADD CONSTRAINT "response_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."response_votes"
    ADD CONSTRAINT "response_votes_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "public"."responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."response_votes"
    ADD CONSTRAINT "response_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_parent_response_id_fkey" FOREIGN KEY ("parent_response_id") REFERENCES "public"."responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."responses"
    ADD CONSTRAINT "responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."section_responses"
    ADD CONSTRAINT "section_responses_parent_response_id_fkey" FOREIGN KEY ("parent_response_id") REFERENCES "public"."section_responses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."section_responses"
    ADD CONSTRAINT "section_responses_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."section_responses"
    ADD CONSTRAINT "section_responses_section_entry_id_fkey" FOREIGN KEY ("section_entry_id") REFERENCES "public"."markdown_sections"("entry_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."section_responses"
    ADD CONSTRAINT "section_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sync_logs"
    ADD CONSTRAINT "sync_logs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."markdown_files"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sync_logs"
    ADD CONSTRAINT "sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telescope_sessions"
    ADD CONSTRAINT "telescope_sessions_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."content_collections"("id");



ALTER TABLE ONLY "public"."telescope_sessions"
    ADD CONSTRAINT "telescope_sessions_focus_entry_id_fkey" FOREIGN KEY ("focus_entry_id") REFERENCES "public"."entries"("id");



ALTER TABLE ONLY "public"."telescope_sessions"
    ADD CONSTRAINT "telescope_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."templates"
    ADD CONSTRAINT "templates_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_app_installs"
    ADD CONSTRAINT "user_app_installs_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "public"."plugin_marketplace_apps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_app_installs"
    ADD CONSTRAINT "user_app_installs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."user_contexts"
    ADD CONSTRAINT "user_contexts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_filter_presets"
    ADD CONSTRAINT "user_filter_presets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_personalization_cache"
    ADD CONSTRAINT "user_personalization_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_personalization_preferences"
    ADD CONSTRAINT "user_personalization_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_registrations"
    ADD CONSTRAINT "user_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_topic_intensities"
    ADD CONSTRAINT "user_topic_intensities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_delivery_log"
    ADD CONSTRAINT "webhook_delivery_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."platform_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."webhook_delivery_log"
    ADD CONSTRAINT "webhook_delivery_log_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "public"."app_webhooks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "work_buddy"."session_participants"
    ADD CONSTRAINT "session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "work_buddy"."work_sessions"("id") ON DELETE CASCADE;



ALTER TABLE "hugo_ai"."insights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insights_insert_own" ON "hugo_ai"."insights" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "insights_select_own_or_cross_app" ON "hugo_ai"."insights" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("cross_app_visibility" = true) AND ("user_id" = "auth"."uid"()))));



ALTER TABLE "hugo_ai"."sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sessions_insert_own" ON "hugo_ai"."sessions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "sessions_select_own" ON "hugo_ai"."sessions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "sessions_update_own" ON "hugo_ai"."sessions" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "hugo_career_profiles_insert_own" ON "hugo_career"."profiles" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "hugo_career_profiles_select_own" ON "hugo_career"."profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "hugo_career_profiles_update_own" ON "hugo_career"."profiles" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "hugo_career"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hugo_love_ice_breakers_select_own" ON "hugo_love"."ice_breakers" FOR SELECT USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "hugo_love"."profiles"
  WHERE ("profiles"."user_id" = "auth"."uid"()))));



CREATE POLICY "hugo_love_profiles_insert_own" ON "hugo_love"."profiles" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "hugo_love_profiles_select_own" ON "hugo_love"."profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "hugo_love_profiles_update_own" ON "hugo_love"."profiles" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "hugo_love"."ice_breakers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "hugo_love"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can delete their own starred categories" ON "live_mixers"."category_stars" FOR DELETE TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Users can insert their own starred categories" ON "live_mixers"."category_stars" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Users can manage their own registration metadata" ON "live_mixers"."mixer_registration_metadata" TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Users can update their own starred categories" ON "live_mixers"."category_stars" FOR UPDATE TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Users can view their own starred categories" ON "live_mixers"."category_stars" FOR SELECT TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



ALTER TABLE "live_mixers"."category_stars" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "oriva_platform"."apps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "apps_select_all" ON "oriva_platform"."apps" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "oriva_platform"."extraction_manifests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "extraction_manifests_insert_own" ON "oriva_platform"."extraction_manifests" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "extraction_manifests_select_own" ON "oriva_platform"."extraction_manifests" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "oriva_platform"."user_app_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_app_access_select_own" ON "oriva_platform"."user_app_access" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "oriva_platform"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_select_own" ON "oriva_platform"."users" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "users_update_own" ON "oriva_platform"."users" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Admins can update app status" ON "public"."plugin_marketplace_apps" FOR UPDATE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can view all apps" ON "public"."plugin_marketplace_apps" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Allow authenticated users to read active events" ON "public"."events" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Allow authenticated users to read registrations for their event" ON "public"."user_registrations" FOR SELECT TO "authenticated" USING ((("user_id" = ("auth"."jwt"() ->> 'sub'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "user_registrations"."event_id") AND ("events"."organizer_id" = ("auth"."jwt"() ->> 'sub'::"text")))))));



CREATE POLICY "Allow event organizers to delete their events" ON "public"."events" FOR DELETE TO "authenticated" USING (("organizer_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Allow event organizers to update their events" ON "public"."events" FOR UPDATE TO "authenticated" USING (("organizer_id" = ("auth"."jwt"() ->> 'sub'::"text"))) WITH CHECK (("organizer_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Allow users to cancel their registrations" ON "public"."user_registrations" FOR DELETE TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Allow users to create events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (("organizer_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Allow users to register for events" ON "public"."user_registrations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Allow users to update their registrations" ON "public"."user_registrations" FOR UPDATE TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text"))) WITH CHECK (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Anonymous users can create entries" ON "public"."entries" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anonymous users can update entries" ON "public"."entries" FOR UPDATE USING (true);



CREATE POLICY "Anyone can view published responses" ON "public"."responses" FOR SELECT USING (true);



CREATE POLICY "Apps can create notifications" ON "public"."platform_notifications" FOR INSERT WITH CHECK (("app_id" IN ( SELECT "hugo_apps"."app_id"
   FROM "public"."hugo_apps"
  WHERE ("hugo_apps"."is_active" = true))));



CREATE POLICY "Apps can create webhooks" ON "public"."app_webhooks" FOR INSERT WITH CHECK (("app_id" IN ( SELECT "hugo_apps"."app_id"
   FROM "public"."hugo_apps"
  WHERE ("hugo_apps"."is_active" = true))));



CREATE POLICY "Apps can delete their own notifications" ON "public"."platform_notifications" FOR DELETE USING (("app_id" IN ( SELECT "hugo_apps"."app_id"
   FROM "public"."hugo_apps"
  WHERE ("hugo_apps"."is_active" = true))));



CREATE POLICY "Apps can delete their own webhooks" ON "public"."app_webhooks" FOR DELETE USING (("app_id" IN ( SELECT "hugo_apps"."app_id"
   FROM "public"."hugo_apps"
  WHERE ("hugo_apps"."is_active" = true))));



CREATE POLICY "Apps can update notification state" ON "public"."notification_state" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."platform_notifications" "pn"
  WHERE (("pn"."id" = "notification_state"."notification_id") AND ("pn"."app_id" IN ( SELECT "hugo_apps"."app_id"
           FROM "public"."hugo_apps"
          WHERE ("hugo_apps"."is_active" = true)))))));



CREATE POLICY "Apps can update their own webhooks" ON "public"."app_webhooks" FOR UPDATE USING (("app_id" IN ( SELECT "hugo_apps"."app_id"
   FROM "public"."hugo_apps"
  WHERE ("hugo_apps"."is_active" = true))));



CREATE POLICY "Apps can view their own events" ON "public"."platform_events" FOR SELECT USING (("app_id" IN ( SELECT "hugo_apps"."app_id"
   FROM "public"."hugo_apps"
  WHERE ("hugo_apps"."is_active" = true))));



CREATE POLICY "Apps can view their own notifications" ON "public"."platform_notifications" FOR SELECT USING (("app_id" IN ( SELECT "hugo_apps"."app_id"
   FROM "public"."hugo_apps"
  WHERE ("hugo_apps"."is_active" = true))));



CREATE POLICY "Apps can view their own webhooks" ON "public"."app_webhooks" FOR SELECT USING (("app_id" IN ( SELECT "hugo_apps"."app_id"
   FROM "public"."hugo_apps"
  WHERE ("hugo_apps"."is_active" = true))));



CREATE POLICY "Apps can view their webhook delivery logs" ON "public"."webhook_delivery_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."app_webhooks"
  WHERE (("app_webhooks"."id" = "webhook_delivery_log"."webhook_id") AND ("app_webhooks"."app_id" IN ( SELECT "hugo_apps"."app_id"
           FROM "public"."hugo_apps"
          WHERE ("hugo_apps"."is_active" = true)))))));



CREATE POLICY "Authenticated users can create entries" ON "public"."entries" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can create responses" ON "public"."responses" FOR INSERT WITH CHECK (((("auth"."uid"() = "user_id") AND ("is_anonymous" = false)) OR (("user_id" IS NULL) AND ("is_anonymous" = true))));



CREATE POLICY "Authenticated users can delete entries" ON "public"."entries" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update entries" ON "public"."entries" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Developers can manage their own apps" ON "public"."marketplace_apps" USING (("developer_id" = "auth"."uid"()));



CREATE POLICY "Developers can view their app credentials" ON "public"."app_oauth_credentials" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."marketplace_apps"
  WHERE (("marketplace_apps"."id" = "app_oauth_credentials"."app_id") AND ("marketplace_apps"."developer_id" = "auth"."uid"())))));



CREATE POLICY "Group admins can view notice list for their groups" ON "public"."group_notice_list" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."group_members"
  WHERE (("group_members"."group_id" = "group_notice_list"."group_id") AND ("group_members"."user_id" = "auth"."uid"()) AND ("group_members"."role" = 'admin'::"text")))));



CREATE POLICY "Group creators can delete their groups" ON "public"."groups" FOR DELETE USING (("created_by" = "auth"."uid"()));



CREATE POLICY "Group creators can update their groups" ON "public"."groups" FOR UPDATE USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Group creators can view memberships" ON "public"."group_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."created_by" = "auth"."uid"())))));



COMMENT ON POLICY "Group creators can view memberships" ON "public"."group_members" IS 'Group creators can see all memberships in their groups - no recursion';



CREATE POLICY "Public can view approved apps" ON "public"."marketplace_apps" FOR SELECT USING ((("status")::"text" = 'approved'::"text"));



CREATE POLICY "Public can view reviews" ON "public"."app_reviews" FOR SELECT USING (true);



CREATE POLICY "Service can create delivery logs" ON "public"."webhook_delivery_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service can create events" ON "public"."platform_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service can create notification state" ON "public"."notification_state" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can access their own personalization cache" ON "public"."user_personalization_cache" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can add entries to their collections" ON "public"."collection_entries" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_entries"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can add tags to their collections" ON "public"."collection_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_tags"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can add tags to their entries" ON "public"."entry_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "entry_tags"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can add themselves to notice lists" ON "public"."group_notice_list" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create agreements" ON "public"."agreements" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can create audiences" ON "public"."audiences" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can create groups" ON "public"."groups" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can create own entries" ON "public"."entries" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"())))));



CREATE POLICY "Users can create own favorites" ON "public"."favorites" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own profile memberships" ON "public"."profile_memberships" FOR INSERT WITH CHECK (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can create own profile social links" ON "public"."profile_social_links" FOR INSERT WITH CHECK (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can create responses on accessible sections" ON "public"."section_responses" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM ("public"."markdown_sections"
     JOIN "public"."markdown_files" ON (("markdown_files"."id" = "markdown_sections"."file_id")))
  WHERE (("markdown_sections"."entry_id" = "section_responses"."section_entry_id") AND (("markdown_files"."is_private" = false) OR ("markdown_files"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can create templates" ON "public"."templates" FOR INSERT WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can create their own API keys" ON "public"."developer_api_keys" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own apps" ON "public"."plugin_marketplace_apps" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "developer_id"));



CREATE POLICY "Users can create their own collections" ON "public"."collections" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own entries" ON "public"."entries" FOR INSERT WITH CHECK (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can create their own tags" ON "public"."tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create topics for their entries" ON "public"."content_topics" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "content_topics"."entry_id") AND ("entries"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete historical context for own entries" ON "public"."entry_historical_context" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "entry_historical_context"."entry_id") AND ("entries"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own agreements" ON "public"."agreements" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete own audiences" ON "public"."audiences" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete own entries" ON "public"."entries" FOR DELETE USING ((("auth"."uid"() = "user_id") OR ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own favorites" ON "public"."favorites" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own profile memberships" ON "public"."profile_memberships" FOR DELETE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own profile social links" ON "public"."profile_social_links" FOR DELETE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own responses" ON "public"."responses" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("is_anonymous" = false)));



CREATE POLICY "Users can delete own templates" ON "public"."templates" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can delete their own API keys" ON "public"."developer_api_keys" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own collections" ON "public"."collections" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own entries" ON "public"."entries" FOR DELETE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their own reviews" ON "public"."app_reviews" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own tags" ON "public"."tags" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("is_system_tag" = false)));



CREATE POLICY "Users can delete their own tokens" ON "public"."expo_push_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete topics for their entries" ON "public"."content_topics" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "content_topics"."entry_id") AND ("entries"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert entries" ON "public"."entries" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR (("user_id" IS NULL) AND ("is_anonymous" = true))));



CREATE POLICY "Users can insert historical context for own entries" ON "public"."entry_historical_context" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "entry_historical_context"."entry_id") AND ("entries"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own memories" ON "public"."hugo_collaboration_memory" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own tokens" ON "public"."expo_push_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can join groups" ON "public"."group_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND (("g"."is_private" = false) OR ("g"."created_by" = "auth"."uid"())))))));



CREATE POLICY "Users can leave groups" ON "public"."group_members" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Users can manage memberships" ON "public"."group_members" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."created_by" = "auth"."uid"())))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."groups" "g"
  WHERE (("g"."id" = "group_members"."group_id") AND ("g"."created_by" = "auth"."uid"()))))));



CREATE POLICY "Users can manage sections of their files" ON "public"."markdown_sections" USING ((EXISTS ( SELECT 1
   FROM "public"."markdown_files"
  WHERE (("markdown_files"."id" = "markdown_sections"."file_id") AND ("markdown_files"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own collections" ON "public"."content_collections" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own feed items" ON "public"."feed_items" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own installs" ON "public"."user_app_installs" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own interactions" ON "public"."response_interactions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own markdown files" ON "public"."markdown_files" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own participation" ON "public"."agreement_participants" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own personalization preferences" ON "public"."user_personalization_preferences" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own responses" ON "public"."section_responses" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own reviews" ON "public"."app_reviews" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own telescope sessions" ON "public"."telescope_sessions" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own topic intensities" ON "public"."user_topic_intensities" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read historical context for accessible entries" ON "public"."entry_historical_context" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "entry_historical_context"."entry_id") AND (("entries"."user_id" = "auth"."uid"()) OR (("entries"."audience" ->> 'type'::"text") = ANY (ARRAY['public'::"text", 'everyone'::"text", 'shared'::"text"])))))));



CREATE POLICY "Users can read their own entries" ON "public"."entries" FOR SELECT USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can remove entries from their collections" ON "public"."collection_entries" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_entries"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can remove tags from their collections" ON "public"."collection_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_tags"."collection_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can remove tags from their entries" ON "public"."entry_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "entry_tags"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can remove themselves from notice lists" ON "public"."group_notice_list" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update historical context for own entries" ON "public"."entry_historical_context" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "entry_historical_context"."entry_id") AND ("entries"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own agreements" ON "public"."agreements" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update own audiences" ON "public"."audiences" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update own entries" ON "public"."entries" FOR UPDATE USING ((("auth"."uid"() = "user_id") OR ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own profile memberships" ON "public"."profile_memberships" FOR UPDATE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own profile social links" ON "public"."profile_social_links" FOR UPDATE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own responses" ON "public"."responses" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND ("is_anonymous" = false)));



CREATE POLICY "Users can update own templates" ON "public"."templates" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can update their notification state" ON "public"."notification_state" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own API keys" ON "public"."developer_api_keys" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own collections" ON "public"."collections" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own draft apps" ON "public"."plugin_marketplace_apps" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "developer_id") AND ("status" = 'draft'::"text"))) WITH CHECK (("auth"."uid"() = "developer_id"));



CREATE POLICY "Users can update their own entries" ON "public"."entries" FOR UPDATE USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"())))) WITH CHECK (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their own memories" ON "public"."hugo_collaboration_memory" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own reviews" ON "public"."app_reviews" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own tags" ON "public"."tags" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tokens" ON "public"."expo_push_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update topics for their entries" ON "public"."content_topics" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "content_topics"."entry_id") AND ("entries"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "content_topics"."entry_id") AND ("entries"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view accessible groups" ON "public"."groups" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR "public"."is_user_member_of_group"("auth"."uid"(), "id") OR ("is_private" = false)));



COMMENT ON POLICY "Users can view accessible groups" ON "public"."groups" IS 'Users can view groups they created, are members of, or public groups (is_private = false) - uses helper function to avoid RLS recursion';



CREATE POLICY "Users can view all content topics" ON "public"."content_topics" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can view and manage relationships for their entries" ON "public"."entry_relationships" USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "entry_relationships"."source_entry_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view and manage their tasks" ON "public"."tasks" USING (((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "tasks"."entry_id") AND ("e"."user_id" = "auth"."uid"()))))) OR (("auth"."uid"() IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "tasks"."entry_id") AND (("e"."user_id" IS NULL) OR ("e"."is_anonymous" = true)))))) OR (("auth"."uid"() IS NOT NULL) AND ("assignee_id" = "auth"."uid"()))));



CREATE POLICY "Users can view collection entries for their collections" ON "public"."collection_entries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_entries"."collection_id") AND (("c"."user_id" = "auth"."uid"()) OR ("c"."is_private" = false))))));



CREATE POLICY "Users can view collection tags for accessible collections" ON "public"."collection_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_tags"."collection_id") AND (("c"."user_id" = "auth"."uid"()) OR ("c"."is_private" = false))))));



CREATE POLICY "Users can view entry tags for accessible entries" ON "public"."entry_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "entry_tags"."entry_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view mentions they are part of" ON "public"."mentions" USING ((("mentioned_user_id" = "auth"."uid"()) OR ("mentioner_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."entries" "e"
  WHERE (("e"."id" = "mentions"."entry_id") AND ("e"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own agreements" ON "public"."agreements" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view own audiences" ON "public"."audiences" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view own entries" ON "public"."entries" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own favorites" ON "public"."favorites" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own memberships" ON "public"."group_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "Users can view own memberships" ON "public"."group_members" IS 'Users can see their own group memberships - no recursion';



CREATE POLICY "Users can view own profile memberships" ON "public"."profile_memberships" FOR SELECT USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own profile social links" ON "public"."profile_social_links" FOR SELECT USING (("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own templates" ON "public"."templates" FOR SELECT USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Users can view public collections" ON "public"."collections" FOR SELECT USING (("is_private" = false));



CREATE POLICY "Users can view public markdown files" ON "public"."markdown_files" FOR SELECT USING ((("is_private" = false) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Users can view public templates" ON "public"."templates" FOR SELECT USING (("is_public" = true));



CREATE POLICY "Users can view published collections" ON "public"."content_collections" FOR SELECT USING ((("status" = 'published'::"text") OR ("user_id" = "auth"."uid"()) OR (("audience" ->> 'type'::"text") = 'everyone'::"text")));



CREATE POLICY "Users can view responses on accessible sections" ON "public"."section_responses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."markdown_sections"
     JOIN "public"."markdown_files" ON (("markdown_files"."id" = "markdown_sections"."file_id")))
  WHERE (("markdown_sections"."entry_id" = "section_responses"."section_entry_id") AND (("markdown_files"."is_private" = false) OR ("markdown_files"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view sections of accessible files" ON "public"."markdown_sections" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."markdown_files"
  WHERE (("markdown_files"."id" = "markdown_sections"."file_id") AND (("markdown_files"."is_private" = false) OR ("markdown_files"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view system tags" ON "public"."tags" FOR SELECT USING (("is_system_tag" = true));



CREATE POLICY "Users can view their notification state" ON "public"."notification_state" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their notifications" ON "public"."platform_notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own API keys" ON "public"."developer_api_keys" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own apps" ON "public"."plugin_marketplace_apps" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "developer_id"));



CREATE POLICY "Users can view their own collections" ON "public"."collections" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own events" ON "public"."platform_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own memories" ON "public"."hugo_collaboration_memory" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("privacy_level" = ANY (ARRAY['public'::"text", 'core_shared'::"text"]))));



CREATE POLICY "Users can view their own notice list entries" ON "public"."group_notice_list" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."hugo_user_profiles" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own sync logs" ON "public"."sync_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tags" ON "public"."tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tokens" ON "public"."expo_push_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."agreement_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agreements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_conversations_insert_policy" ON "public"."ai_conversations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "ai_conversations"."user_id") AND ("profiles"."account_id" = "auth"."uid"())))));



CREATE POLICY "ai_conversations_select_policy" ON "public"."ai_conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "ai_conversations"."user_id") AND ("profiles"."account_id" = "auth"."uid"())))));



CREATE POLICY "ai_conversations_update_policy" ON "public"."ai_conversations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "ai_conversations"."user_id") AND ("profiles"."account_id" = "auth"."uid"())))));



ALTER TABLE "public"."ai_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_messages_insert_policy" ON "public"."ai_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."ai_conversations"
  WHERE (("ai_conversations"."id" = "ai_messages"."conversation_id") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "ai_conversations"."user_id") AND ("profiles"."account_id" = "auth"."uid"()))))))));



CREATE POLICY "ai_messages_select_policy" ON "public"."ai_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."ai_conversations"
  WHERE (("ai_conversations"."id" = "ai_messages"."conversation_id") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "ai_conversations"."user_id") AND ("profiles"."account_id" = "auth"."uid"()))))))));



CREATE POLICY "anonymous_can_read_profiles" ON "public"."profiles" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anonymous_can_read_responses" ON "public"."responses" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."app_oauth_credentials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_webhooks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audiences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated_can_insert_responses" ON "public"."responses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "authenticated_can_read_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_can_read_responses" ON "public"."responses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_users_view_published_entries" ON "public"."entries" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))) OR (("status" = 'published'::"public"."entry_status") AND (NOT ((("audience" ->> 'type'::"text") = 'private'::"text") AND ("user_id" <> "auth"."uid"()) AND (("profile_id" IS NULL) OR (NOT ("profile_id" IN ( SELECT "profiles"."id"
   FROM "public"."profiles"
  WHERE ("profiles"."account_id" = "auth"."uid"()))))))) AND ((COALESCE(("audience" ->> 'type'::"text"), 'everyone'::"text") = 'everyone'::"text") OR (("audience" ->> 'type'::"text") = 'public'::"text") OR ((("audience" ->> 'type'::"text") = 'group'::"text") AND (("audience" -> 'groups'::"text") IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "jsonb_array_elements_text"(("entries"."audience" -> 'groups'::"text")) "group_id_text"("value")
  WHERE "public"."is_user_group_member"("auth"."uid"(), ("group_id_text"."value")::"uuid")))) OR ((("audience" ->> 'type'::"text") = 'custom'::"text") AND (("audience" -> 'users'::"text") IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "jsonb_array_elements_text"(("entries"."audience" -> 'users'::"text")) "user_id_text"("value")
  WHERE ("user_id_text"."value" = ("auth"."uid"())::"text")))) OR ((("audience" ->> 'type'::"text") = ANY (ARRAY['following'::"text", 'network'::"text"])) AND ("user_id" = "auth"."uid"())) OR ("is_anonymous" = true)))));



COMMENT ON POLICY "authenticated_users_view_published_entries" ON "public"."entries" IS 'Allows authenticated users to view published entries based on audience privacy settings. Users can always view their own entries. Private entries are only visible to the owner. Group entries require membership. Custom entries require explicit user selection.';



ALTER TABLE "public"."collection_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collection_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_topics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."context_interactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "context_isolation_interactions" ON "public"."context_interactions" FOR SELECT USING (((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "target_user_id")) AND ("context" = "public"."get_app_context"())));



CREATE POLICY "context_isolation_user_contexts" ON "public"."user_contexts" FOR SELECT USING ((("auth"."uid"() = "user_id") AND ("context" = "public"."get_app_context"())));



ALTER TABLE "public"."context_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "context_settings_read_access" ON "public"."context_settings" FOR SELECT USING (("context" = "public"."get_app_context"()));



CREATE POLICY "context_settings_system_only" ON "public"."context_settings" USING (false);



CREATE POLICY "conversations_user_access" ON "public"."hugo_conversations" USING (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "conversations_user_access" ON "public"."hugo_conversations" IS 'Users can CRUD their own conversations';



CREATE POLICY "delete_own_entries" ON "public"."entries" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."developer_api_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."developers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "developers_owner_insert" ON "public"."developers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "developers_owner_select" ON "public"."developers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "developers_owner_update" ON "public"."developers" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."dm_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dm_conversations_insert_policy" ON "public"."dm_conversations" FOR INSERT WITH CHECK ((("array_length"("participant_ids", 1) = 2) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ANY ("dm_conversations"."participant_ids")) AND ("profiles"."account_id" = "auth"."uid"()))))));



CREATE POLICY "dm_conversations_select_policy" ON "public"."dm_conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ANY ("dm_conversations"."participant_ids")) AND ("profiles"."account_id" = "auth"."uid"())))));



ALTER TABLE "public"."dm_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dm_messages_insert_policy" ON "public"."dm_messages" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."dm_conversations"
  WHERE (("dm_conversations"."id" = "dm_messages"."conversation_id") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = ANY ("dm_conversations"."participant_ids")) AND ("profiles"."account_id" = "auth"."uid"()))))))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "dm_messages"."sender_id") AND ("profiles"."account_id" = "auth"."uid"()))))));



CREATE POLICY "dm_messages_select_policy" ON "public"."dm_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."dm_conversations"
  WHERE (("dm_conversations"."id" = "dm_messages"."conversation_id") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = ANY ("dm_conversations"."participant_ids")) AND ("profiles"."account_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entry_historical_context" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entry_relations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entry_relations_delete_policy" ON "public"."entry_relations" FOR DELETE USING (("created_by_user_id" = "auth"."uid"()));



CREATE POLICY "entry_relations_insert_policy" ON "public"."entry_relations" FOR INSERT WITH CHECK ((("created_by_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "entry_relations"."source_entry_id") AND ((("entries"."status" = 'published'::"public"."entry_status") AND (("entries"."audience" ->> 'type'::"text") = 'public'::"text")) OR ("entries"."user_id" = "auth"."uid"()))))) AND (EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "entry_relations"."target_entry_id") AND ((("entries"."status" = 'published'::"public"."entry_status") AND (("entries"."audience" ->> 'type'::"text") = 'public'::"text")) OR ("entries"."user_id" = "auth"."uid"())))))));



CREATE POLICY "entry_relations_select_policy" ON "public"."entry_relations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "entry_relations"."source_entry_id") AND ((("entries"."status" = 'published'::"public"."entry_status") AND (("entries"."audience" ->> 'type'::"text") = 'public'::"text")) OR ("entries"."user_id" = "auth"."uid"()))))) AND (EXISTS ( SELECT 1
   FROM "public"."entries"
  WHERE (("entries"."id" = "entry_relations"."target_entry_id") AND ((("entries"."status" = 'published'::"public"."entry_status") AND (("entries"."audience" ->> 'type'::"text") = 'public'::"text")) OR ("entries"."user_id" = "auth"."uid"())))))));



CREATE POLICY "entry_relations_update_policy" ON "public"."entry_relations" FOR UPDATE USING (("created_by_user_id" = "auth"."uid"())) WITH CHECK (("created_by_user_id" = "auth"."uid"()));



ALTER TABLE "public"."entry_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entry_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."entry_topics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "entry_topics_read_all" ON "public"."entry_topics" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expo_push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feed_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_notice_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."groups_new" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_new_access" ON "public"."groups_new" TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("members" @> "jsonb_build_array"("jsonb_build_object"('user_id', "auth"."uid"()))))) WITH CHECK (("created_by" = "auth"."uid"()));



ALTER TABLE "public"."hugo_analysis_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_collaboration_memory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_knowledge_base" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_learning_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_user_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_user_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hugo_user_progress" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_anonymous_entries" ON "public"."entries" FOR INSERT TO "anon" WITH CHECK ((("user_id" IS NULL) AND ("is_anonymous" = true)));



CREATE POLICY "insert_named_entries" ON "public"."entries" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."markdown_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."markdown_sections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_apps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mention_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mention_notifications_select_policy" ON "public"."mention_notifications" FOR SELECT USING (("mentioned_user_id" = "auth"."uid"()));



CREATE POLICY "mention_notifications_update_policy" ON "public"."mention_notifications" FOR UPDATE USING (("mentioned_user_id" = "auth"."uid"())) WITH CHECK (("mentioned_user_id" = "auth"."uid"()));



ALTER TABLE "public"."mentions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_user_access" ON "public"."hugo_messages" USING (("conversation_id" IN ( SELECT "c"."id"
   FROM "public"."hugo_conversations" "c"
  WHERE ("c"."user_id" = "auth"."uid"()))));



COMMENT ON POLICY "messages_user_access" ON "public"."hugo_messages" IS 'Users can CRUD hugo_messages in their conversations';



ALTER TABLE "public"."notification_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_sync_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_access_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."oauth_authorization_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plugin_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plugin_categories_public_read" ON "public"."plugin_categories" FOR SELECT USING (true);



ALTER TABLE "public"."plugin_executions_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plugin_installs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plugin_installs_owner_read" ON "public"."plugin_installs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "plugin_installs_owner_write" ON "public"."plugin_installs" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."plugin_marketplace_apps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plugin_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plugin_reviews_owner_write" ON "public"."plugin_reviews" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "plugin_reviews_public_read" ON "public"."plugin_reviews" FOR SELECT USING (true);



ALTER TABLE "public"."plugin_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plugin_versions_owner_write" ON "public"."plugin_versions" USING ((EXISTS ( SELECT 1
   FROM ("public"."plugins" "p"
     JOIN "public"."developers" "d" ON (("p"."developer_id" = "d"."id")))
  WHERE (("p"."id" = "plugin_versions"."plugin_id") AND ("d"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."plugins" "p"
     JOIN "public"."developers" "d" ON (("p"."developer_id" = "d"."id")))
  WHERE (("p"."id" = "plugin_versions"."plugin_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "plugin_versions_select_public_or_owner" ON "public"."plugin_versions" FOR SELECT USING ((("approved" = true) OR (EXISTS ( SELECT 1
   FROM ("public"."plugins" "p"
     JOIN "public"."developers" "d" ON (("p"."developer_id" = "d"."id")))
  WHERE (("p"."id" = "plugin_versions"."plugin_id") AND ("d"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."plugins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plugins_owner_insert" ON "public"."plugins" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."developers" "d"
  WHERE (("d"."id" = "plugins"."developer_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "plugins_owner_update" ON "public"."plugins" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."developers" "d"
  WHERE (("d"."id" = "plugins"."developer_id") AND ("d"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."developers" "d"
  WHERE (("d"."id" = "plugins"."developer_id") AND ("d"."user_id" = "auth"."uid"())))));



CREATE POLICY "plugins_select_public_or_owner" ON "public"."plugins" FOR SELECT USING ((("status" = 'approved'::"text") OR (EXISTS ( SELECT 1
   FROM "public"."developers" "d"
  WHERE (("d"."id" = "plugins"."developer_id") AND ("d"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."profile_memberships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_social_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_delete_policy" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "account_id"));



CREATE POLICY "profiles_insert_policy" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "account_id"));



CREATE POLICY "profiles_select_policy" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "profiles_update_policy" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "account_id")) WITH CHECK (("auth"."uid"() = "account_id"));



CREATE POLICY "public_read_published" ON "public"."entries" FOR SELECT TO "anon" USING ((("status" = 'published'::"public"."entry_status") AND ((COALESCE(("audience" ->> 'type'::"text"), 'public'::"text") = 'public'::"text") OR (("audience" ->> 'type'::"text") = 'everyone'::"text"))));



CREATE POLICY "public_read_published_auth" ON "public"."entries" FOR SELECT TO "authenticated" USING ((("status" = 'published'::"public"."entry_status") AND ((COALESCE(("audience" ->> 'type'::"text"), 'public'::"text") = 'public'::"text") OR (("audience" ->> 'type'::"text") = 'everyone'::"text"))));



CREATE POLICY "read_agreements" ON "public"."agreements" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "read_audiences" ON "public"."audiences" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "read_own_entries" ON "public"."entries" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "read_published_entries" ON "public"."entries" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'published'::"public"."entry_status") AND (("audience" IS NULL) OR (("audience" ->> 'type'::"text") = ANY (ARRAY['public'::"text", 'shared'::"text", 'following'::"text"])))));



ALTER TABLE "public"."response_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."section_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_can_insert_executions" ON "public"."plugin_executions_log" FOR INSERT WITH CHECK (((CURRENT_USER = 'service_role'::"name") AND ("user_id" IS NOT NULL) AND ("app_id" IS NOT NULL) AND ("session_id" IS NOT NULL) AND ("started_at" IS NOT NULL)));



CREATE POLICY "service_can_update_executions" ON "public"."plugin_executions_log" FOR UPDATE USING (((CURRENT_USER = 'service_role'::"name") AND ("ended_at" IS NULL))) WITH CHECK (("ended_at" IS NOT NULL));



CREATE POLICY "service_role_full_access_profiles" ON "public"."profiles" TO "service_role" USING (true);



ALTER TABLE "public"."sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telescope_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "topics_read_all" ON "public"."topics" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "um_user_access" ON "public"."hugo_user_memories" USING (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "um_user_access" ON "public"."hugo_user_memories" IS 'Users can CRUD their own memories';



CREATE POLICY "up_user_access" ON "public"."hugo_user_progress" USING (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "up_user_access" ON "public"."hugo_user_progress" IS 'Users can CRUD their own progress';



CREATE POLICY "update_own_entries" ON "public"."entries" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "user can read own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "user can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."user_app_installs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_app_installs_delete_policy" ON "public"."user_app_installs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_app_installs_insert_policy" ON "public"."user_app_installs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_app_installs_select_policy" ON "public"."user_app_installs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_app_installs_update_policy" ON "public"."user_app_installs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_contexts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_filter_presets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_filter_presets_owner_select" ON "public"."user_filter_presets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_filter_presets_owner_write" ON "public"."user_filter_presets" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_personalization_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_personalization_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_preferences_policy" ON "public"."user_preferences" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_prefs_insert_own" ON "public"."user_preferences" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "user_prefs_select_own" ON "public"."user_preferences" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_prefs_update_own" ON "public"."user_preferences" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_insert_own" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "user_profiles_select_auth" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "user_profiles_update_own" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."user_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_topic_engagements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_topic_engagements_delete_policy" ON "public"."user_topic_engagements" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_topic_engagements_insert_policy" ON "public"."user_topic_engagements" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "user_topic_engagements_select_policy" ON "public"."user_topic_engagements" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "user_topic_engagements_update_policy" ON "public"."user_topic_engagements" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_topic_intensities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_can_create_own_profiles" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "account_id"));



CREATE POLICY "users_can_delete_own_profiles" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "account_id"));



CREATE POLICY "users_can_delete_own_responses" ON "public"."responses" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_can_manage_own_contexts" ON "public"."user_contexts" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "users_can_manage_own_interactions" ON "public"."context_interactions" USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "target_user_id")));



CREATE POLICY "users_can_update_own_profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "account_id"));



CREATE POLICY "users_can_update_own_responses" ON "public"."responses" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "users_select_own" ON "public"."users" FOR SELECT USING (("id" = "auth"."uid"()));



COMMENT ON POLICY "users_select_own" ON "public"."users" IS 'Users can view their own profile';



CREATE POLICY "users_update_own" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"()));



COMMENT ON POLICY "users_update_own" ON "public"."users" IS 'Users can update their own profile';



CREATE POLICY "ute_insert_own" ON "public"."user_topic_engagements" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "ute_select_own" ON "public"."user_topic_engagements" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "ute_update_own" ON "public"."user_topic_engagements" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."webhook_delivery_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_buddy_appointment_access" ON "public"."context_interactions" FOR SELECT USING ((("context" = 'oo-work-buddy'::"text") AND ("type" = 'appointment'::"text") AND (("auth"."uid"() = "user_id") OR ("auth"."uid"() = "target_user_id")) AND ("public"."get_app_context"() = 'oo-work-buddy'::"text")));



CREATE POLICY "Allow all access to session_participants" ON "work_buddy"."session_participants" TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anonymous delete availability" ON "work_buddy"."availability_slots" FOR DELETE TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow anonymous insert availability" ON "work_buddy"."availability_slots" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "Allow anonymous select availability" ON "work_buddy"."availability_slots" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow anonymous update availability" ON "work_buddy"."availability_slots" FOR UPDATE TO "authenticated", "anon" USING (true) WITH CHECK (true);



CREATE POLICY "Users can access session metadata for their sessions" ON "work_buddy"."session_metadata" TO "authenticated" USING (true);



CREATE POLICY "Users can access their own analytics" ON "work_buddy"."user_analytics" TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Users can manage their own availability slots" ON "work_buddy"."availability_slots" TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Users can manage their own calendar connections" ON "work_buddy"."calendar_connections" TO "authenticated" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



CREATE POLICY "Users can rate others and see their own ratings" ON "work_buddy"."chemistry_ratings" TO "authenticated" USING ((("rater_user_id" = ("auth"."jwt"() ->> 'sub'::"text")) OR ("rated_user_id" = ("auth"."jwt"() ->> 'sub'::"text"))));



ALTER TABLE "work_buddy"."availability_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "availability_slots_own_data" ON "work_buddy"."availability_slots" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



ALTER TABLE "work_buddy"."chemistry_ratings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chemistry_ratings_access" ON "work_buddy"."chemistry_ratings" USING ((("rater_user_id" = ("auth"."jwt"() ->> 'sub'::"text")) OR ("rated_user_id" = ("auth"."jwt"() ->> 'sub'::"text"))));



ALTER TABLE "work_buddy"."session_metadata" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_metadata_access" ON "work_buddy"."session_metadata" USING (true);



ALTER TABLE "work_buddy"."session_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "session_participants_authenticated_access" ON "work_buddy"."session_participants" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "work_buddy"."user_analytics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_analytics_own_data" ON "work_buddy"."user_analytics" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



ALTER TABLE "work_buddy"."work_buddy_interaction_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_buddy_types_read_only" ON "work_buddy"."work_buddy_interaction_types" FOR SELECT USING (true);



ALTER TABLE "work_buddy"."work_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_sessions_authenticated_access" ON "work_buddy"."work_sessions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "workbuddy_settings_own_data" ON "work_buddy"."workbuddy_user_settings" USING (("user_id" = ("auth"."jwt"() ->> 'sub'::"text")));



ALTER TABLE "work_buddy"."workbuddy_user_settings" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "hugo_ai" TO "authenticated";
GRANT USAGE ON SCHEMA "hugo_ai" TO "service_role";



GRANT USAGE ON SCHEMA "hugo_career" TO "authenticated";
GRANT USAGE ON SCHEMA "hugo_career" TO "service_role";



GRANT USAGE ON SCHEMA "hugo_love" TO "authenticated";
GRANT USAGE ON SCHEMA "hugo_love" TO "service_role";



GRANT USAGE ON SCHEMA "live_mixers" TO "authenticated";
GRANT USAGE ON SCHEMA "live_mixers" TO "service_role";



GRANT USAGE ON SCHEMA "oriva_platform" TO "authenticated";
GRANT USAGE ON SCHEMA "oriva_platform" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "work_buddy" TO "authenticated";
GRANT USAGE ON SCHEMA "work_buddy" TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_out"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_send"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("path") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";














































































































































































GRANT ALL ON FUNCTION "live_mixers"."create_default_mixer_notification_rules"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "live_mixers"."create_default_mixer_notification_rules"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."_label_from_slug"("slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_label_from_slug"("slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_label_from_slug"("slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_creator_as_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_creator_as_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_creator_as_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."add_group_member"("group_uuid" "uuid", "user_uuid" "uuid", "member_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_group_member"("group_uuid" "uuid", "user_uuid" "uuid", "member_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_group_member"("group_uuid" "uuid", "user_uuid" "uuid", "member_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."addauth"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_plugin_version_tx"("in_version_id" "uuid", "in_plugin_id" "uuid", "in_candidate_version" "text", "in_update_latest" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_plugin_version_tx"("in_version_id" "uuid", "in_plugin_id" "uuid", "in_candidate_version" "text", "in_update_latest" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."approve_plugin_version_tx"("in_version_id" "uuid", "in_plugin_id" "uuid", "in_candidate_version" "text", "in_update_latest" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_plugin_version_tx"("in_version_id" "uuid", "in_plugin_id" "uuid", "in_candidate_version" "text", "in_update_latest" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_learned_intensity"("positive_count" integer, "negative_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_learned_intensity"("positive_count" integer, "negative_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_learned_intensity"("positive_count" integer, "negative_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_traction_score"("response_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_traction_score"("response_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_traction_score"("response_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_receive_opportunity"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_receive_opportunity"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_receive_opportunity"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_user_access_group"("group_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_user_access_group"("group_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_user_access_group"("group_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clean_expired_personalization_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."clean_expired_personalization_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."clean_expired_personalization_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_oauth_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_oauth_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_oauth_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_mixer_notification_rules"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_mixer_notification_rules"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_mixer_notification_rules"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_notification_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_notification_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_notification_preferences"() TO "service_role";
GRANT ALL ON FUNCTION "public"."create_default_notification_preferences"() TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."create_mention_notifications_for_entry"("entry_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_mention_notifications_for_entry"("entry_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_mention_notifications_for_entry"("entry_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_context"("p_user_id" "uuid", "p_context" "text", "p_bio" "text", "p_traits" "jsonb", "p_preferences" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_context"("p_user_id" "uuid", "p_context" "text", "p_bio" "text", "p_traits" "jsonb", "p_preferences" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_context"("p_user_id" "uuid", "p_context" "text", "p_bio" "text", "p_traits" "jsonb", "p_preferences" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube"("public"."cube", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_cmp"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_contained"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_contains"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_coord_llur"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_dim"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_distance"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_enlarge"("public"."cube", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_eq"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ge"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_gt"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_inter"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_is_point"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_le"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ll_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_lt"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ne"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_overlap"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_size"("public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_subset"("public"."cube", integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_union"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cube_ur_coord"("public"."cube", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."debug_auth_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."debug_auth_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."debug_auth_state"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decay_memory_importance"() TO "anon";
GRANT ALL ON FUNCTION "public"."decay_memory_importance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decay_memory_importance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_install_count"("app_id_in" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_install_count"("app_id_in" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_install_count"("app_id_in" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_tag_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_tag_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_tag_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."distance_chebyshev"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "postgres";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "anon";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "authenticated";
GRANT ALL ON FUNCTION "public"."distance_taxicab"("public"."cube", "public"."cube") TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."earth"() TO "postgres";
GRANT ALL ON FUNCTION "public"."earth"() TO "anon";
GRANT ALL ON FUNCTION "public"."earth"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gc_to_sec"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth_box"("public"."earth", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sec_to_gc"(double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."earth_distance"("public"."earth", "public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_topic"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_topic"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_topic"("p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."exec_sql"("sql_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_sql"("sql_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_get_chat_context"("app_id_param" "text", "user_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_get_chat_context"("app_id_param" "text", "user_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_get_chat_context"("app_id_param" "text", "user_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_mentions_from_content"("content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."extract_topics_from_content"("entry_title" "text", "entry_content" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."extract_topics_from_content"("entry_title" "text", "entry_content" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."extract_topics_from_content"("entry_title" "text", "entry_content" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_similar_entries_by_id"("source_entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."find_similar_entries_by_id"("source_entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_similar_entries_by_id"("source_entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_consistent"("internal", "public"."cube", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_distance"("internal", "public"."cube", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_same"("public"."cube", "public"."cube", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."g_cube_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_oauth_credentials"("app_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_oauth_credentials"("app_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_oauth_credentials"("app_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "anon";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geo_distance"("point", "point") TO "service_role";



GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_app_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_app_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_app_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_app_schema"("p_app_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_app_schema"("p_app_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_app_schema"("p_app_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_developer_verification_values"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_developer_verification_values"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_developer_verification_values"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_entries_needing_embeddings"("batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_entries_needing_embeddings"("batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_entries_needing_embeddings"("batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_group_member_count"("group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_group_member_count"("group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_group_member_count"("group_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";
GRANT ALL ON TABLE "public"."user_preferences" TO "supabase_auth_admin";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticator";



GRANT ALL ON FUNCTION "public"."get_or_create_user_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_user_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_user_preferences"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_plugin_permission_values"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_plugin_permission_values"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_plugin_permission_values"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_plugin_status_values"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_plugin_status_values"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_plugin_status_values"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_response_thread"("section_entry_id_param" "uuid", "max_depth" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_response_thread"("section_entry_id_param" "uuid", "max_depth" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_response_thread"("section_entry_id_param" "uuid", "max_depth" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_review_rating_values"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_review_rating_values"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_review_rating_values"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_trending_apps"("days_back" integer, "app_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_trending_apps"("days_back" integer, "app_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_trending_apps"("days_back" integer, "app_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_active_profiles"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_active_profiles"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_active_profiles"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_active_push_tokens"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_active_push_tokens"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_active_push_tokens"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_default_profile"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_default_profile"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_default_profile"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_group_role"("group_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_group_role"("group_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_group_role"("group_id" "uuid", "user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_topic_weights"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_topic_weights"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_topic_weights"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "postgres";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "anon";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "supabase_auth_admin";



GRANT ALL ON FUNCTION "public"."handle_new_user_complete"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_complete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_complete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[], "semantic_weight" double precision, "keyword_weight" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[], "semantic_weight" double precision, "keyword_weight" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hybrid_search"("query_text" "text", "query_embedding" "public"."vector", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[], "semantic_weight" double precision, "keyword_weight" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_api_key_usage"("key_hash_param" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_api_key_usage"("key_hash_param" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_api_key_usage"("key_hash_param" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_install_count"("app_id_in" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_install_count"("app_id_in" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_install_count"("app_id_in" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ke_access"("entry_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ke_access"("entry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ke_access"("entry_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_opportunity_counter"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_opportunity_counter"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_opportunity_counter"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_tag_usage"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_tag_usage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_tag_usage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_group_member"("p_user_id" "uuid", "p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_group_member"("p_user_id" "uuid", "p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_group_member"("p_user_id" "uuid", "p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_user_member_of_group"("p_user_id" "uuid", "p_group_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_user_member_of_group"("p_user_id" "uuid", "p_group_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_user_member_of_group"("p_user_id" "uuid", "p_group_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."latitude"("public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ll_to_earth"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_context_interaction"("p_user_id" "uuid", "p_context" "text", "p_type" "text", "p_data" "jsonb", "p_target_user_id" "uuid", "p_scheduled_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."log_context_interaction"("p_user_id" "uuid", "p_context" "text", "p_type" "text", "p_data" "jsonb", "p_target_user_id" "uuid", "p_scheduled_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_context_interaction"("p_user_id" "uuid", "p_context" "text", "p_type" "text", "p_data" "jsonb", "p_target_user_id" "uuid", "p_scheduled_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "postgres";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "anon";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "authenticated";
GRANT ALL ON FUNCTION "public"."longitude"("public"."earth") TO "service_role";



GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "postgres";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."migrate_anon_entries"("p_entry_ids" "uuid"[], "p_dry_run" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."migrate_anon_entries"("p_entry_ids" "uuid"[], "p_dry_run" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_anon_entries"("p_entry_ids" "uuid"[], "p_dry_run" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_anon_entries"("p_entry_ids" "uuid"[], "p_dry_run" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."migrate_existing_data_to_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."migrate_existing_data_to_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."migrate_existing_data_to_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."parse_content_headings"("content_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."parse_content_headings"("content_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parse_content_headings"("content_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_group_member"("group_uuid" "uuid", "user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_group_member"("group_uuid" "uuid", "user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_group_member"("group_uuid" "uuid", "user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_plugins"("q" "text", "category_filter" "uuid", "status_filter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_plugins"("q" "text", "category_filter" "uuid", "status_filter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_plugins"("q" "text", "category_filter" "uuid", "status_filter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."semantic_similarity"("query_embedding" "public"."vector", "entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."semantic_similarity"("query_embedding" "public"."vector", "entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."semantic_similarity"("query_embedding" "public"."vector", "entry_id" "uuid", "similarity_threshold" double precision, "result_limit" integer, "topic_filter" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_app_context"("context_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_app_context"("context_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_app_context"("context_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_schema_path"("schema_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_schema_path"("schema_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_schema_path"("schema_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_group_member_timestamps"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_group_member_timestamps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_group_member_timestamps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_mention_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_mention_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_mention_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_app_rating"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_app_rating"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_app_rating"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_collaboration_traits"("p_user_id" "uuid", "p_interaction_type" "text", "p_rating" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_collaboration_traits"("p_user_id" "uuid", "p_interaction_type" "text", "p_rating" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_collaboration_traits"("p_user_id" "uuid", "p_interaction_type" "text", "p_rating" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_collection_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_collection_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_collection_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_content_topics_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_content_topics_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_content_topics_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_developer_api_keys_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_developer_api_keys_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_developer_api_keys_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_entry_embedding"("entry_id" "uuid", "title_emb" "public"."vector", "content_emb" "public"."vector", "combined_emb" "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."update_entry_embedding"("entry_id" "uuid", "title_emb" "public"."vector", "content_emb" "public"."vector", "combined_emb" "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_entry_embedding"("entry_id" "uuid", "title_emb" "public"."vector", "content_emb" "public"."vector", "combined_emb" "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_entry_relation_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_entry_relation_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_entry_relation_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_entry_response_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_entry_response_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_entry_response_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_entry_task_flags"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_entry_task_flags"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_entry_task_flags"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_historical_context_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_historical_context_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_historical_context_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_install_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_install_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_install_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_kb_usage_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_kb_usage_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_kb_usage_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ke_search_vector"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ke_search_vector"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ke_search_vector"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_response_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_response_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_response_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tag_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_tag_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tag_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_thread_path"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_thread_path"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_thread_path"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_topic_engagements"("p_topics" "text"[], "p_kind" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_topic_engagements"("p_topics" "text"[], "p_kind" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_topic_engagements"("p_topics" "text"[], "p_kind" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_transaction_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_transaction_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_transaction_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_oauth_token"("token_param" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_oauth_token"("token_param" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_oauth_token"("token_param" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_plugin_status_transition"("old_status" "public"."plugin_status_enum", "new_status" "public"."plugin_status_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_plugin_status_transition"("old_status" "public"."plugin_status_enum", "new_status" "public"."plugin_status_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_plugin_status_transition"("old_status" "public"."plugin_status_enum", "new_status" "public"."plugin_status_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "work_buddy"."create_work_buddy_profile"("p_user_id" "uuid", "p_bio" "text", "p_working_hours" "jsonb", "p_collaboration_preferences" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "work_buddy"."create_work_buddy_profile"("p_user_id" "uuid", "p_bio" "text", "p_working_hours" "jsonb", "p_collaboration_preferences" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "work_buddy"."schedule_work_buddy_appointment"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_appointment_data" "jsonb", "p_scheduled_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "work_buddy"."schedule_work_buddy_appointment"("p_user_id" "uuid", "p_target_user_id" "uuid", "p_appointment_data" "jsonb", "p_scheduled_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";















GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "hugo_ai"."insights" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "hugo_ai"."sessions" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "hugo_career"."profiles" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "hugo_love"."ice_breakers" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "hugo_love"."profiles" TO "authenticated";



GRANT ALL ON TABLE "live_mixers"."category_stars" TO "anon";
GRANT ALL ON TABLE "live_mixers"."category_stars" TO "authenticated";
GRANT ALL ON TABLE "live_mixers"."category_stars" TO "service_role";



GRANT ALL ON TABLE "live_mixers"."mixer_event_metadata" TO "anon";
GRANT ALL ON TABLE "live_mixers"."mixer_event_metadata" TO "authenticated";
GRANT ALL ON TABLE "live_mixers"."mixer_event_metadata" TO "service_role";



GRANT ALL ON TABLE "live_mixers"."mixer_notification_rules" TO "anon";
GRANT ALL ON TABLE "live_mixers"."mixer_notification_rules" TO "authenticated";
GRANT ALL ON TABLE "live_mixers"."mixer_notification_rules" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "live_mixers"."mixer_registration_metadata" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "live_mixers"."mixer_registration_metadata" TO "service_role";



GRANT ALL ON TABLE "live_mixers"."mixer_user_preferences" TO "anon";
GRANT ALL ON TABLE "live_mixers"."mixer_user_preferences" TO "authenticated";
GRANT ALL ON TABLE "live_mixers"."mixer_user_preferences" TO "service_role";



GRANT SELECT ON TABLE "oriva_platform"."apps" TO "authenticated";



GRANT SELECT ON TABLE "oriva_platform"."extraction_manifests" TO "authenticated";



GRANT SELECT ON TABLE "oriva_platform"."user_app_access" TO "authenticated";



GRANT SELECT ON TABLE "oriva_platform"."users" TO "authenticated";



GRANT ALL ON TABLE "public"."agreement_participants" TO "anon";
GRANT ALL ON TABLE "public"."agreement_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."agreement_participants" TO "service_role";



GRANT ALL ON TABLE "public"."agreements" TO "anon";
GRANT ALL ON TABLE "public"."agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."agreements" TO "service_role";



GRANT ALL ON TABLE "public"."ai_conversations" TO "anon";
GRANT ALL ON TABLE "public"."ai_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_messages" TO "service_role";



GRANT ALL ON TABLE "public"."app_api_usage" TO "anon";
GRANT ALL ON TABLE "public"."app_api_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."app_api_usage" TO "service_role";



GRANT ALL ON TABLE "public"."app_oauth_credentials" TO "anon";
GRANT ALL ON TABLE "public"."app_oauth_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."app_oauth_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."app_reviews" TO "anon";
GRANT ALL ON TABLE "public"."app_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."app_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."app_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."app_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."app_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."audiences" TO "anon";
GRANT ALL ON TABLE "public"."audiences" TO "authenticated";
GRANT ALL ON TABLE "public"."audiences" TO "service_role";



GRANT ALL ON TABLE "public"."collection_entries" TO "anon";
GRANT ALL ON TABLE "public"."collection_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_entries" TO "service_role";



GRANT ALL ON TABLE "public"."collection_tags" TO "anon";
GRANT ALL ON TABLE "public"."collection_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_tags" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."content_collections" TO "anon";
GRANT ALL ON TABLE "public"."content_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."content_collections" TO "service_role";



GRANT ALL ON TABLE "public"."content_topics" TO "anon";
GRANT ALL ON TABLE "public"."content_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."content_topics" TO "service_role";



GRANT ALL ON TABLE "public"."context_interactions" TO "anon";
GRANT ALL ON TABLE "public"."context_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."context_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."context_settings" TO "anon";
GRANT ALL ON TABLE "public"."context_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."context_settings" TO "service_role";



GRANT ALL ON TABLE "public"."context_usage_stats" TO "anon";
GRANT ALL ON TABLE "public"."context_usage_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."context_usage_stats" TO "service_role";



GRANT ALL ON TABLE "public"."developer_api_keys" TO "anon";
GRANT ALL ON TABLE "public"."developer_api_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."developer_api_keys" TO "service_role";



GRANT ALL ON TABLE "public"."developers" TO "anon";
GRANT ALL ON TABLE "public"."developers" TO "authenticated";
GRANT ALL ON TABLE "public"."developers" TO "service_role";



GRANT ALL ON TABLE "public"."dm_conversations" TO "anon";
GRANT ALL ON TABLE "public"."dm_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."dm_messages" TO "anon";
GRANT ALL ON TABLE "public"."dm_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_messages" TO "service_role";



GRANT ALL ON TABLE "public"."entries" TO "anon";
GRANT ALL ON TABLE "public"."entries" TO "authenticated";
GRANT ALL ON TABLE "public"."entries" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."responses" TO "anon";
GRANT ALL ON TABLE "public"."responses" TO "authenticated";
GRANT ALL ON TABLE "public"."responses" TO "service_role";



GRANT ALL ON TABLE "public"."entry_engagement" TO "anon";
GRANT ALL ON TABLE "public"."entry_engagement" TO "authenticated";
GRANT ALL ON TABLE "public"."entry_engagement" TO "service_role";



GRANT ALL ON TABLE "public"."entry_historical_context" TO "anon";
GRANT ALL ON TABLE "public"."entry_historical_context" TO "authenticated";
GRANT ALL ON TABLE "public"."entry_historical_context" TO "service_role";



GRANT ALL ON TABLE "public"."entry_relations" TO "anon";
GRANT ALL ON TABLE "public"."entry_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."entry_relations" TO "service_role";



GRANT ALL ON TABLE "public"."entry_relationships" TO "anon";
GRANT ALL ON TABLE "public"."entry_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."entry_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."entry_tags" TO "anon";
GRANT ALL ON TABLE "public"."entry_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."entry_tags" TO "service_role";



GRANT ALL ON TABLE "public"."entry_topics" TO "anon";
GRANT ALL ON TABLE "public"."entry_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."entry_topics" TO "service_role";



GRANT ALL ON TABLE "public"."event_categories" TO "anon";
GRANT ALL ON TABLE "public"."event_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."event_categories" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."expo_push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."expo_push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."expo_push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."feed_items" TO "anon";
GRANT ALL ON TABLE "public"."feed_items" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_items" TO "service_role";



GRANT ALL ON TABLE "public"."group_members" TO "anon";
GRANT ALL ON TABLE "public"."group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."group_members" TO "service_role";



GRANT ALL ON TABLE "public"."group_notice_list" TO "anon";
GRANT ALL ON TABLE "public"."group_notice_list" TO "authenticated";
GRANT ALL ON TABLE "public"."group_notice_list" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."groups_new" TO "anon";
GRANT ALL ON TABLE "public"."groups_new" TO "authenticated";
GRANT ALL ON TABLE "public"."groups_new" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_analysis_results" TO "anon";
GRANT ALL ON TABLE "public"."hugo_analysis_results" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_analysis_results" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_apps" TO "anon";
GRANT ALL ON TABLE "public"."hugo_apps" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_apps" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_collaboration_memory" TO "anon";
GRANT ALL ON TABLE "public"."hugo_collaboration_memory" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_collaboration_memory" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_conversations" TO "anon";
GRANT ALL ON TABLE "public"."hugo_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_knowledge_base" TO "anon";
GRANT ALL ON TABLE "public"."hugo_knowledge_base" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_knowledge_base" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_knowledge_bases" TO "anon";
GRANT ALL ON TABLE "public"."hugo_knowledge_bases" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_knowledge_bases" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_knowledge_entries" TO "anon";
GRANT ALL ON TABLE "public"."hugo_knowledge_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_knowledge_entries" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_learning_data" TO "anon";
GRANT ALL ON TABLE "public"."hugo_learning_data" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_learning_data" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_messages" TO "anon";
GRANT ALL ON TABLE "public"."hugo_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_messages" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_personality_schemas" TO "anon";
GRANT ALL ON TABLE "public"."hugo_personality_schemas" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_personality_schemas" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_user_insights" TO "anon";
GRANT ALL ON TABLE "public"."hugo_user_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_user_insights" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_user_memories" TO "anon";
GRANT ALL ON TABLE "public"."hugo_user_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_user_memories" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."hugo_user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."hugo_user_progress" TO "anon";
GRANT ALL ON TABLE "public"."hugo_user_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."hugo_user_progress" TO "service_role";



GRANT ALL ON TABLE "public"."markdown_files" TO "anon";
GRANT ALL ON TABLE "public"."markdown_files" TO "authenticated";
GRANT ALL ON TABLE "public"."markdown_files" TO "service_role";



GRANT ALL ON TABLE "public"."markdown_sections" TO "anon";
GRANT ALL ON TABLE "public"."markdown_sections" TO "authenticated";
GRANT ALL ON TABLE "public"."markdown_sections" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_apps" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_apps" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_apps" TO "service_role";



GRANT ALL ON TABLE "public"."mention_notifications" TO "anon";
GRANT ALL ON TABLE "public"."mention_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."mention_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."mentions" TO "anon";
GRANT ALL ON TABLE "public"."mentions" TO "authenticated";
GRANT ALL ON TABLE "public"."mentions" TO "service_role";



GRANT ALL ON TABLE "public"."notification_counters" TO "anon";
GRANT ALL ON TABLE "public"."notification_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_counters" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."notification_delivery_metrics" TO "anon";
GRANT ALL ON TABLE "public"."notification_delivery_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_delivery_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";
GRANT ALL ON TABLE "public"."notification_preferences" TO "supabase_auth_admin";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticator";



GRANT ALL ON TABLE "public"."notification_state" TO "anon";
GRANT ALL ON TABLE "public"."notification_state" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_state" TO "service_role";



GRANT ALL ON TABLE "public"."notification_sync_log" TO "anon";
GRANT ALL ON TABLE "public"."notification_sync_log" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_sync_log" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_access_tokens" TO "anon";
GRANT ALL ON TABLE "public"."oauth_access_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_access_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_authorization_codes" TO "anon";
GRANT ALL ON TABLE "public"."oauth_authorization_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_authorization_codes" TO "service_role";



GRANT ALL ON TABLE "public"."platform_events" TO "anon";
GRANT ALL ON TABLE "public"."platform_events" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_events" TO "service_role";



GRANT ALL ON TABLE "public"."platform_notifications" TO "anon";
GRANT ALL ON TABLE "public"."platform_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."plugin_categories" TO "anon";
GRANT ALL ON TABLE "public"."plugin_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin_categories" TO "service_role";



GRANT ALL ON TABLE "public"."plugin_executions_log" TO "anon";
GRANT ALL ON TABLE "public"."plugin_executions_log" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin_executions_log" TO "service_role";



GRANT ALL ON TABLE "public"."plugin_installs" TO "anon";
GRANT ALL ON TABLE "public"."plugin_installs" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin_installs" TO "service_role";



GRANT ALL ON TABLE "public"."plugin_marketplace_apps" TO "anon";
GRANT ALL ON TABLE "public"."plugin_marketplace_apps" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin_marketplace_apps" TO "service_role";



GRANT ALL ON TABLE "public"."plugin_reviews" TO "anon";
GRANT ALL ON TABLE "public"."plugin_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."plugin_versions" TO "anon";
GRANT ALL ON TABLE "public"."plugin_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."plugin_versions" TO "service_role";



GRANT ALL ON TABLE "public"."plugins" TO "anon";
GRANT ALL ON TABLE "public"."plugins" TO "authenticated";
GRANT ALL ON TABLE "public"."plugins" TO "service_role";



GRANT ALL ON TABLE "public"."profile_memberships" TO "anon";
GRANT ALL ON TABLE "public"."profile_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."profile_social_links" TO "anon";
GRANT ALL ON TABLE "public"."profile_social_links" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_social_links" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT ALL ON TABLE "public"."profiles" TO "supabase_auth_admin";
GRANT ALL ON TABLE "public"."profiles" TO "authenticator";



GRANT ALL ON TABLE "public"."response_interactions" TO "anon";
GRANT ALL ON TABLE "public"."response_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."response_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."response_votes" TO "anon";
GRANT ALL ON TABLE "public"."response_votes" TO "authenticated";
GRANT ALL ON TABLE "public"."response_votes" TO "service_role";



GRANT ALL ON TABLE "public"."section_responses" TO "anon";
GRANT ALL ON TABLE "public"."section_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."section_responses" TO "service_role";



GRANT ALL ON TABLE "public"."sync_failures" TO "anon";
GRANT ALL ON TABLE "public"."sync_failures" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_failures" TO "service_role";



GRANT ALL ON TABLE "public"."sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."telescope_sessions" TO "anon";
GRANT ALL ON TABLE "public"."telescope_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."telescope_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."templates" TO "anon";
GRANT ALL ON TABLE "public"."templates" TO "authenticated";
GRANT ALL ON TABLE "public"."templates" TO "service_role";



GRANT ALL ON TABLE "public"."topics" TO "anon";
GRANT ALL ON TABLE "public"."topics" TO "authenticated";
GRANT ALL ON TABLE "public"."topics" TO "service_role";



GRANT ALL ON TABLE "public"."user_app_installs" TO "anon";
GRANT ALL ON TABLE "public"."user_app_installs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_app_installs" TO "service_role";



GRANT ALL ON TABLE "public"."user_contexts" TO "anon";
GRANT ALL ON TABLE "public"."user_contexts" TO "authenticated";
GRANT ALL ON TABLE "public"."user_contexts" TO "service_role";



GRANT ALL ON TABLE "public"."user_context_summary" TO "anon";
GRANT ALL ON TABLE "public"."user_context_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."user_context_summary" TO "service_role";



GRANT ALL ON TABLE "public"."user_filter_presets" TO "anon";
GRANT ALL ON TABLE "public"."user_filter_presets" TO "authenticated";
GRANT ALL ON TABLE "public"."user_filter_presets" TO "service_role";



GRANT ALL ON TABLE "public"."user_personalization_cache" TO "anon";
GRANT ALL ON TABLE "public"."user_personalization_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."user_personalization_cache" TO "service_role";



GRANT ALL ON TABLE "public"."user_personalization_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_personalization_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_personalization_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";
GRANT ALL ON TABLE "public"."user_profiles" TO "supabase_auth_admin";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticator";



GRANT ALL ON TABLE "public"."user_registrations" TO "anon";
GRANT ALL ON TABLE "public"."user_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."user_topic_engagements" TO "anon";
GRANT ALL ON TABLE "public"."user_topic_engagements" TO "authenticated";
GRANT ALL ON TABLE "public"."user_topic_engagements" TO "service_role";



GRANT ALL ON TABLE "public"."user_topic_intensities" TO "anon";
GRANT ALL ON TABLE "public"."user_topic_intensities" TO "authenticated";
GRANT ALL ON TABLE "public"."user_topic_intensities" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";
GRANT ALL ON TABLE "public"."users" TO "supabase_auth_admin";
GRANT ALL ON TABLE "public"."users" TO "authenticator";



GRANT ALL ON TABLE "public"."webhook_delivery_log" TO "anon";
GRANT ALL ON TABLE "public"."webhook_delivery_log" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_delivery_log" TO "service_role";









GRANT ALL ON TABLE "work_buddy"."availability_slots" TO "anon";
GRANT ALL ON TABLE "work_buddy"."availability_slots" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."availability_slots" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "work_buddy"."calendar_connections" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "work_buddy"."calendar_connections" TO "service_role";



GRANT ALL ON TABLE "work_buddy"."chemistry_ratings" TO "anon";
GRANT ALL ON TABLE "work_buddy"."chemistry_ratings" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."chemistry_ratings" TO "service_role";



GRANT ALL ON TABLE "work_buddy"."session_metadata" TO "anon";
GRANT ALL ON TABLE "work_buddy"."session_metadata" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."session_metadata" TO "service_role";



GRANT ALL ON TABLE "work_buddy"."session_participants" TO "anon";
GRANT ALL ON TABLE "work_buddy"."session_participants" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."session_participants" TO "service_role";



GRANT ALL ON TABLE "work_buddy"."user_analytics" TO "anon";
GRANT ALL ON TABLE "work_buddy"."user_analytics" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."user_analytics" TO "service_role";



GRANT ALL ON TABLE "work_buddy"."work_appointments" TO "anon";
GRANT ALL ON TABLE "work_buddy"."work_appointments" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."work_appointments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "work_buddy"."work_buddy_appointments" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "work_buddy"."work_buddy_appointments" TO "service_role";



GRANT ALL ON TABLE "work_buddy"."work_buddy_interaction_types" TO "anon";
GRANT ALL ON TABLE "work_buddy"."work_buddy_interaction_types" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."work_buddy_interaction_types" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "work_buddy"."work_buddy_user_dashboard" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "work_buddy"."work_buddy_user_dashboard" TO "service_role";



GRANT ALL ON TABLE "work_buddy"."work_sessions" TO "anon";
GRANT ALL ON TABLE "work_buddy"."work_sessions" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."work_sessions" TO "service_role";



GRANT ALL ON TABLE "work_buddy"."workbuddy_user_settings" TO "anon";
GRANT ALL ON TABLE "work_buddy"."workbuddy_user_settings" TO "authenticated";
GRANT ALL ON TABLE "work_buddy"."workbuddy_user_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "hugo_ai" GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "hugo_ai" GRANT USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "hugo_career" GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "hugo_career" GRANT USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "hugo_love" GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "hugo_love" GRANT USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "live_mixers" GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "live_mixers" GRANT USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "oriva_platform" GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "oriva_platform" GRANT USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "work_buddy" GRANT USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "work_buddy" GRANT USAGE ON SEQUENCES TO "service_role";



























