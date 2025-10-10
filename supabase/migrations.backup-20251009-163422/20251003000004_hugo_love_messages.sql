-- Hugo Love: Messages table
-- Individual text messages with 90-day retention
-- Aligns with specs/004-hugo-love-app/data-model.md and FR-110b

CREATE TABLE IF NOT EXISTS hugo_love.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Conversation reference (foreign key)
  conversation_id UUID NOT NULL REFERENCES hugo_love.conversations(id) ON DELETE CASCADE,

  -- User references (foreign keys to oriva_platform.users)
  sender_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 5000),

  -- Read tracking
  read_at TIMESTAMPTZ,

  -- Safety and moderation
  flagged BOOLEAN NOT NULL DEFAULT FALSE,

  -- Retention policy (FR-110b): 90 days, or 180 days if flagged
  retention_date TIMESTAMPTZ NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure sender and recipient are different
  CONSTRAINT different_users CHECK (sender_id != recipient_id)
);

-- Indexes for performance
CREATE INDEX idx_hugo_love_messages_conversation ON hugo_love.messages(conversation_id, created_at DESC);
CREATE INDEX idx_hugo_love_messages_sender ON hugo_love.messages(sender_id);
CREATE INDEX idx_hugo_love_messages_recipient ON hugo_love.messages(recipient_id);
CREATE INDEX idx_hugo_love_messages_created_at ON hugo_love.messages(created_at DESC);
CREATE INDEX idx_hugo_love_messages_retention ON hugo_love.messages(retention_date) WHERE retention_date IS NOT NULL;

-- RLS Policies: Users can only see messages in their conversations
ALTER TABLE hugo_love.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages"
  ON hugo_love.messages
  FOR SELECT
  USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
  );

CREATE POLICY "Users can insert messages they send"
  ON hugo_love.messages
  FOR INSERT
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update messages they received (mark as read)"
  ON hugo_love.messages
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Function to auto-set retention_date based on flagged status
CREATE OR REPLACE FUNCTION hugo_love.set_message_retention_date()
RETURNS TRIGGER AS $$
BEGIN
  -- FR-110b: 90 days default, 180 days if flagged
  IF NEW.flagged THEN
    NEW.retention_date := NEW.created_at + INTERVAL '180 days';
  ELSE
    NEW.retention_date := NEW.created_at + INTERVAL '90 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_message_retention
  BEFORE INSERT ON hugo_love.messages
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.set_message_retention_date();

-- Function to increment conversation.message_count and update last_message_at
CREATE OR REPLACE FUNCTION hugo_love.update_conversation_after_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE hugo_love.conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_stats
  AFTER INSERT ON hugo_love.messages
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.update_conversation_after_message();

-- Function to auto-delete expired messages (to be run by cron job)
CREATE OR REPLACE FUNCTION hugo_love.delete_expired_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM hugo_love.messages
  WHERE retention_date < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE hugo_love.messages IS 'Individual messages with 90-day retention (FR-110b)';
COMMENT ON COLUMN hugo_love.messages.retention_date IS '90 days from created_at, or 180 days if flagged';
COMMENT ON COLUMN hugo_love.messages.flagged IS 'Extends retention to 180 days for safety investigation';
COMMENT ON FUNCTION hugo_love.delete_expired_messages() IS 'Cron job: DELETE FROM messages WHERE retention_date < NOW()';
