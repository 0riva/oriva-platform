-- Migration: Create hugo_messages table
-- Task: T004
-- Description: Individual chat exchanges (user hugo_messages and AI responses)

CREATE TABLE IF NOT EXISTS hugo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES hugo_conversations(id) ON DELETE CASCADE,

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
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON hugo_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_role_idx ON hugo_messages(role);

-- Constraints (using DO block for IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_role_check') THEN
    ALTER TABLE hugo_messages ADD CONSTRAINT messages_role_check
      CHECK (role IN ('user', 'assistant'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_content_check') THEN
    ALTER TABLE hugo_messages ADD CONSTRAINT messages_content_check
      CHECK (length(content) > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_confidence_check') THEN
    ALTER TABLE hugo_messages ADD CONSTRAINT messages_confidence_check
      CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0));
  END IF;
END $$;

-- RLS
ALTER TABLE hugo_messages ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE hugo_messages IS 'Individual chat exchanges between users and AI coaches';
COMMENT ON COLUMN hugo_messages.role IS 'Message role: user or assistant';
COMMENT ON COLUMN hugo_messages.confidence_score IS 'AI confidence score (0.00-1.00)';
COMMENT ON COLUMN hugo_messages.intimacy_code_reference IS 'Referenced principle for assistant messages';