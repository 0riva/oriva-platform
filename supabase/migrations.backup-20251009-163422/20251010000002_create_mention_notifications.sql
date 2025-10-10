-- Migration: Create mention_notifications table
-- Task: T002
-- Description: Notification system for @username mentions in entries

-- Create mention_notifications table
CREATE TABLE IF NOT EXISTS mention_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    mentioned_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    mentioning_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    mention_position INTEGER NOT NULL CHECK (mention_position >= 0),
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_read BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    notification_read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CHECK (mentioned_user_id != mentioning_user_id), -- No self-mentions
    CHECK (
        (notification_sent = TRUE AND notification_sent_at IS NOT NULL) OR
        (notification_sent = FALSE AND notification_sent_at IS NULL)
    ),
    CHECK (
        (notification_read = TRUE AND notification_read_at IS NOT NULL) OR
        (notification_read = FALSE AND notification_read_at IS NULL)
    )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mention_notifications_mentioned_user ON mention_notifications(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mention_notifications_entry ON mention_notifications(entry_id);
CREATE INDEX IF NOT EXISTS idx_mention_notifications_unread ON mention_notifications(mentioned_user_id, notification_read)
    WHERE notification_read = FALSE; -- Partial index for unread notifications

-- Enable Row Level Security
ALTER TABLE mention_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own mention notifications
CREATE POLICY select_own_mention_notifications ON mention_notifications
    FOR SELECT
    USING (mentioned_user_id = auth.uid());

-- RLS Policy: Only system/authenticated users can insert mentions (via trigger)
CREATE POLICY insert_mention_notifications ON mention_notifications
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_mention_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mention_notifications_updated_at_trigger
    BEFORE UPDATE ON mention_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_mention_notifications_updated_at();

-- Comment on table
COMMENT ON TABLE mention_notifications IS 'Tracks @username mentions in entries for notification system (FR-014 to FR-017)';
