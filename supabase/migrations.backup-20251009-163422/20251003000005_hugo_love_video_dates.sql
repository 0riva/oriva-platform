-- Hugo Love: Video Dates table
-- Scheduled/active video sessions with safety recording logic
-- Aligns with specs/004-hugo-love-app/data-model.md and FR-110c

CREATE TABLE IF NOT EXISTS hugo_love.video_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Match reference (foreign key)
  match_id UUID NOT NULL REFERENCES hugo_love.matches(id) ON DELETE CASCADE,

  -- Participant references (foreign keys to oriva_platform.users)
  participant_a_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
  participant_b_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,

  -- Video date type
  type TEXT NOT NULL CHECK (type IN ('speed_3min', 'extended_15min')),

  -- Session status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'active', 'completed', 'failed', 'cancelled'
  )),

  -- Timing
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INT CHECK (duration_seconds >= 0),

  -- Safety and recording (FR-110c)
  safety_report_filed BOOLEAN NOT NULL DEFAULT FALSE,
  recording_retention_date TIMESTAMPTZ, -- Set only if safety report filed within 24h

  -- WebRTC session metadata
  webrtc_session_id TEXT,
  turn_server_credentials JSONB, -- Temporary TURN credentials

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure participant_a_id < participant_b_id (consistency)
  CONSTRAINT participant_order CHECK (participant_a_id < participant_b_id)
);

-- Indexes for performance
CREATE INDEX idx_hugo_love_video_dates_match ON hugo_love.video_dates(match_id);
CREATE INDEX idx_hugo_love_video_dates_participant_a ON hugo_love.video_dates(participant_a_id);
CREATE INDEX idx_hugo_love_video_dates_participant_b ON hugo_love.video_dates(participant_b_id);
CREATE INDEX idx_hugo_love_video_dates_status ON hugo_love.video_dates(status);
CREATE INDEX idx_hugo_love_video_dates_scheduled_at ON hugo_love.video_dates(scheduled_at);
CREATE INDEX idx_hugo_love_video_dates_recording_retention ON hugo_love.video_dates(recording_retention_date)
  WHERE recording_retention_date IS NOT NULL;

-- RLS Policies: Users can only see their own video dates
ALTER TABLE hugo_love.video_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own video dates"
  ON hugo_love.video_dates
  FOR SELECT
  USING (
    participant_a_id = auth.uid() OR participant_b_id = auth.uid()
  );

CREATE POLICY "Users can insert their own video dates"
  ON hugo_love.video_dates
  FOR INSERT
  WITH CHECK (
    participant_a_id = auth.uid() OR participant_b_id = auth.uid()
  );

CREATE POLICY "Users can update their own video dates"
  ON hugo_love.video_dates
  FOR UPDATE
  USING (
    participant_a_id = auth.uid() OR participant_b_id = auth.uid()
  )
  WITH CHECK (
    participant_a_id = auth.uid() OR participant_b_id = auth.uid()
  );

-- Function to unlock extended date features after first video completion
CREATE OR REPLACE FUNCTION hugo_love.unlock_features_after_video()
RETURNS TRIGGER AS $$
BEGIN
  -- When a speed date completes, check if conversation has ≥10 messages
  IF NEW.type = 'speed_3min' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE hugo_love.conversations
    SET
      extended_date_unlocked = TRUE,
      catch_the_match_unlocked = TRUE,
      updated_at = NOW()
    WHERE match_id = NEW.match_id
      AND message_count >= 10;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER unlock_extended_features_after_video
  AFTER UPDATE ON hugo_love.video_dates
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.unlock_features_after_video();

-- Function to handle safety report recording retention (FR-110c)
CREATE OR REPLACE FUNCTION hugo_love.handle_safety_report_recording()
RETURNS TRIGGER AS $$
BEGIN
  -- If safety report filed within 24 hours of session end, set 30-day retention
  IF NEW.safety_report_filed = TRUE AND OLD.safety_report_filed = FALSE THEN
    IF NEW.ended_at IS NOT NULL AND (NOW() - NEW.ended_at) < INTERVAL '24 hours' THEN
      NEW.recording_retention_date := NEW.ended_at + INTERVAL '30 days';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_recording_retention_on_safety_report
  BEFORE UPDATE ON hugo_love.video_dates
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.handle_safety_report_recording();

-- Function to auto-calculate duration_seconds when session ends
CREATE OR REPLACE FUNCTION hugo_love.calculate_video_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INT;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_duration
  BEFORE INSERT OR UPDATE ON hugo_love.video_dates
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.calculate_video_duration();

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_hugo_love_video_dates_updated_at
  BEFORE UPDATE ON hugo_love.video_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE hugo_love.video_dates IS 'Video dating sessions (3min speed dates, 15min extended dates)';
COMMENT ON COLUMN hugo_love.video_dates.type IS 'speed_3min (after 5 msgs) or extended_15min (after 10 msgs + 1 video)';
COMMENT ON COLUMN hugo_love.video_dates.recording_retention_date IS 'FR-110c: 30-day retention if safety report filed within 24h';
COMMENT ON COLUMN hugo_love.video_dates.safety_report_filed IS 'If TRUE within 24h, recording uploaded to S3 and retained 30 days';
