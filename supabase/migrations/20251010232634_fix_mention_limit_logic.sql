-- Migration: 20251010232634_fix_mention_limit_logic.sql
-- Feature: Fix mention count limit logic
-- Purpose: Correctly apply 50-mention limit (LIMIT was at wrong level)
-- Created: 2025-10-10
-- Security: Ensures ReDoS protection works correctly

BEGIN;

-- ============================================================================
-- FIX: extract_mentions_from_content() - Correct mention limit application
-- ============================================================================
-- Previous version had LIMIT in wrong place (after ARRAY_AGG, not before)
-- Now limits DISTINCT mentions before aggregation

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
  -- LIMIT applied before ARRAY_AGG to correctly cap at 50 distinct mentions
  SELECT ARRAY_AGG(mention)
  INTO mentions
  FROM (
    SELECT DISTINCT unnest(mention_match) AS mention
    FROM (
      SELECT regexp_matches(content, '@([a-zA-Z0-9_]{1,30})', 'g') AS mention_match
    ) AS matches
    LIMIT MAX_MENTIONS  -- Defensive limit: max 50 distinct mentions
  ) AS limited_mentions;

  RETURN COALESCE(mentions, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;
