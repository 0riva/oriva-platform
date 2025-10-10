-- Hugo Love: Ratings table
-- User's 4-factor assessment of another profile
-- Aligns with specs/004-hugo-love-app/data-model.md

CREATE TABLE IF NOT EXISTS hugo_love.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User references (foreign keys to oriva_platform.users)
  rater_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
  rated_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,

  -- 4-factor scores (0-10 each)
  looks_score INT NOT NULL CHECK (looks_score >= 0 AND looks_score <= 10),
  personality_score INT NOT NULL CHECK (personality_score >= 0 AND personality_score <= 10),
  interests_score INT NOT NULL CHECK (interests_score >= 0 AND interests_score <= 10),
  lifestyle_score INT NOT NULL CHECK (lifestyle_score >= 0 AND lifestyle_score <= 10),

  -- Overall score (0-100, calculated with adaptive weights)
  overall_score INT NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

  -- User's learned priorities at time of rating (4 weights summing to 1.0)
  category_weights NUMERIC[] NOT NULL CHECK (array_length(category_weights, 1) = 4),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate ratings
  CONSTRAINT unique_rating UNIQUE (rater_id, rated_id)
);

-- Indexes for performance
CREATE INDEX idx_hugo_love_ratings_rater ON hugo_love.ratings(rater_id);
CREATE INDEX idx_hugo_love_ratings_rated ON hugo_love.ratings(rated_id);
CREATE INDEX idx_hugo_love_ratings_overall_score ON hugo_love.ratings(overall_score DESC);
CREATE INDEX idx_hugo_love_ratings_created_at ON hugo_love.ratings(created_at DESC);

-- Composite index for matching algorithm (find mutual ratings ≥80)
CREATE INDEX idx_hugo_love_ratings_mutual ON hugo_love.ratings(rater_id, rated_id, overall_score)
  WHERE overall_score >= 80;

-- RLS Policies: Users can only see their own ratings (outgoing)
ALTER TABLE hugo_love.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outgoing ratings"
  ON hugo_love.ratings
  FOR SELECT
  USING (rater_id = auth.uid());

CREATE POLICY "Users can insert their own ratings"
  ON hugo_love.ratings
  FOR INSERT
  WITH CHECK (rater_id = auth.uid());

-- Function to calculate overall_score from 4 factors + weights
-- Formula: (looks * w[0] + personality * w[1] + interests * w[2] + lifestyle * w[3]) * 10
CREATE OR REPLACE FUNCTION calculate_overall_score(
  looks INT,
  personality INT,
  interests INT,
  lifestyle INT,
  weights NUMERIC[]
) RETURNS INT AS $$
BEGIN
  RETURN (
    (looks * weights[1] +
     personality * weights[2] +
     interests * weights[3] +
     lifestyle * weights[4]) * 10
  )::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate overall_score before insert
CREATE OR REPLACE FUNCTION hugo_love.auto_calculate_overall_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.overall_score := calculate_overall_score(
    NEW.looks_score,
    NEW.personality_score,
    NEW.interests_score,
    NEW.lifestyle_score,
    NEW.category_weights
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_rating_overall_score
  BEFORE INSERT OR UPDATE ON hugo_love.ratings
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.auto_calculate_overall_score();

-- Comments for documentation
COMMENT ON TABLE hugo_love.ratings IS 'User ratings of profiles (4-factor: looks, personality, interests, lifestyle)';
COMMENT ON COLUMN hugo_love.ratings.overall_score IS 'Weighted sum of 4 factors × 10 (0-100)';
COMMENT ON COLUMN hugo_love.ratings.category_weights IS 'Array[4] of user learned priorities (sum = 1.0)';
