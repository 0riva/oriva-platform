-- Migration: Create hugo_conversations table
-- Task: T003
-- Description: Hugo chat sessions between users and coaching apps

CREATE TABLE IF NOT EXISTS hugo_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES hugo_apps(id),

  -- Session metadata
  title TEXT,
  message_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS hugo_conversations_session_id_idx ON hugo_conversations(session_id);
CREATE INDEX IF NOT EXISTS hugo_conversations_user_app_idx ON hugo_conversations(user_id, app_id);
CREATE INDEX IF NOT EXISTS hugo_conversations_recent_idx ON hugo_conversations(last_message_at DESC);

-- Constraints
ALTER TABLE hugo_conversations DROP CONSTRAINT IF EXISTS hugo_conversations_message_count_check;
ALTER TABLE hugo_conversations ADD CONSTRAINT hugo_conversations_message_count_check
  CHECK (message_count >= 0);

-- RLS
ALTER TABLE hugo_conversations ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE hugo_conversations IS 'Hugo chat sessions between users and coaching apps';
COMMENT ON COLUMN hugo_conversations.session_id IS 'Client-generated UUID for idempotency';
COMMENT ON COLUMN hugo_conversations.title IS 'Auto-generated from first message';
COMMENT ON COLUMN hugo_conversations.message_count IS 'Cached count for performance';