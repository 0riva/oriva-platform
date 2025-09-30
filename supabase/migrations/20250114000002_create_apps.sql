-- Migration: Create apps table
-- Task: T002
-- Description: Coaching application registry for Oriva ecosystem

CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  domain TEXT NOT NULL,

  -- Configuration (personality_schema_id FK added in T007)
  knowledge_base_ids TEXT[] DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,
  requires_subscription BOOLEAN DEFAULT false,

  -- Metadata
  description TEXT,
  icon_url TEXT,
  app_store_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX apps_app_id_idx ON apps(app_id);
CREATE INDEX apps_domain_idx ON apps(domain);
CREATE INDEX apps_active_idx ON apps(is_active) WHERE is_active = true;

-- Constraints
ALTER TABLE apps ADD CONSTRAINT apps_domain_check
  CHECK (domain IN ('dating', 'career', 'health', 'finance', 'relationships', 'general'));

ALTER TABLE apps ADD CONSTRAINT apps_kb_ids_check
  CHECK (array_length(knowledge_base_ids, 1) IS NULL OR array_length(knowledge_base_ids, 1) > 0);

-- Comments
COMMENT ON TABLE apps IS 'Registry of coaching applications in Oriva ecosystem';
COMMENT ON COLUMN apps.app_id IS 'Unique app identifier (lowercase_with_underscores)';
COMMENT ON COLUMN apps.domain IS 'App domain: dating, career, health, finance, relationships, general';
COMMENT ON COLUMN apps.knowledge_base_ids IS 'Array of knowledge base IDs accessible by this app';