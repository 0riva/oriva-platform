-- Extraction Manifest Schema for Data Export
-- Task: T004
-- Created: 2025-01-02
--
-- Creates extraction_manifests table in oriva_platform schema for managing
-- user data extraction requests (GDPR Art. 20 - Right to Data Portability).
--
-- Extraction manifests have 7-day retention for download links.

BEGIN;

-- =============================================================================
-- EXTRACTION MANIFESTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS oriva_platform.extraction_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
    source_app_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'executing', 'completed', 'failed')),
    target_format TEXT NOT NULL CHECK (target_format IN ('json', 'csv')),
    include_schemas TEXT[] DEFAULT ARRAY['profiles', 'sessions', 'insights'],
    data_summary JSONB DEFAULT '{}',
    download_url TEXT,
    download_expires_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_extraction_manifests_user_id ON oriva_platform.extraction_manifests(user_id);
CREATE INDEX idx_extraction_manifests_status ON oriva_platform.extraction_manifests(status);
CREATE INDEX idx_extraction_manifests_created_at ON oriva_platform.extraction_manifests(created_at);
CREATE INDEX idx_extraction_manifests_expires_at ON oriva_platform.extraction_manifests(expires_at);

COMMENT ON TABLE oriva_platform.extraction_manifests IS 'User data extraction requests for GDPR compliance';
COMMENT ON COLUMN oriva_platform.extraction_manifests.status IS 'Extraction status: prepared, executing, completed, failed';
COMMENT ON COLUMN oriva_platform.extraction_manifests.target_format IS 'Export format: json or csv';
COMMENT ON COLUMN oriva_platform.extraction_manifests.include_schemas IS 'Array of schema types to include in extraction';
COMMENT ON COLUMN oriva_platform.extraction_manifests.data_summary IS 'Summary of extracted data: record counts, size, etc.';
COMMENT ON COLUMN oriva_platform.extraction_manifests.download_url IS 'Signed URL for downloading extracted data';
COMMENT ON COLUMN oriva_platform.extraction_manifests.expires_at IS '7-day expiration for manifest and download link';

-- =============================================================================
-- EXTRACTION HELPER FUNCTIONS
-- =============================================================================

-- Function to prepare extraction manifest
CREATE OR REPLACE FUNCTION oriva_platform.prepare_extraction_manifest(
    p_user_id UUID,
    p_source_app_id TEXT,
    p_target_format TEXT DEFAULT 'json',
    p_include_schemas TEXT[] DEFAULT ARRAY['profiles', 'sessions', 'insights']
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION oriva_platform.prepare_extraction_manifest IS 'Create extraction manifest with data summary';

-- Function to mark extraction as completed
CREATE OR REPLACE FUNCTION oriva_platform.complete_extraction(
    p_manifest_id UUID,
    p_download_url TEXT
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION oriva_platform.complete_extraction IS 'Mark extraction as completed with download URL';

-- Function to mark extraction as failed
CREATE OR REPLACE FUNCTION oriva_platform.fail_extraction(
    p_manifest_id UUID,
    p_error_message TEXT
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION oriva_platform.fail_extraction IS 'Mark extraction as failed with error message';

-- =============================================================================
-- CLEANUP JOB: Delete Expired Manifests
-- =============================================================================

-- Function to clean up expired extraction manifests
CREATE OR REPLACE FUNCTION oriva_platform.cleanup_expired_manifests()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM oriva_platform.extraction_manifests
    WHERE expires_at < NOW();

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION oriva_platform.cleanup_expired_manifests IS 'Delete extraction manifests older than 7 days';

-- Note: Schedule this function to run daily using pg_cron or external scheduler:
-- SELECT cron.schedule('cleanup-extraction-manifests', '0 2 * * *',
--   'SELECT oriva_platform.cleanup_expired_manifests()');

COMMIT;
