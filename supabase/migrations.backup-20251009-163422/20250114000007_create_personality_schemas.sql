-- Migration: Create personality_schemas table
-- Task: T007
-- Description: Coaching personality definitions with SageMaker-style management

CREATE TABLE IF NOT EXISTS hugo_personality_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id TEXT NOT NULL,
  version TEXT NOT NULL,

  -- Schema hierarchy
  layer TEXT NOT NULL,
  parent_schema_id UUID REFERENCES hugo_personality_schemas(id),

  -- Personality definition
  schema JSONB NOT NULL,

  -- Deployment metadata
  status TEXT DEFAULT 'draft',
  rollout_percentage INTEGER DEFAULT 0,
  ab_test_group TEXT,

  -- Audit trail
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS ps_schema_id_version_idx ON hugo_personality_schemas(schema_id, version);
CREATE INDEX IF NOT EXISTS ps_layer_idx ON hugo_personality_schemas(layer);
CREATE INDEX IF NOT EXISTS ps_status_idx ON hugo_personality_schemas(status);
CREATE INDEX IF NOT EXISTS ps_active_idx ON hugo_personality_schemas(status, rollout_percentage)
  WHERE status = 'active' AND rollout_percentage > 0;

-- Unique constraint for active schemas per schema_id
CREATE UNIQUE INDEX IF NOT EXISTS ps_unique_active_schema ON hugo_personality_schemas(schema_id)
  WHERE status = 'active' AND rollout_percentage = 100;

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ps_layer_check') THEN
    ALTER TABLE hugo_personality_schemas ADD CONSTRAINT ps_layer_check
      CHECK (layer IN ('base', 'overlay'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ps_status_check') THEN
    ALTER TABLE hugo_personality_schemas ADD CONSTRAINT ps_status_check
      CHECK (status IN ('draft', 'testing', 'active', 'archived'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ps_rollout_check') THEN
    ALTER TABLE hugo_personality_schemas ADD CONSTRAINT ps_rollout_check
      CHECK (rollout_percentage BETWEEN 0 AND 100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ps_overlay_parent_check') THEN
    ALTER TABLE hugo_personality_schemas ADD CONSTRAINT ps_overlay_parent_check
      CHECK ((layer = 'overlay' AND parent_schema_id IS NOT NULL) OR (layer = 'base' AND parent_schema_id IS NULL));
  END IF;
END $$;

-- Comments
COMMENT ON TABLE hugo_personality_schemas IS 'Coaching personality definitions with layering support';
COMMENT ON COLUMN hugo_personality_schemas.layer IS 'Schema layer: base (Core HugoAI) or overlay (app-specific)';
COMMENT ON COLUMN hugo_personality_schemas.schema IS 'JSONB: {tone, focus, constraints, examples, voice_characteristics}';
COMMENT ON COLUMN hugo_personality_schemas.rollout_percentage IS 'Gradual deployment: 0-100%';
COMMENT ON COLUMN hugo_personality_schemas.status IS 'Lifecycle: draft → testing → active → archived';

-- Now add the FK constraint to hugo_apps table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hugo_apps' AND column_name = 'personality_schema_id'
  ) THEN
    ALTER TABLE hugo_apps ADD COLUMN personality_schema_id UUID REFERENCES hugo_personality_schemas(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS apps_personality_idx ON hugo_apps(personality_schema_id);

COMMENT ON COLUMN hugo_apps.personality_schema_id IS 'Reference to active personality schema';