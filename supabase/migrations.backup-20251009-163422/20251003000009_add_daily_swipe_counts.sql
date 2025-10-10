-- Migration: Add daily_swipe_counts table for Hugo Love free tier limits
-- Feature: 005-epics-alignment-mvp
-- FR-MVP-011, FR-MVP-012: Daily swipe limit tracking

CREATE TABLE IF NOT EXISTS hugo_love.daily_swipe_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    swipe_count INTEGER NOT NULL DEFAULT 0 CHECK (swipe_count >= 0),
    daily_limit INTEGER NOT NULL DEFAULT 10 CHECK (daily_limit > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    -- Unique constraint: one record per user per day
    CONSTRAINT unique_user_date UNIQUE (user_id, date),

    -- Swipe count cannot exceed daily limit
    CONSTRAINT swipe_within_limit CHECK (swipe_count <= daily_limit)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hugo_love_daily_swipe_counts_user ON hugo_love.daily_swipe_counts(user_id);
CREATE INDEX IF NOT EXISTS idx_hugo_love_daily_swipe_counts_date ON hugo_love.daily_swipe_counts(date DESC);
CREATE INDEX IF NOT EXISTS idx_hugo_love_daily_swipe_counts_user_date ON hugo_love.daily_swipe_counts(user_id, date);

-- RLS Policies
ALTER TABLE hugo_love.daily_swipe_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own swipe counts"
    ON hugo_love.daily_swipe_counts
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own swipe counts"
    ON hugo_love.daily_swipe_counts
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own swipe counts"
    ON hugo_love.daily_swipe_counts
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_hugo_love_daily_swipe_counts_updated_at
    BEFORE UPDATE ON hugo_love.daily_swipe_counts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment for documentation
COMMENT ON TABLE hugo_love.daily_swipe_counts IS 'Tracks daily swipe count per user for free tier enforcement (FR-MVP-011, FR-MVP-012)';
COMMENT ON COLUMN hugo_love.daily_swipe_counts.date IS 'Date normalized to midnight UTC (YYYY-MM-DD)';
COMMENT ON COLUMN hugo_love.daily_swipe_counts.swipe_count IS 'Number of swipes used today (0-daily_limit)';
COMMENT ON COLUMN hugo_love.daily_swipe_counts.daily_limit IS 'Maximum swipes allowed per day (10 for free, unlimited for premium)';
