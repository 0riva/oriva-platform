-- Hugo Love: Matches table
-- Two users with mutual ≥80 rating = match
-- Aligns with specs/004-hugo-love-app/data-model.md

CREATE TABLE IF NOT EXISTS hugo_love.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User references (foreign keys to oriva_platform.users)
  user_a_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,

  -- Ratings from each user (0-100)
  user_a_rating INT NOT NULL CHECK (user_a_rating >= 0 AND user_a_rating <= 100),
  user_b_rating INT NOT NULL CHECK (user_b_rating >= 0 AND user_b_rating <= 100),

  -- Calculated compatibility score (average of both ratings)
  compatibility_score INT GENERATED ALWAYS AS ((user_a_rating + user_b_rating) / 2) STORED,

  -- Match status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),

  -- Timestamps
  matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure user_a_id < user_b_id (prevent duplicate matches)
  CONSTRAINT user_order CHECK (user_a_id < user_b_id),

  -- Unique constraint: only one match per user pair
  CONSTRAINT unique_match UNIQUE (user_a_id, user_b_id)
);

-- Indexes for performance
CREATE INDEX idx_hugo_love_matches_user_a ON hugo_love.matches(user_a_id);
CREATE INDEX idx_hugo_love_matches_user_b ON hugo_love.matches(user_b_id);
CREATE INDEX idx_hugo_love_matches_status ON hugo_love.matches(status);
CREATE INDEX idx_hugo_love_matches_compatibility ON hugo_love.matches(compatibility_score DESC);
CREATE INDEX idx_hugo_love_matches_created_at ON hugo_love.matches(created_at DESC);

-- RLS Policies: Users can only see their own matches
ALTER TABLE hugo_love.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own matches"
  ON hugo_love.matches
  FOR SELECT
  USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
  );

CREATE POLICY "Users can update their own match status"
  ON hugo_love.matches
  FOR UPDATE
  USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
  )
  WITH CHECK (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
  );

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_hugo_love_matches_updated_at
  BEFORE UPDATE ON hugo_love.matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE hugo_love.matches IS 'Matched users (both rated each other ≥80)';
COMMENT ON COLUMN hugo_love.matches.compatibility_score IS 'Average of user_a_rating and user_b_rating';
COMMENT ON COLUMN hugo_love.matches.status IS 'active (default), archived (hidden), blocked (reported/banned)';
