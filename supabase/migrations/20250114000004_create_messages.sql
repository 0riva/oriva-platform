-- Migration: Create messages table
-- Task: T004
-- Description: Individual chat exchanges (user messages and AI responses)

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL,
  content TEXT NOT NULL,

  -- AI metadata (for assistant messages)
  model TEXT,
  confidence_score DECIMAL(3,2),
  intimacy_code_reference TEXT,

  -- Performance tracking
  generation_time_ms INTEGER,
  tokens_used INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX messages_conversation_idx ON messages(conversation_id, created_at);
CREATE INDEX messages_role_idx ON messages(role);

-- Constraints
ALTER TABLE messages ADD CONSTRAINT messages_role_check
  CHECK (role IN ('user', 'assistant'));

ALTER TABLE messages ADD CONSTRAINT messages_content_check
  CHECK (length(content) > 0);

ALTER TABLE messages ADD CONSTRAINT messages_confidence_check
  CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0));

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE messages IS 'Individual chat exchanges between users and AI coaches';
COMMENT ON COLUMN messages.role IS 'Message role: user or assistant';
COMMENT ON COLUMN messages.confidence_score IS 'AI confidence score (0.00-1.00)';
COMMENT ON COLUMN messages.intimacy_code_reference IS 'Referenced principle for assistant messages';