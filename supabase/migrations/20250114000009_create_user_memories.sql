-- Migration: Create user_memories table
-- Task: T009
-- Description: User context and memory for personalized coaching

CREATE TABLE IF NOT EXISTS hugo_user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES hugo_apps(id),
  conversation_id UUID REFERENCES hugo_conversations(id) ON DELETE SET NULL,

  -- Memory content
  memory_type TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Importance scoring
  importance DECIMAL(3,2) DEFAULT 0.50,
  relevance_decay_rate DECIMAL(3,2) DEFAULT 0.05,

  -- Temporal tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS um_user_app_idx ON hugo_user_memories(user_id, app_id);
CREATE INDEX IF NOT EXISTS um_type_idx ON hugo_user_memories(memory_type);
CREATE INDEX IF NOT EXISTS um_importance_idx ON hugo_user_memories(importance DESC);
CREATE INDEX IF NOT EXISTS um_expires_idx ON hugo_user_memories(expires_at) WHERE expires_at IS NOT NULL;

-- Constraints
ALTER TABLE hugo_user_memories ADD CONSTRAINT um_memory_type_check
  CHECK (memory_type IN ('conversation_context', 'user_preference', 'milestone', 'insight'));

ALTER TABLE hugo_user_memories ADD CONSTRAINT um_content_check
  CHECK (length(content) > 0);

ALTER TABLE hugo_user_memories ADD CONSTRAINT um_importance_check
  CHECK (importance >= 0.0 AND importance <= 1.0);

ALTER TABLE hugo_user_memories ADD CONSTRAINT um_decay_check
  CHECK (relevance_decay_rate >= 0.0 AND relevance_decay_rate <= 1.0);

-- RLS
ALTER TABLE hugo_user_memories ENABLE ROW LEVEL SECURITY;

-- Function to decay memory importance over time
CREATE OR REPLACE FUNCTION decay_memory_importance()
RETURNS void AS $$
BEGIN
  UPDATE hugo_user_memories
  SET importance = GREATEST(0.0, importance - relevance_decay_rate)
  WHERE last_accessed_at < now() - INTERVAL '30 days'
    AND importance > 0.0;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE hugo_user_memories IS 'User context and memory for personalized coaching';
COMMENT ON COLUMN hugo_user_memories.memory_type IS 'Type: conversation_context, user_preference, milestone, insight';
COMMENT ON COLUMN hugo_user_memories.importance IS 'Memory importance score (0.00-1.00)';
COMMENT ON COLUMN hugo_user_memories.relevance_decay_rate IS 'How fast importance decreases (0.00-1.00)';
COMMENT ON FUNCTION decay_memory_importance IS 'Scheduled job: decay importance for inactive memories';