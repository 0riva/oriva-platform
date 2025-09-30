-- Migration: Create knowledge_entries table with full-text search
-- Task: T006
-- Description: Individual knowledge items with PostgreSQL full-text search

CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Organization
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  section_number INTEGER,

  -- Full-text search vector (auto-generated)
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) STORED,

  -- Future vector search support
  vector_store_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Usage tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ke_kb_id_idx ON knowledge_entries(knowledge_base_id);
CREATE INDEX ke_category_idx ON knowledge_entries(category);
CREATE INDEX ke_search_idx ON knowledge_entries USING GIN(search_vector);
CREATE INDEX ke_tags_idx ON knowledge_entries USING GIN(tags);
CREATE INDEX ke_popular_idx ON knowledge_entries(access_count DESC);

-- Constraints
ALTER TABLE knowledge_entries ADD CONSTRAINT ke_content_check
  CHECK (length(title) > 0 AND length(content) > 0);

ALTER TABLE knowledge_entries ADD CONSTRAINT ke_section_number_check
  CHECK (section_number IS NULL OR section_number >= 0);

ALTER TABLE knowledge_entries ADD CONSTRAINT ke_access_count_check
  CHECK (access_count >= 0);

-- Function to increment access count
CREATE OR REPLACE FUNCTION increment_ke_access(entry_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_entries
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = entry_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE knowledge_entries IS 'Individual knowledge items with full-text search';
COMMENT ON COLUMN knowledge_entries.search_vector IS 'Auto-generated tsvector for full-text search (weighted: title=A, content=B, tags=C)';
COMMENT ON COLUMN knowledge_entries.vector_store_id IS 'Future: reference to Pinecone/Qdrant entry';
COMMENT ON FUNCTION increment_ke_access IS 'Hot path: increment access count and update last_accessed_at';