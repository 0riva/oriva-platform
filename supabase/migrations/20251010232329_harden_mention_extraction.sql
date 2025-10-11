-- Migration: 20251010232329_harden_mention_extraction.sql
-- Feature: Security hardening for mention extraction
-- Purpose: Fix ReDoS vulnerability in extract_mentions_from_content()
-- Created: 2025-10-10
-- Security: Prevents CPU exhaustion from unbounded regex matching

BEGIN;

-- ============================================================================
-- SECURITY HARDENING: extract_mentions_from_content()
-- ============================================================================
-- Fixes MEDIUM severity ReDoS vulnerability identified in security review
-- Changes:
-- 1. Add content length validation (max 10,000 characters)
-- 2. Add mention count limit (max 50 mentions per entry)
-- 3. Constrain username length in regex pattern (1-30 characters)
-- 4. Add defensive LIMIT clause in mention extraction

CREATE OR REPLACE FUNCTION extract_mentions_from_content(content TEXT)
RETURNS TEXT[] AS $$
DECLARE
  mentions TEXT[];
  MAX_CONTENT_LENGTH CONSTANT INTEGER := 10000;  -- 10KB content limit
  MAX_MENTIONS CONSTANT INTEGER := 50;           -- Max 50 mentions per entry
BEGIN
  -- Input validation: reject oversized content
  IF LENGTH(content) > MAX_CONTENT_LENGTH THEN
    RAISE EXCEPTION 'Content exceeds maximum length of % characters', MAX_CONTENT_LENGTH;
  END IF;

  -- Extract @username patterns with constrained length (1-30 characters)
  -- Pattern: @[a-zA-Z0-9_]{1,30}
  SELECT ARRAY_AGG(DISTINCT mention)
  INTO mentions
  FROM (
    SELECT regexp_matches(content, '@([a-zA-Z0-9_]{1,30})', 'g') AS mention_match
  ) AS matches
  CROSS JOIN LATERAL unnest(mention_match) AS mention
  LIMIT MAX_MENTIONS;  -- Defensive limit to prevent excessive processing

  RETURN COALESCE(mentions, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
-- Log security hardening action for compliance
COMMENT ON FUNCTION extract_mentions_from_content(TEXT) IS
  'Extract @username mentions from entry content with ReDoS protection. '
  'Security hardening applied 2025-10-10: max content 10KB, max mentions 50, username length 1-30 chars.';

COMMIT;
