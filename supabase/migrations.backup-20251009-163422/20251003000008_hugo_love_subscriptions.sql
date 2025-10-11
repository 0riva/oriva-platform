-- Hugo Love: Subscriptions table
-- User subscription tiers and access control
-- Aligns with specs/004-hugo-love-app/data-model.md and FR-047, FR-048

CREATE TABLE IF NOT EXISTS hugo_love.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference (foreign key to oriva_platform.users)
  user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,

  -- Subscription tier
  tier TEXT NOT NULL CHECK (tier IN (
    'free',              -- Basic access (FR-047)
    'premium_dating',    -- Full dating features
    'premium_tic',       -- Full TIC training
    'bundle'             -- Dating + TIC (best value)
  )),

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'expired', 'cancelled', 'pending'
  )),

  -- Billing cycle
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN (
    'monthly', 'yearly', 'lifetime'
  )),

  -- Subscription dates
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- NULL for lifetime
  cancelled_at TIMESTAMPTZ,

  -- Payment tracking
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  last_payment_at TIMESTAMPTZ,
  next_payment_at TIMESTAMPTZ,

  -- Auto-renewal
  auto_renew BOOLEAN NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one active subscription per user
  CONSTRAINT unique_active_subscription_per_user UNIQUE (user_id, status)
);

-- Indexes for performance
CREATE INDEX idx_hugo_love_subscriptions_user ON hugo_love.subscriptions(user_id);
CREATE INDEX idx_hugo_love_subscriptions_tier ON hugo_love.subscriptions(tier);
CREATE INDEX idx_hugo_love_subscriptions_status ON hugo_love.subscriptions(status);
CREATE INDEX idx_hugo_love_subscriptions_expires_at ON hugo_love.subscriptions(expires_at);
CREATE INDEX idx_hugo_love_subscriptions_stripe_subscription ON hugo_love.subscriptions(stripe_subscription_id);
CREATE INDEX idx_hugo_love_subscriptions_stripe_customer ON hugo_love.subscriptions(stripe_customer_id);

-- RLS Policies: Users can only see their own subscriptions
ALTER TABLE hugo_love.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON hugo_love.subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own subscriptions"
  ON hugo_love.subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions"
  ON hugo_love.subscriptions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to auto-expire subscriptions
CREATE OR REPLACE FUNCTION hugo_love.auto_expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE hugo_love.subscriptions
  SET
    status = 'expired',
    updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has feature access
CREATE OR REPLACE FUNCTION hugo_love.has_feature_access(
  p_user_id UUID,
  p_feature TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_tier TEXT;
  v_status TEXT;
BEGIN
  SELECT tier, status INTO v_tier, v_status
  FROM hugo_love.subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  -- If no subscription found, user has free tier
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;

  -- Feature access matrix (FR-047, FR-048)
  CASE p_feature
    WHEN 'video_dating' THEN
      RETURN v_tier IN ('premium_dating', 'bundle');
    WHEN 'unlimited_matches' THEN
      RETURN v_tier IN ('premium_dating', 'bundle');
    WHEN 'tic_training' THEN
      RETURN v_tier IN ('premium_tic', 'bundle');
    WHEN 'relationship_mode' THEN
      RETURN v_tier IN ('free', 'premium_dating', 'premium_tic', 'bundle');
    WHEN 'hugo_coach' THEN
      RETURN v_tier IN ('free', 'premium_dating', 'premium_tic', 'bundle');
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to auto-set cancelled_at timestamp
CREATE OR REPLACE FUNCTION hugo_love.auto_set_cancelled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at := NOW();
    NEW.auto_renew := FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_subscription_cancelled_timestamp
  BEFORE UPDATE ON hugo_love.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.auto_set_cancelled_at();

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_hugo_love_subscriptions_updated_at
  BEFORE UPDATE ON hugo_love.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE hugo_love.subscriptions IS 'User subscription tiers and billing (FR-047, FR-048)';
COMMENT ON COLUMN hugo_love.subscriptions.tier IS 'free, premium_dating, premium_tic, bundle';
COMMENT ON COLUMN hugo_love.subscriptions.status IS 'active, expired, cancelled, pending';
COMMENT ON COLUMN hugo_love.subscriptions.billing_cycle IS 'monthly ($9.99), yearly ($99.99), lifetime ($199.99)';
COMMENT ON FUNCTION hugo_love.has_feature_access IS 'Check if user has access to specific feature based on subscription tier';
COMMENT ON FUNCTION hugo_love.auto_expire_subscriptions IS 'Cron job: UPDATE subscriptions SET status=expired WHERE expires_at < NOW()';
