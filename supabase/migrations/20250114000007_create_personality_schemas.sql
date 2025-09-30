-- Migration: Create personality_schemas table
-- Task: T007
-- Description: Coaching personality definitions with SageMaker-style management

CREATE TABLE personality_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id TEXT NOT NULL,
  version TEXT NOT NULL,

  -- Schema hierarchy
  layer TEXT NOT NULL,
  parent_schema_id UUID REFERENCES personality_schemas(id),

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
CREATE INDEX ps_schema_id_version_idx ON personality_schemas(schema_id, version);
CREATE INDEX ps_layer_idx ON personality_schemas(layer);
CREATE INDEX ps_status_idx ON personality_schemas(status);
CREATE INDEX ps_active_idx ON personality_schemas(status, rollout_percentage)
  WHERE status = 'active' AND rollout_percentage > 0;

-- Unique constraint for active schemas per schema_id
CREATE UNIQUE INDEX ps_unique_active_schema ON personality_schemas(schema_id)
  WHERE status = 'active' AND rollout_percentage = 100;

-- Constraints
ALTER TABLE personality_schemas ADD CONSTRAINT ps_layer_check
  CHECK (layer IN ('base', 'overlay'));

ALTER TABLE personality_schemas ADD CONSTRAINT ps_status_check
  CHECK (status IN ('draft', 'testing', 'active', 'archived'));

ALTER TABLE personality_schemas ADD CONSTRAINT ps_rollout_check
  CHECK (rollout_percentage BETWEEN 0 AND 100);

ALTER TABLE personality_schemas ADD CONSTRAINT ps_overlay_parent_check
  CHECK ((layer = 'overlay' AND parent_schema_id IS NOT NULL) OR (layer = 'base' AND parent_schema_id IS NULL));

-- Comments
COMMENT ON TABLE personality_schemas IS 'Coaching personality definitions with layering support';
COMMENT ON COLUMN personality_schemas.layer IS 'Schema layer: base (Core HugoAI) or overlay (app-specific)';
COMMENT ON COLUMN personality_schemas.schema IS 'JSONB: {tone, focus, constraints, examples, voice_characteristics}';
COMMENT ON COLUMN personality_schemas.rollout_percentage IS 'Gradual deployment: 0-100%';
COMMENT ON COLUMN personality_schemas.status IS 'Lifecycle: draft → testing → active → archived';

-- Now add the FK constraint to apps table
ALTER TABLE apps ADD COLUMN personality_schema_id UUID REFERENCES personality_schemas(id);
CREATE INDEX apps_personality_idx ON apps(personality_schema_id);

COMMENT ON COLUMN apps.personality_schema_id IS 'Reference to active personality schema';