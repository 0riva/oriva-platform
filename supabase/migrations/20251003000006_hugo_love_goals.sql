-- Hugo Love: Goals table
-- SMART goal wizard and relationship milestones
-- Aligns with specs/004-hugo-love-app/data-model.md and FR-063

CREATE TABLE IF NOT EXISTS hugo_love.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference (foreign key to oriva_platform.users)
  user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,

  -- Goal details (SMART criteria)
  title TEXT NOT NULL CHECK (length(title) > 0 AND length(title) <= 200),
  description TEXT CHECK (length(description) <= 2000),
  target_date DATE NOT NULL,

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

  -- Milestones (JSONB array of milestone objects)
  milestones JSONB DEFAULT '[]',

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

-- Comments for documentation
COMMENT ON TABLE hugo_love.goals IS 'SMART goals with partner sharing (FR-063)';
COMMENT ON COLUMN hugo_love.goals.title IS 'Specific, measurable goal title (max 200 chars)';
COMMENT ON COLUMN hugo_love.goals.target_date IS 'Time-bound deadline (SMART criteria)';
COMMENT ON COLUMN hugo_love.goals.is_shared_with_partner IS 'Shared goals visible to both partners';
COMMENT ON COLUMN hugo_love.goals.partner_connection_id IS 'UUID of partner (from match or partner connection)';
COMMENT ON COLUMN hugo_love.goals.milestones IS 'JSONB array of milestone objects: [{title, completed, date}, ...]';
