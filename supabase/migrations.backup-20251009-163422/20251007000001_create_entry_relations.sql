-- Migration: 001_create_entry_relations.sql
-- Feature: Entry Picker Features (011-entry-picker-features)
-- Purpose: Create entry_relations table with RLS policies and relation_count trigger
-- Created: 2025-01-28
-- Implements: FR-007, FR-007a, FR-007b, FR-011, FR-035

BEGIN;

-- ============================================================================
-- TABLE: entry_relations
-- ============================================================================
-- Stores bidirectional entry relations created via /related-to slash command
-- Bidirectional: Both source and target entries show the relation
-- Creator tracking: For deletion rights (only creator can delete per FR-007b)
-- Soft delete: active=false when deleted (FR-011: maintain integrity)

CREATE TABLE IF NOT EXISTS entry_relations (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relation endpoints (bidirectional)
  source_entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE SET NULL,
  target_entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE SET NULL,

  -- Creator tracking (for deletion rights per FR-007b)
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Timestamps (for chronological order per FR-035, clarification Q2)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Soft delete (for FR-011: maintain integrity when entries deleted)
  active BOOLEAN NOT NULL DEFAULT true,

  -- Relation metadata
  relation_type VARCHAR(50) NOT NULL DEFAULT 'related-to',

  -- Constraints
  CONSTRAINT entry_relations_not_self_referencing
    CHECK (source_entry_id != target_entry_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance optimization for bidirectional relation queries

-- Index for source entry lookups (partial index: active only)
CREATE INDEX IF NOT EXISTS idx_entry_relations_source
  ON entry_relations(source_entry_id)
  WHERE active = true;

-- Index for target entry lookups (partial index: active only)
CREATE INDEX IF NOT EXISTS idx_entry_relations_target
  ON entry_relations(target_entry_id)
  WHERE active = true;

-- Index for chronological ordering (DESC for most recent first per FR-035)
CREATE INDEX IF NOT EXISTS idx_entry_relations_created_at
  ON entry_relations(created_at DESC);

-- Index for creator lookups (for deletion rights verification)
CREATE INDEX IF NOT EXISTS idx_entry_relations_creator
  ON entry_relations(created_by_user_id);

-- Composite index for bidirectional lookups (most efficient query pattern)
CREATE INDEX IF NOT EXISTS idx_entry_relations_bidirectional
  ON entry_relations(source_entry_id, target_entry_id)
  WHERE active = true;

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS
ALTER TABLE entry_relations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view relations where they can view either entry
-- Implements FR-029: Respect RLS policies for multi-tenant data isolation
DROP POLICY IF EXISTS entry_relations_select_policy ON entry_relations;
CREATE POLICY entry_relations_select_policy ON entry_relations
  FOR SELECT
  USING (
    -- User can view if they can view the source entry
    EXISTS (
      SELECT 1 FROM entries
      WHERE id = entry_relations.source_entry_id
      AND (
        -- Entry is published and not private
        (status = 'published' AND (audience->>'type' = 'public'))
        OR
        -- Entry is owned by user
        user_id = auth.uid()
        -- TODO: Add entry sharing when entry_shares table is implemented
        -- OR
        -- Entry is shared with user (if groups/sharing implemented)
        -- EXISTS (
        --   SELECT 1 FROM entry_shares
        --   WHERE entry_id = entries.id
        --   AND shared_with_user_id = auth.uid()
        -- )
      )
    )
    OR
    -- User can view if they can view the target entry
    EXISTS (
      SELECT 1 FROM entries
      WHERE id = entry_relations.target_entry_id
      AND (
        -- Entry is published and not private
        (status = 'published' AND (audience->>'type' = 'public'))
        OR
        -- Entry is owned by user
        user_id = auth.uid()
        -- TODO: Add entry sharing when entry_shares table is implemented
        -- OR
        -- Entry is shared with user (if groups/sharing implemented)
        -- EXISTS (
        --   SELECT 1 FROM entry_shares
        --   WHERE entry_id = entries.id
        --   AND shared_with_user_id = auth.uid()
        -- )
      )
    )
  );

-- Policy: Users can create relations to entries they can view
-- Implements FR-007: Bidirectional relations, FR-006: Published entries only
DROP POLICY IF EXISTS entry_relations_insert_policy ON entry_relations;
CREATE POLICY entry_relations_insert_policy ON entry_relations
  FOR INSERT
  WITH CHECK (
    -- Relation creator must be authenticated user
    created_by_user_id = auth.uid()
    AND
    -- User can view source entry
    EXISTS (
      SELECT 1 FROM entries
      WHERE id = entry_relations.source_entry_id
      AND (
        (status = 'published' AND (audience->>'type' = 'public'))
        OR user_id = auth.uid()
      )
    )
    AND
    -- User can view target entry
    EXISTS (
      SELECT 1 FROM entries
      WHERE id = entry_relations.target_entry_id
      AND (
        (status = 'published' AND (audience->>'type' = 'public'))
        OR user_id = auth.uid()
      )
    )
  );

-- Policy: Only creators can delete their relations (FR-007b)
-- Implements creator-only deletion rights (clarification Q5)
DROP POLICY IF EXISTS entry_relations_delete_policy ON entry_relations;
CREATE POLICY entry_relations_delete_policy ON entry_relations
  FOR DELETE
  USING (created_by_user_id = auth.uid());

-- Policy: Only creators can update their relations (for soft delete via UPDATE)
DROP POLICY IF EXISTS entry_relations_update_policy ON entry_relations;
CREATE POLICY entry_relations_update_policy ON entry_relations
  FOR UPDATE
  USING (created_by_user_id = auth.uid())
  WITH CHECK (created_by_user_id = auth.uid());

COMMIT;
