-- =============================================================================
-- Test Data Seed Script for Oriva Multi-Tenant Platform
-- =============================================================================
-- Purpose: Populate database with test data for contract testing
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: Seed Users (oriva_platform.users)
-- =============================================================================

INSERT INTO oriva_platform.users (id, email, full_name, auth_provider, created_at, updated_at)
VALUES
  -- Test User 1: Hugo Love user
  ('00000000-0000-0000-0000-000000000001', 'test1@example.com', 'Alice Johnson', 'oriva_sso', NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day'),

  -- Test User 2: Multi-app user (Hugo Love + Hugo Career)
  ('00000000-0000-0000-0000-000000000002', 'test2@example.com', 'Bob Smith', 'oriva_sso', NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 hours'),

  -- Test User 3: Hugo Career only
  ('00000000-0000-0000-0000-000000000003', 'test3@example.com', 'Carol Williams', 'oriva_sso', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 hours'),

  -- Test User 4: Admin user
  ('00000000-0000-0000-0000-000000000099', 'admin@oriva.io', 'Admin User', 'oriva_sso', NOW() - INTERVAL '60 days', NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STEP 2: Seed Apps (oriva_platform.apps)
-- =============================================================================

INSERT INTO oriva_platform.apps (id, app_id, name, description, schema_name, status, settings, created_at, updated_at)
VALUES
  -- Hugo Love
  ('00000000-0000-0000-0000-000000000011', 'hugo_love', 'Hugo Love', 'AI-powered dating and relationship coaching', 'hugo_love', 'active',
   '{"quotas": {"max_users": 100000, "max_storage_gb": 500}, "features": ["coaching", "ice_breakers", "ai_analysis"]}'::jsonb,
   NOW() - INTERVAL '60 days', NOW()),

  -- Hugo Career
  ('00000000-0000-0000-0000-000000000012', 'hugo_career', 'Hugo Career', 'Professional career coaching and development', 'hugo_career', 'active',
   '{"quotas": {"max_users": 50000, "max_storage_gb": 250}, "features": ["coaching", "ai_analysis", "cross_app_insights"]}'::jsonb,
   NOW() - INTERVAL '45 days', NOW())

  -- Note: hugo_test app removed - schema_name must be unique
ON CONFLICT (app_id) DO NOTHING;

-- =============================================================================
-- STEP 3: Seed User-App Access (oriva_platform.user_app_access)
-- =============================================================================

INSERT INTO oriva_platform.user_app_access (user_id, app_id, role, status, joined_at, last_active_at)
VALUES
  -- User 1: Hugo Love (user)
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'user', 'active', NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day'),

  -- User 2: Hugo Love (user)
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'user', 'active', NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 hours'),

  -- User 2: Hugo Career (user) - Multi-app user
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'user', 'active', NOW() - INTERVAL '15 days', NOW() - INTERVAL '2 hours'),

  -- User 3: Hugo Career (user)
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000012', 'user', 'active', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 hours'),

  -- Admin: All apps (admin)
  ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000011', 'admin', 'active', NOW() - INTERVAL '60 days', NOW()),
  ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000012', 'admin', 'active', NOW() - INTERVAL '60 days', NOW())
ON CONFLICT (user_id, app_id) DO NOTHING;

-- =============================================================================
-- STEP 4: Seed Profiles (hugo_love.profiles)
-- =============================================================================

-- Schema: (id, user_id, app_id, profile_data, created_at, updated_at)
INSERT INTO hugo_love.profiles (id, user_id, app_id, profile_data, created_at, updated_at)
VALUES
  -- User 1 Profile
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', 'hugo_love',
   '{"age": 28, "gender": "female", "location": "San Francisco, CA", "interests": ["hiking", "photography", "cooking"], "bio": "Love exploring new trails and trying new recipes", "coaching_style": "direct", "session_frequency": "weekly", "notification_preferences": {"email": true, "push": true}}'::jsonb,
   NOW() - INTERVAL '30 days', NOW() - INTERVAL '1 day'),

  -- User 2 Profile
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000002', 'hugo_love',
   '{"age": 32, "gender": "male", "location": "New York, NY", "interests": ["music", "art", "travel"], "bio": "Jazz musician looking for someone who appreciates creativity", "coaching_style": "supportive", "session_frequency": "biweekly", "notification_preferences": {"email": true, "push": false}}'::jsonb,
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 hours')
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- STEP 5: Seed Sessions (hugo_ai.sessions)
-- =============================================================================
-- Schema: quality_score is INTEGER (0-100), not decimal

INSERT INTO hugo_ai.sessions (id, user_id, app_id, session_type, started_at, ended_at, duration_seconds, message_count, context_data, insights_generated, quality_score, created_at)
VALUES
  -- User 1: Recent coaching session
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'coaching',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '30 minutes', 1800, 12,
   '{"topic": "conversation_starters", "mood": "optimistic"}'::jsonb,
   '["conversation_confidence", "authenticity"]'::jsonb,
   85, NOW() - INTERVAL '1 day'),

  -- User 1: Practice session
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'practice',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '20 minutes', 1200, 8,
   '{"topic": "ice_breaker_practice", "scenario": "coffee_date"}'::jsonb,
   '["opening_lines", "active_listening"]'::jsonb,
   78, NOW() - INTERVAL '5 days'),

  -- User 2: Hugo Love coaching
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'coaching',
   NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '25 minutes', 1500, 10,
   '{"topic": "relationship_goals", "mood": "reflective"}'::jsonb,
   '["communication_patterns", "emotional_intelligence"]'::jsonb,
   92, NOW() - INTERVAL '2 hours'),

  -- User 2: Hugo Career coaching (multi-app user)
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'coaching',
   NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '40 minutes', 2400, 15,
   '{"topic": "career_transition", "mood": "motivated"}'::jsonb,
   '["leadership_skills", "communication_style"]'::jsonb,
   88, NOW() - INTERVAL '3 days'),

  -- User 3: Hugo Career session
  ('00000000-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000012', 'coaching',
   NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '35 minutes', 2100, 14,
   '{"topic": "interview_prep", "mood": "nervous"}'::jsonb,
   '["confidence_building", "technical_communication"]'::jsonb,
   0.82, NOW() - INTERVAL '5 hours')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STEP 6: Seed Insights (hugo_ai.insights)
-- =============================================================================
-- Schema: (id, user_id, session_id, insight_type, content, confidence, source_app_id, cross_app_visibility, supporting_data, created_at)
-- Valid insight_types: 'pattern', 'recommendation', 'goal_progress'
-- Note: NO metadata column, merge into supporting_data JSONB

INSERT INTO hugo_ai.insights (id, user_id, session_id, insight_type, content, confidence, source_app_id, cross_app_visibility, supporting_data, created_at)
VALUES
  -- User 1: High-confidence pattern (cross-app visible)
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000021',
   'pattern', 'User shows consistent improvement in conversation confidence over time', 0.89, 'hugo_love', true,
   '{"sessions_analyzed": 5, "trend": "positive", "growth_rate": 0.15, "generated_by": "hugo_ai_v1", "model": "claude-3-sonnet"}'::jsonb,
   NOW() - INTERVAL '1 day'),

  -- User 1: Medium-confidence recommendation (NOT cross-app visible)
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000022',
   'recommendation', 'Consider practicing more open-ended questions to deepen conversations', 0.65, 'hugo_love', false,
   '{"current_ratio": 0.3, "target_ratio": 0.5, "generated_by": "hugo_ai_v1", "model": "claude-3-haiku"}'::jsonb,
   NOW() - INTERVAL '5 days'),

  -- User 2: High-confidence pattern from Hugo Love (cross-app visible)
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000023',
   'pattern', 'Strong emotional intelligence and active listening skills demonstrated', 0.94, 'hugo_love', true,
   '{"empathy_score": 0.92, "listening_score": 0.88, "response_quality": 0.95, "generated_by": "hugo_ai_v1", "model": "claude-3-opus"}'::jsonb,
   NOW() - INTERVAL '2 hours'),

  -- User 2: High-confidence pattern from Hugo Career (cross-app visible)
  ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000024',
   'pattern', 'Demonstrates strong leadership communication and strategic thinking', 0.91, 'hugo_career', true,
   '{"leadership_score": 0.89, "strategic_thinking": 0.93, "clarity": 0.90, "generated_by": "hugo_ai_v1", "model": "claude-3-opus"}'::jsonb,
   NOW() - INTERVAL '3 days'),

  -- User 3: High-confidence goal_progress
  ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000025',
   'goal_progress', 'Successfully prepared for technical interview with confidence', 0.87, 'hugo_career', true,
   '{"preparation_score": 0.85, "confidence_improvement": 0.40, "technical_clarity": 0.88, "generated_by": "hugo_ai_v1", "model": "claude-3-sonnet"}'::jsonb,
   NOW() - INTERVAL '5 hours')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STEP 7: Seed Ice Breakers (hugo_love.ice_breakers - app-specific)
-- =============================================================================
-- Schema: (id, profile_id, content, category, confidence, personalization_factors, created_at)
-- Note: profile_id references hugo_love.profiles, NOT oriva_platform.users

-- First, we need profile IDs. Let's create profiles for our users in hugo_love schema
-- These will be created as part of the profiles seed, but we'll reference them here

INSERT INTO hugo_love.ice_breakers (id, profile_id, content, category, confidence, personalization_factors, created_at)
VALUES
  -- Profile IDs from STEP 4 (not user IDs!)
  -- Profile 1 (00000000-0000-0000-0000-000000000041): Shared interest ice breaker
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000041',
   'I noticed you like hiking! What''s your favorite trail in the Bay Area?', 'shared_interest', 0.85,
   '{"generated_from": "profile_interests", "interests": ["outdoors", "hiking"], "location": "Bay Area"}'::jsonb,
   NOW() - INTERVAL '2 days'),

  -- Profile 1: Conversation starter
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000041',
   'What''s a recipe you''ve tried recently that surprised you?', 'conversation_starter', 0.78,
   '{"generated_from": "profile_interests", "interests": ["cooking", "food"]}'::jsonb,
   NOW() - INTERVAL '2 days'),

  -- Profile 2 (00000000-0000-0000-0000-000000000042): Photo comment
  ('00000000-0000-0000-0000-000000000053', '00000000-0000-0000-0000-000000000042',
   'If you could jam with any musician, dead or alive, who would it be?', 'conversation_starter', 0.92,
   '{"generated_from": "profile_bio", "interests": ["music"]}'::jsonb,
   NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STEP 8: Seed Extraction Manifests (for GDPR testing)
-- =============================================================================
-- Schema: (id, user_id, source_app_id, status, target_format, include_schemas, data_summary, download_url, download_expires_at, error_message, created_at, expires_at, completed_at)
-- Valid statuses: 'prepared', 'executing', 'completed', 'failed'
-- Valid formats: 'json', 'csv'

INSERT INTO oriva_platform.extraction_manifests (id, user_id, source_app_id, status, target_format, include_schemas, data_summary, download_url, download_expires_at, created_at, expires_at, completed_at)
VALUES
  -- User 1: Completed extraction from Hugo Love
  ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000001', 'hugo_love', 'completed', 'json',
   ARRAY['profiles', 'sessions', 'insights']::TEXT[],
   '{"apps_included": ["hugo_love"], "records_exported": 25, "file_size_bytes": 15420, "profiles": 1, "sessions": 3, "insights": 2}'::jsonb,
   'https://storage.example.com/exports/user-00000000-0000-0000-0000-000000000001.json',
   NOW() + INTERVAL '2 days',
   NOW() - INTERVAL '5 days',
   NOW() + INTERVAL '2 days',
   NOW() - INTERVAL '4 days'),

  -- User 2: Prepared extraction (not yet executing)
  ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000002', 'hugo_love', 'prepared', 'json',
   ARRAY['profiles', 'sessions', 'insights']::TEXT[],
   '{"apps_included": ["hugo_love", "hugo_career"]}'::jsonb,
   null,
   null,
   NOW() - INTERVAL '1 hour',
   NOW() + INTERVAL '6 days' + INTERVAL '23 hours',
   null)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================================
-- Verification Queries
-- =============================================================================

DO $$
DECLARE
  v_users INTEGER;
  v_apps INTEGER;
  v_access INTEGER;
  v_profiles INTEGER;
  v_sessions INTEGER;
  v_insights INTEGER;
  v_ice_breakers INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users FROM oriva_platform.users;
  SELECT COUNT(*) INTO v_apps FROM oriva_platform.apps;
  SELECT COUNT(*) INTO v_access FROM oriva_platform.user_app_access;
  SELECT COUNT(*) INTO v_profiles FROM hugo_love.profiles;
  SELECT COUNT(*) INTO v_sessions FROM hugo_ai.sessions;
  SELECT COUNT(*) INTO v_insights FROM hugo_ai.insights;
  SELECT COUNT(*) INTO v_ice_breakers FROM hugo_love.ice_breakers;

  RAISE NOTICE '';
  RAISE NOTICE '=== TEST DATA SEED SUMMARY ===';
  RAISE NOTICE 'Users: %', v_users;
  RAISE NOTICE 'Apps: %', v_apps;
  RAISE NOTICE 'User-App Access: %', v_access;
  RAISE NOTICE 'Profiles (Hugo Love): %', v_profiles;
  RAISE NOTICE 'Sessions (Hugo AI): %', v_sessions;
  RAISE NOTICE 'Insights (Hugo AI): %', v_insights;
  RAISE NOTICE 'Ice Breakers (Hugo Love): %', v_ice_breakers;
  RAISE NOTICE '==============================';
END $$;
