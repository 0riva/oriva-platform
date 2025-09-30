-- Migration: Create knowledge_entries table with full-text search
-- Task: T006
-- Description: Individual knowledge items with PostgreSQL full-text search

CREATE TABLE IF NOT EXISTS hugo_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES hugo_knowledge_bases(id) ON DELETE CASCADE,

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Organization
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  section_number INTEGER,

  -- Full-text search vector (auto-generated via trigger)
  search_vector tsvector,

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
CREATE INDEX IF NOT EXISTS ke_kb_id_idx ON hugo_knowledge_entries(knowledge_base_id);
CREATE INDEX IF NOT EXISTS ke_category_idx ON hugo_knowledge_entries(category);
CREATE INDEX IF NOT EXISTS ke_search_idx ON hugo_knowledge_entries USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS ke_tags_idx ON hugo_knowledge_entries USING GIN(tags);
CREATE INDEX IF NOT EXISTS ke_popular_idx ON hugo_knowledge_entries(access_count DESC);

-- Constraints
ALTER TABLE hugo_knowledge_entries ADD CONSTRAINT ke_content_check
  CHECK (length(title) > 0 AND length(content) > 0);

ALTER TABLE hugo_knowledge_entries ADD CONSTRAINT ke_section_number_check
  CHECK (section_number IS NULL OR section_number >= 0);

ALTER TABLE hugo_knowledge_entries ADD CONSTRAINT ke_access_count_check
  CHECK (access_count >= 0);

-- Function to update search_vector
CREATE OR REPLACE FUNCTION update_ke_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update search_vector
CREATE TRIGGER ke_search_vector_update
  BEFORE INSERT OR UPDATE OF title, content, tags
  ON hugo_knowledge_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_ke_search_vector();

-- Function to increment access count
CREATE OR REPLACE FUNCTION increment_ke_access(entry_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE hugo_knowledge_entries
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = entry_id;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE hugo_knowledge_entries IS 'Individual knowledge items with full-text search';
COMMENT ON COLUMN hugo_knowledge_entries.search_vector IS 'Auto-generated tsvector for full-text search (weighted: title=A, content=B, tags=C)';
COMMENT ON COLUMN hugo_knowledge_entries.vector_store_id IS 'Future: reference to Pinecone/Qdrant entry';
COMMENT ON FUNCTION increment_ke_access IS 'Hot path: increment access count and update last_accessed_at';