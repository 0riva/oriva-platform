-- Migration: Create knowledge_bases table
-- Task: T005
-- Description: Domain expertise collections for coaching apps

CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,

  -- Ownership
  app_ids TEXT[] NOT NULL,
  owner_org TEXT DEFAULT 'oriva',

  -- Versioning
  version TEXT DEFAULT '1.0.0',
  parent_kb_id TEXT,

  -- Stats
  entry_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX kb_kb_id_idx ON knowledge_bases(kb_id);
CREATE INDEX kb_app_ids_idx ON knowledge_bases USING GIN(app_ids);
CREATE INDEX kb_active_idx ON knowledge_bases(is_active) WHERE is_active = true;

-- Constraints
ALTER TABLE knowledge_bases ADD CONSTRAINT kb_app_ids_check
  CHECK (array_length(app_ids, 1) > 0);

ALTER TABLE knowledge_bases ADD CONSTRAINT kb_entry_count_check
  CHECK (entry_count >= 0);

-- Comments
COMMENT ON TABLE knowledge_bases IS 'Domain expertise collections (e.g., Intimacy Code)';
COMMENT ON COLUMN knowledge_bases.kb_id IS 'Unique knowledge base identifier (lowercase_with_underscores)';
COMMENT ON COLUMN knowledge_bases.app_ids IS 'Apps that can access this knowledge base';
COMMENT ON COLUMN knowledge_bases.version IS 'Semantic version (X.Y.Z)';