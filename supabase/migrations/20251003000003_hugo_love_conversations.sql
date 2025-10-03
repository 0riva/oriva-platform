-- Hugo Love: Conversations table
-- Message thread between matched users
-- Aligns with specs/004-hugo-love-app/data-model.md

CREATE TABLE IF NOT EXISTS hugo_love.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Match reference (foreign key to hugo_love.matches)
  match_id UUID NOT NULL REFERENCES hugo_love.matches(id) ON DELETE CASCADE,

  -- Message tracking
  message_count INT NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  last_message_at TIMESTAMPTZ,

  -- Unlock progression (based on message count)
  video_date_unlocked BOOLEAN NOT NULL DEFAULT FALSE, -- After 5 messages (FR-025)
  extended_date_unlocked BOOLEAN NOT NULL DEFAULT FALSE, -- After 10 messages + 1 video date
  catch_the_match_unlocked BOOLEAN NOT NULL DEFAULT FALSE, -- After 10 messages + 1 video date

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one conversation per match
  CONSTRAINT unique_conversation_per_match UNIQUE (match_id)
);

-- Indexes for performance
CREATE INDEX idx_hugo_love_conversations_match ON hugo_love.conversations(match_id);
CREATE INDEX idx_hugo_love_conversations_last_message ON hugo_love.conversations(last_message_at DESC);
CREATE INDEX idx_hugo_love_conversations_created_at ON hugo_love.conversations(created_at DESC);

-- RLS Policies: Users can only see conversations for their matches
ALTER TABLE hugo_love.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON hugo_love.conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hugo_love.matches
      WHERE matches.id = conversations.match_id
        AND (matches.user_a_id = auth.uid() OR matches.user_b_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own conversations"
  ON hugo_love.conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM hugo_love.matches
      WHERE matches.id = conversations.match_id
        AND (matches.user_a_id = auth.uid() OR matches.user_b_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM hugo_love.matches
      WHERE matches.id = conversations.match_id
        AND (matches.user_a_id = auth.uid() OR matches.user_b_id = auth.uid())
    )
  );

-- Function to automatically unlock features based on message count
CREATE OR REPLACE FUNCTION hugo_love.auto_unlock_conversation_features()
RETURNS TRIGGER AS $$
BEGIN
  -- Video date unlocks after 5 messages
  IF NEW.message_count >= 5 THEN
    NEW.video_date_unlocked := TRUE;
  END IF;

  -- Extended date and catch the match unlock after 10 messages + 1 video date
  -- (video date completion checked externally, this just ensures message threshold)
  IF NEW.message_count >= 10 THEN
    -- Note: extended_date_unlocked and catch_the_match_unlocked
    -- will be set TRUE by the video_dates table trigger after first completion
    NULL; -- Placeholder for clarity
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unlock_conversation_features
  BEFORE INSERT OR UPDATE ON hugo_love.conversations
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.auto_unlock_conversation_features();

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_hugo_love_conversations_updated_at
  BEFORE UPDATE ON hugo_love.conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE hugo_love.conversations IS 'Message threads between matched users';
COMMENT ON COLUMN hugo_love.conversations.video_date_unlocked IS 'TRUE after 5 messages (FR-025)';
COMMENT ON COLUMN hugo_love.conversations.extended_date_unlocked IS 'TRUE after 10 messages + 1 video date';
COMMENT ON COLUMN hugo_love.conversations.catch_the_match_unlocked IS 'TRUE after 10 messages + 1 video date';
