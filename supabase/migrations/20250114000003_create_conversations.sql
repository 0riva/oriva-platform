-- Migration: Create conversations table
-- Task: T003
-- Description: Chat sessions between users and coaching apps

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id),

  -- Session metadata
  title TEXT,
  message_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Indexes
CREATE UNIQUE INDEX conversations_session_id_idx ON conversations(session_id);
CREATE INDEX conversations_user_app_idx ON conversations(user_id, app_id);
CREATE INDEX conversations_recent_idx ON conversations(last_message_at DESC);

-- Constraints
ALTER TABLE conversations ADD CONSTRAINT conversations_message_count_check
  CHECK (message_count >= 0);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Comments
COMMENT ON TABLE conversations IS 'Chat sessions between users and coaching apps';
COMMENT ON COLUMN conversations.session_id IS 'Client-generated UUID for idempotency';
COMMENT ON COLUMN conversations.title IS 'Auto-generated from first message';
COMMENT ON COLUMN conversations.message_count IS 'Cached count for performance';