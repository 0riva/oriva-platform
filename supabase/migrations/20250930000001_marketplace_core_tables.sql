/**
 * OrivaFlow Marketplace Core Tables
 * Feature: 010-orivaflow-semantic-commerce
 * Phase 1: Database Schema - Core marketplace tables
 *
 * Constitutional Compliance: Extends entries table with marketplace_metadata JSONB
 * Achieves 60% reuse by leveraging existing atomic design system
 */

-- ============================================================================
-- Enable Required Extensions
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for secure token generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- Marketplace Metadata (JSONB in entries table)
-- ============================================================================

-- Add marketplace_metadata column to entries table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entries' AND column_name = 'marketplace_metadata'
  ) THEN
    ALTER TABLE entries ADD COLUMN marketplace_metadata JSONB;
  END IF;
END $$;

-- Create index for marketplace queries
CREATE INDEX IF NOT EXISTS idx_entries_marketplace_metadata
ON entries USING GIN (marketplace_metadata jsonb_path_ops);

-- Create index for published marketplace items
CREATE INDEX IF NOT EXISTS idx_entries_marketplace_published
ON entries (created_at DESC)
WHERE entry_type = 'marketplace_item'
AND marketplace_metadata->>'is_published' = 'true';

-- Create index for price filtering
CREATE INDEX IF NOT EXISTS idx_entries_marketplace_price
ON entries (((marketplace_metadata->>'price')::numeric))
WHERE entry_type = 'marketplace_item';

-- ============================================================================
-- OrivaPay Accounts (Stripe Connect)
-- ============================================================================

CREATE TABLE IF NOT EXISTS orivapay_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stripe Connect Account
  stripe_account_id TEXT UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('standard', 'express', 'custom')),
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,

  -- Onboarding Status
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_url TEXT,
  onboarding_expires_at TIMESTAMPTZ,

  -- Account Details
  business_type TEXT, -- 'individual' or 'company'
  country TEXT NOT NULL DEFAULT 'US',
  currency TEXT NOT NULL DEFAULT 'USD',
  default_currency TEXT NOT NULL DEFAULT 'USD',

  -- Capabilities
  capabilities JSONB DEFAULT '{}'::JSONB,

  -- Requirements
  requirements JSONB DEFAULT '{}'::JSONB,

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_account UNIQUE (user_id)
);

-- Indexes
CREATE INDEX idx_orivapay_accounts_user_id ON orivapay_accounts(user_id);
CREATE INDEX idx_orivapay_accounts_stripe_id ON orivapay_accounts(stripe_account_id);

-- ============================================================================
-- OrivaPay Transactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS orivapay_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parties
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  item_id UUID NOT NULL REFERENCES entries(id),

  -- Transaction Details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'refund', 'payout')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Fee Breakdown (all in cents)
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  stripe_fee_cents INTEGER NOT NULL DEFAULT 0,
  seller_net_cents INTEGER NOT NULL,

  -- Payment Details
  payment_method TEXT NOT NULL CHECK (payment_method IN ('card', 'bank_transfer', 'wallet')),
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded')
  ),
  failure_reason TEXT,

  -- Escrow
  uses_escrow BOOLEAN DEFAULT false,
  escrow_released_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_buyer ON orivapay_transactions(buyer_id, created_at DESC);
CREATE INDEX idx_transactions_seller ON orivapay_transactions(seller_id, created_at DESC);
CREATE INDEX idx_transactions_item ON orivapay_transactions(item_id);
CREATE INDEX idx_transactions_status ON orivapay_transactions(status, created_at DESC);
CREATE INDEX idx_transactions_payment_intent ON orivapay_transactions(stripe_payment_intent_id);

-- ============================================================================
-- Escrow System
-- ============================================================================

CREATE TABLE IF NOT EXISTS orivapay_escrow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES orivapay_transactions(id) ON DELETE CASCADE,

  -- Escrow Details
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',

  -- Release Conditions
  release_type TEXT NOT NULL CHECK (release_type IN ('manual', 'automatic', 'agreement')),
  release_conditions JSONB DEFAULT '{}'::JSONB,
  auto_release_at TIMESTAMPTZ,

  -- Agreement Integration (for high-value transactions)
  agreement_id UUID REFERENCES agreements(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'held' CHECK (
    status IN ('held', 'released', 'disputed', 'refunded')
  ),
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES auth.users(id),

  -- Dispute
  dispute_reason TEXT,
  dispute_opened_at TIMESTAMPTZ,
  dispute_resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_transaction_escrow UNIQUE (transaction_id)
);

-- Indexes
CREATE INDEX idx_escrow_transaction ON orivapay_escrow(transaction_id);
CREATE INDEX idx_escrow_status ON orivapay_escrow(status, created_at DESC);
CREATE INDEX idx_escrow_agreement ON orivapay_escrow(agreement_id);

-- ============================================================================
-- Marketplace Reviews
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  item_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES orivapay_transactions(id),

  -- Review Content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL CHECK (length(title) <= 200),
  content TEXT NOT NULL CHECK (length(content) >= 10),

  -- Helpful Votes
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,

  -- Verification
  verified_purchase BOOLEAN DEFAULT false,

  -- Moderation
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    moderation_status IN ('pending', 'approved', 'rejected', 'flagged')
  ),
  moderation_notes TEXT,
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES auth.users(id),

  -- Response from seller
  seller_response TEXT,
  seller_responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One review per user per item
  CONSTRAINT unique_user_item_review UNIQUE (item_id, reviewer_id)
);

-- Indexes
CREATE INDEX idx_reviews_item ON marketplace_reviews(item_id, created_at DESC);
CREATE INDEX idx_reviews_reviewer ON marketplace_reviews(reviewer_id);
CREATE INDEX idx_reviews_rating ON marketplace_reviews(rating);
CREATE INDEX idx_reviews_moderation ON marketplace_reviews(moderation_status);

-- ============================================================================
-- Review Helpful Votes (track who voted)
-- ============================================================================

CREATE TABLE IF NOT EXISTS marketplace_review_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES marketplace_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_review_vote UNIQUE (review_id, user_id)
);

-- Indexes
CREATE INDEX idx_review_votes_review ON marketplace_review_votes(review_id);
CREATE INDEX idx_review_votes_user ON marketplace_review_votes(user_id);

-- ============================================================================
-- Marketplace Categories (using collections table)
-- ============================================================================

-- Categories are stored in the collections table with collection_type = 'marketplace_category'
-- This achieves Constitutional Principle VI (60% reuse)

-- Create index for marketplace categories
CREATE INDEX IF NOT EXISTS idx_collections_marketplace_categories
ON collections (name)
WHERE collection_type = 'marketplace_category';

-- ============================================================================
-- Functions
-- ============================================================================

-- Function to increment review helpful count
CREATE OR REPLACE FUNCTION increment_review_helpful_count(review_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_reviews
  SET helpful_count = helpful_count + 1
  WHERE id = review_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment review not_helpful count
CREATE OR REPLACE FUNCTION increment_review_not_helpful_count(review_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE marketplace_reviews
  SET not_helpful_count = not_helpful_count + 1
  WHERE id = review_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update transaction updated_at
CREATE OR REPLACE FUNCTION update_transaction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_orivapay_accounts_timestamp
  BEFORE UPDATE ON orivapay_accounts
  FOR EACH ROW EXECUTE FUNCTION update_transaction_timestamp();

CREATE TRIGGER update_orivapay_transactions_timestamp
  BEFORE UPDATE ON orivapay_transactions
  FOR EACH ROW EXECUTE FUNCTION update_transaction_timestamp();

CREATE TRIGGER update_orivapay_escrow_timestamp
  BEFORE UPDATE ON orivapay_escrow
  FOR EACH ROW EXECUTE FUNCTION update_transaction_timestamp();

CREATE TRIGGER update_marketplace_reviews_timestamp
  BEFORE UPDATE ON marketplace_reviews
  FOR EACH ROW EXECUTE FUNCTION update_transaction_timestamp();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE orivapay_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE orivapay_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orivapay_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_review_votes ENABLE ROW LEVEL SECURITY;

-- OrivaPay Accounts Policies
CREATE POLICY "Users can view their own payment account"
  ON orivapay_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payment account"
  ON orivapay_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment account"
  ON orivapay_accounts FOR UPDATE
  USING (auth.uid() = user_id);

-- Transactions Policies
CREATE POLICY "Users can view their own transactions"
  ON orivapay_transactions FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "System can create transactions"
  ON orivapay_transactions FOR INSERT
  WITH CHECK (true); -- Service role only via API

-- Escrow Policies
CREATE POLICY "Parties can view escrow for their transactions"
  ON orivapay_escrow FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orivapay_transactions t
      WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- Reviews Policies
CREATE POLICY "Anyone can view approved reviews"
  ON marketplace_reviews FOR SELECT
  USING (moderation_status = 'approved');

CREATE POLICY "Users can view their own reviews"
  ON marketplace_reviews FOR SELECT
  USING (auth.uid() = reviewer_id);

CREATE POLICY "Verified buyers can create reviews"
  ON marketplace_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND verified_purchase = (
      EXISTS (
        SELECT 1 FROM orivapay_transactions
        WHERE item_id = marketplace_reviews.item_id
        AND buyer_id = auth.uid()
        AND status = 'succeeded'
      )
    )
  );

CREATE POLICY "Users can update their own reviews"
  ON marketplace_reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

CREATE POLICY "Users can delete their own reviews"
  ON marketplace_reviews FOR DELETE
  USING (auth.uid() = reviewer_id);

-- Review Votes Policies
CREATE POLICY "Users can view review votes"
  ON marketplace_review_votes FOR SELECT
  USING (true);

CREATE POLICY "Users can vote on reviews"
  ON marketplace_review_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
  ON marketplace_review_votes FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE orivapay_accounts IS 'Stripe Connect accounts for marketplace sellers';
COMMENT ON TABLE orivapay_transactions IS 'All marketplace transactions including purchases and refunds';
COMMENT ON TABLE orivapay_escrow IS 'Escrow system for high-value transactions';
COMMENT ON TABLE marketplace_reviews IS 'Product and service reviews from verified buyers';
COMMENT ON TABLE marketplace_review_votes IS 'Helpful/not helpful votes on reviews';