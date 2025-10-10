-- Migration: Create user_progress table
-- Task: T008
-- Description: User learning progress tracking per app

CREATE TABLE IF NOT EXISTS hugo_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES hugo_apps(id),

  -- Progress tracking
  progress_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  milestones_reached TEXT[] DEFAULT '{}',
  current_focus_area TEXT,

  -- Stats
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, app_id)
);

-- Add missing columns if table already exists (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hugo_user_progress' AND column_name = 'progress_data'
  ) THEN
    ALTER TABLE hugo_user_progress ADD COLUMN progress_data JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hugo_user_progress' AND column_name = 'app_id'
  ) THEN
    ALTER TABLE hugo_user_progress ADD COLUMN app_id UUID NOT NULL REFERENCES hugo_apps(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hugo_user_progress' AND column_name = 'milestones_reached'
  ) THEN
    ALTER TABLE hugo_user_progress ADD COLUMN milestones_reached TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hugo_user_progress' AND column_name = 'current_focus_area'
  ) THEN
    ALTER TABLE hugo_user_progress ADD COLUMN current_focus_area TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hugo_user_progress' AND column_name = 'total_conversations'
  ) THEN
    ALTER TABLE hugo_user_progress ADD COLUMN total_conversations INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hugo_user_progress' AND column_name = 'total_messages'
  ) THEN
    ALTER TABLE hugo_user_progress ADD COLUMN total_messages INTEGER DEFAULT 0;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS up_user_app_idx ON hugo_user_progress(user_id, app_id);
CREATE INDEX IF NOT EXISTS up_milestones_idx ON hugo_user_progress USING GIN(milestones_reached);

-- Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'up_conversations_check') THEN
    ALTER TABLE hugo_user_progress ADD CONSTRAINT up_conversations_check
      CHECK (total_conversations >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'up_messages_check') THEN
    ALTER TABLE hugo_user_progress ADD CONSTRAINT up_messages_check
      CHECK (total_messages >= 0);
  END IF;
END $$;

-- RLS
ALTER TABLE hugo_user_progress ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE hugo_user_progress IS 'User learning progress tracking per app';
COMMENT ON COLUMN hugo_user_progress.progress_data IS 'JSONB: {principles_learned, skill_levels, current_focus}';
COMMENT ON COLUMN hugo_user_progress.milestones_reached IS 'Array of milestone identifiers';
COMMENT ON COLUMN hugo_user_progress.total_conversations IS 'Cached conversation count';