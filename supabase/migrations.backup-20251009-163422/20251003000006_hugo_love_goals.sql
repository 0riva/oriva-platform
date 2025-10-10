-- Hugo Love: Goals table
-- SMART goal wizard and relationship milestones
-- Aligns with specs/004-hugo-love-app/data-model.md and FR-063

CREATE TABLE IF NOT EXISTS hugo_love.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference (foreign key to oriva_platform.users)
  user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,

  -- Goal details (SMART criteria per spec lines 273-282)
  title TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 200),
  description TEXT CHECK (length(description) <= 2000),

  -- SMART fields (Specific, Measurable, Achievable, Relevant, Time-bound)
  specific TEXT NOT NULL CHECK (length(specific) >= 20),
  measurable TEXT NOT NULL,
  achievable TEXT NOT NULL,
  relevant TEXT NOT NULL CHECK (length(relevant) >= 20),
  time_bound DATE NOT NULL,
  target_date DATE NOT NULL, -- Alias for time_bound for backward compat

  -- Progress tracking
  current_progress INT NOT NULL DEFAULT 0 CHECK (current_progress >= 0 AND current_progress <= 100),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Partner sharing
  is_shared_with_partner BOOLEAN NOT NULL DEFAULT FALSE,
  partner_connection_id UUID, -- UUID of partner (from matches or partner connection)

  -- Goal category (optional)
  category TEXT CHECK (category IN (
    'communication', 'intimacy', 'quality_time', 'trust',
    'conflict_resolution', 'personal_growth', 'other'
  )),

  -- Milestones (per spec lines 283-284: parallel arrays)
  milestones JSONB DEFAULT '[]', -- Array of milestone strings
  completed_milestones JSONB DEFAULT '[]', -- Parallel array of booleans

  -- Reminders (per spec lines 286-287)
  reminder_frequency TEXT DEFAULT 'weekly' CHECK (reminder_frequency IN ('daily', 'weekly', 'custom')),
  custom_reminder_dates JSONB, -- Array of ISO8601 date strings if frequency='custom'

  -- Status and visibility (per spec lines 288-289)
  partner_visible BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_hugo_love_goals_user ON hugo_love.goals(user_id);
CREATE INDEX idx_hugo_love_goals_target_date ON hugo_love.goals(target_date);
CREATE INDEX idx_hugo_love_goals_is_completed ON hugo_love.goals(is_completed);
CREATE INDEX idx_hugo_love_goals_partner_connection ON hugo_love.goals(partner_connection_id)
  WHERE partner_connection_id IS NOT NULL;
CREATE INDEX idx_hugo_love_goals_shared ON hugo_love.goals(is_shared_with_partner);
CREATE INDEX idx_hugo_love_goals_category ON hugo_love.goals(category);

-- RLS Policies: Users can only see their own goals + partner-shared goals
ALTER TABLE hugo_love.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals"
  ON hugo_love.goals
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view partner-shared goals"
  ON hugo_love.goals
  FOR SELECT
  USING (
    is_shared_with_partner = TRUE
    AND partner_connection_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM hugo_love.matches
      WHERE (matches.user_a_id = auth.uid() AND matches.user_b_id = goals.user_id)
         OR (matches.user_b_id = auth.uid() AND matches.user_a_id = goals.user_id)
    )
  );

CREATE POLICY "Users can insert their own goals"
  ON hugo_love.goals
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own goals"
  ON hugo_love.goals
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own goals"
  ON hugo_love.goals
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to auto-set completed_at when is_completed changes to TRUE
CREATE OR REPLACE FUNCTION hugo_love.auto_set_goal_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_at when goal is marked complete
  IF NEW.is_completed = TRUE AND OLD.is_completed = FALSE THEN
    NEW.completed_at := NOW();
    NEW.current_progress := 100;
  END IF;

  -- Clear completed_at if goal is marked incomplete
  IF NEW.is_completed = FALSE AND OLD.is_completed = TRUE THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_goal_completion_timestamp
  BEFORE UPDATE ON hugo_love.goals
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.auto_set_goal_completed_at();

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_hugo_love_goals_updated_at
  BEFORE UPDATE ON hugo_love.goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Validation constraint: milestones and completed_milestones must have same length
CREATE OR REPLACE FUNCTION hugo_love.validate_goal_milestones()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure milestones and completed_milestones have same length
  IF jsonb_array_length(NEW.milestones) != jsonb_array_length(NEW.completed_milestones) THEN
    RAISE EXCEPTION 'milestones and completed_milestones must have same length (spec validation line 294)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_goal_milestones_trigger
  BEFORE INSERT OR UPDATE ON hugo_love.goals
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.validate_goal_milestones();

-- Comments for documentation
COMMENT ON TABLE hugo_love.goals IS 'SMART goals with partner sharing (FR-063) per spec data-model.md lines 269-305';
COMMENT ON COLUMN hugo_love.goals.specific IS 'SMART-S: Specific details (min 20 chars)';
COMMENT ON COLUMN hugo_love.goals.measurable IS 'SMART-M: Measurable criteria';
COMMENT ON COLUMN hugo_love.goals.achievable IS 'SMART-A: Achievable plan';
COMMENT ON COLUMN hugo_love.goals.relevant IS 'SMART-R: Relevant reasoning (min 20 chars)';
COMMENT ON COLUMN hugo_love.goals.time_bound IS 'SMART-T: Time-bound deadline';
COMMENT ON COLUMN hugo_love.goals.target_date IS 'Alias for time_bound';
COMMENT ON COLUMN hugo_love.goals.milestones IS 'JSONB array of milestone strings (spec line 283)';
COMMENT ON COLUMN hugo_love.goals.completed_milestones IS 'JSONB parallel array of booleans (spec line 284)';
COMMENT ON COLUMN hugo_love.goals.is_shared_with_partner IS 'Shared goals visible to both partners';
COMMENT ON COLUMN hugo_love.goals.partner_connection_id IS 'UUID of partner (from match or partner connection)';
COMMENT ON COLUMN hugo_love.goals.status IS 'Goal lifecycle status (spec line 289)';
