-- Migration: Create hugo_apps table
-- Task: T002
-- Description: Hugo coaching application registry for Oriva ecosystem

CREATE TABLE IF NOT EXISTS hugo_apps (
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
CREATE UNIQUE INDEX IF NOT EXISTS hugo_apps_app_id_idx ON hugo_apps(app_id);
CREATE INDEX IF NOT EXISTS hugo_apps_domain_idx ON hugo_apps(domain);
CREATE INDEX IF NOT EXISTS hugo_apps_active_idx ON hugo_apps(is_active) WHERE is_active = true;

-- Constraints
ALTER TABLE hugo_apps DROP CONSTRAINT IF EXISTS hugo_apps_domain_check;
ALTER TABLE hugo_apps ADD CONSTRAINT hugo_apps_domain_check
  CHECK (domain IN ('dating', 'career', 'health', 'finance', 'relationships', 'general'));

ALTER TABLE hugo_apps DROP CONSTRAINT IF EXISTS hugo_apps_kb_ids_check;
ALTER TABLE hugo_apps ADD CONSTRAINT hugo_apps_kb_ids_check
  CHECK (array_length(knowledge_base_ids, 1) IS NULL OR array_length(knowledge_base_ids, 1) > 0);

-- Comments
COMMENT ON TABLE hugo_apps IS 'Registry of Hugo coaching applications in Oriva ecosystem';
COMMENT ON COLUMN hugo_apps.app_id IS 'Unique app identifier (lowercase_with_underscores)';
COMMENT ON COLUMN hugo_apps.domain IS 'App domain: dating, career, health, finance, relationships, general';
COMMENT ON COLUMN hugo_apps.knowledge_base_ids IS 'Array of knowledge base IDs accessible by this app';