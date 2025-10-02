# Data Model: OrivaFlow Marketplace & Commerce

**Feature**: 010-orivaflow-semantic-commerce
**Phase**: 1 - Foundation & Database
**Date**: 2025-01-28

---

## Database Architecture Overview

### Schema Design Principles

1. **Constitutional Compliance**: Extends existing `entries` table rather than creating parallel content system
2. **Multi-Tenant Security**: Row-Level Security (RLS) on all tables
3. **Performance**: Strategic indexes on high-traffic queries (<200ms p95)
4. **Audit Trail**: `created_at`, `updated_at` on all tables
5. **JSONB Flexibility**: Metadata fields for extensibility without schema migrations

### Table Categories

| Category | Tables | Purpose |
|----------|--------|---------|
| **Marketplace Core** | 5 tables | Items, categories, inventory, cart, wishlist |
| **Payments & Finance** | 10 tables | Transactions, escrow, payouts, disputes, refunds |
| **Earner Profiles** | 5 tables | Earner configs, inventory, revenue tracking |
| **Affiliate Network** | 8 tables | Campaigns, URLs, clicks, conversions, commissions |
| **Advertising Network** | 12 tables | Campaigns, creatives, targeting, impressions, clicks |

**Total: 40 new tables + 3 extended existing tables**

---

## Extended Existing Tables

### 1. `entries` (Extended)

**Purpose**: Marketplace items are EntryCards with marketplace metadata

**New Columns**:
```sql
ALTER TABLE entries
ADD COLUMN marketplace_metadata JSONB DEFAULT '{}'::jsonb;

-- Indexes for marketplace queries
CREATE INDEX idx_entries_marketplace_type
  ON entries ((marketplace_metadata->>'item_type'))
  WHERE marketplace_metadata->>'item_type' IS NOT NULL;

CREATE INDEX idx_entries_marketplace_price
  ON entries (((marketplace_metadata->>'price')::numeric))
  WHERE marketplace_metadata->>'price' IS NOT NULL;

CREATE INDEX idx_entries_marketplace_earner
  ON entries ((marketplace_metadata->>'earner_type'))
  WHERE marketplace_metadata->>'earner_type' IS NOT NULL;

CREATE INDEX idx_entries_marketplace_inventory
  ON entries (((marketplace_metadata->>'inventory_count')::integer))
  WHERE marketplace_metadata->>'inventory_count' IS NOT NULL;
```

**Marketplace Metadata Schema**:
```typescript
interface MarketplaceMetadata {
  item_type: 'product' | 'service' | 'extension' | 'content';
  earner_type: 'creator' | 'vendor' | 'developer' | 'advertiser' | 'affiliate' | 'influencer';
  price: number;
  currency: 'USD' | 'EUR' | 'GBP'; // Phase 1: USD only, Phase 6: multi-currency
  inventory_count?: number; // null = infinite/digital
  sku?: string;
  category_ids: string[]; // References collections
  is_published: boolean;
  requires_shipping: boolean;
  shipping_metadata?: {
    weight_oz: number;
    dimensions: { length: number; width: number; height: number };
    origin_country: string;
  };
  digital_delivery?: {
    download_url?: string;
    license_key?: string;
    access_duration_days?: number; // null = perpetual
  };
  extension_metadata?: {
    app_id: string;
    version: string;
    min_oriva_version: string;
    permissions: string[];
    hosting_type: 'external' | 'oriva';
    external_url?: string;
  };
  service_metadata?: {
    delivery_time_days: number;
    requires_consultation: boolean;
    max_revisions: number;
  };
}
```

**RLS Policy**:
```sql
-- Public read for published marketplace items
CREATE POLICY "Public can view published marketplace items"
  ON entries FOR SELECT
  USING (
    marketplace_metadata->>'is_published' = 'true'
    OR user_id = auth.uid()
  );

-- Earners manage their own items
CREATE POLICY "Earners manage own marketplace items"
  ON entries FOR ALL
  USING (user_id = auth.uid());
```

---

### 2. `collections` (Extended)

**Purpose**: Marketplace categories are collections

**New Columns**:
```sql
ALTER TABLE collections
ADD COLUMN collection_type VARCHAR(50) DEFAULT 'standard';

-- Index for marketplace category queries
CREATE INDEX idx_collections_type
  ON collections (collection_type);
```

**Collection Types**:
- `'standard'` - Regular user collections (existing behavior)
- `'marketplace_category'` - Marketplace product categories
- `'wishlist'` - User wishlists
- `'cart'` - Shopping carts (alternative to dedicated cart table)

**Category Hierarchy** (stored in existing `organization_rules` JSONB):
```typescript
interface CategoryMetadata {
  parent_category_id?: string; // null = top-level
  icon?: string;
  display_order: number;
  seo_slug: string;
  meta_description?: string;
}
```

---

### 3. `agreements` (Extended)

**Purpose**: High-value transactions use agreements for escrow

**New Columns**:
```sql
ALTER TABLE agreements
ADD COLUMN marketplace_transaction_id UUID REFERENCES orivapay_transactions(id),
ADD COLUMN escrow_metadata JSONB DEFAULT '{}'::jsonb;

-- Index for transaction lookup
CREATE INDEX idx_agreements_transaction
  ON agreements (marketplace_transaction_id);
```

**Escrow Metadata Schema**:
```typescript
interface EscrowMetadata {
  escrow_amount: number;
  currency: string;
  release_conditions: {
    type: 'manual' | 'milestone' | 'time-based' | 'deliverable';
    criteria: string;
    deadline?: string; // ISO 8601
  }[];
  dispute_resolution: {
    mediator_id?: string;
    resolution_deadline?: string;
  };
}
```

---

## Marketplace Core Tables (5)

### 1. `marketplace_items`

**Purpose**: Extended metadata for marketplace entries (alternative to JSONB-only approach)

**Schema**:
```sql
CREATE TABLE marketplace_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  earner_id UUID NOT NULL REFERENCES profiles(id),
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('product', 'service', 'extension', 'content')),
  earner_type VARCHAR(50) NOT NULL CHECK (earner_type IN ('creator', 'vendor', 'developer', 'advertiser', 'affiliate', 'influencer')),

  -- Pricing
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  commission_rate DECIMAL(5, 2) NOT NULL, -- Platform fee (10-20%)

  -- Inventory
  inventory_count INTEGER, -- null = infinite/digital
  low_stock_threshold INTEGER DEFAULT 10,
  sku VARCHAR(100) UNIQUE,

  -- Publishing
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  unpublished_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_marketplace_items_entry ON marketplace_items(entry_id);
CREATE INDEX idx_marketplace_items_earner ON marketplace_items(earner_id);
CREATE INDEX idx_marketplace_items_type ON marketplace_items(item_type);
CREATE INDEX idx_marketplace_items_published ON marketplace_items(is_published, published_at);
CREATE INDEX idx_marketplace_items_price ON marketplace_items(price);
CREATE INDEX idx_marketplace_items_sku ON marketplace_items(sku);

-- RLS
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published items"
  ON marketplace_items FOR SELECT
  USING (is_published = true);

CREATE POLICY "Earners manage own items"
  ON marketplace_items FOR ALL
  USING (earner_id = auth.uid());
```

**Note**: This table is OPTIONAL if we decide to use `entries.marketplace_metadata` JSONB only. Decision in Phase 1 implementation.

---

### 2. `marketplace_categories`

**Purpose**: Category taxonomy for marketplace (alternative to collections approach)

**Schema**:
```sql
CREATE TABLE marketplace_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES marketplace_categories(id) ON DELETE SET NULL,

  -- Display
  icon VARCHAR(100),
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,

  -- SEO
  meta_description TEXT,
  meta_keywords TEXT[],

  -- Stats
  item_count INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_marketplace_categories_slug ON marketplace_categories(slug);
CREATE INDEX idx_marketplace_categories_parent ON marketplace_categories(parent_id);
CREATE INDEX idx_marketplace_categories_featured ON marketplace_categories(is_featured);

-- RLS
ALTER TABLE marketplace_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view categories"
  ON marketplace_categories FOR SELECT
  USING (true);

CREATE POLICY "Admins manage categories"
  ON marketplace_categories FOR ALL
  USING (is_admin(auth.uid()));
```

**Note**: This table is OPTIONAL if we use `collections` with `collection_type='marketplace_category'`. Decision in Phase 1 implementation.

---

### 3. `marketplace_reviews`

**Purpose**: Product/service reviews (alternative to response system)

**Schema**:
```sql
CREATE TABLE marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  transaction_id UUID REFERENCES orivapay_transactions(id),

  -- Review
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  content TEXT,

  -- Verification
  is_verified_purchase BOOLEAN DEFAULT false,

  -- Moderation
  is_flagged BOOLEAN DEFAULT false,
  moderation_status VARCHAR(50) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),

  -- Helpfulness
  helpful_count INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(item_id, user_id) -- One review per user per item
);

-- Indexes
CREATE INDEX idx_marketplace_reviews_item ON marketplace_reviews(item_id);
CREATE INDEX idx_marketplace_reviews_user ON marketplace_reviews(user_id);
CREATE INDEX idx_marketplace_reviews_rating ON marketplace_reviews(rating);
CREATE INDEX idx_marketplace_reviews_verified ON marketplace_reviews(is_verified_purchase);

-- RLS
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved reviews"
  ON marketplace_reviews FOR SELECT
  USING (moderation_status = 'approved');

CREATE POLICY "Users manage own reviews"
  ON marketplace_reviews FOR ALL
  USING (user_id = auth.uid());
```

**Note**: This table is OPTIONAL if we use the existing response system with `response_type='applaud'` for positive reviews. Decision in Phase 1 implementation.

---

### 4. `marketplace_cart`

**Purpose**: Shopping cart items

**Schema**:
```sql
CREATE TABLE marketplace_cart (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  item_id UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,

  -- Quantity
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),

  -- Pricing snapshot (captures price at time of adding to cart)
  price_snapshot DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Metadata
  custom_options JSONB DEFAULT '{}'::jsonb, -- e.g., size, color, engraving

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, item_id, custom_options) -- Prevent duplicate cart entries
);

-- Indexes
CREATE INDEX idx_marketplace_cart_user ON marketplace_cart(user_id);
CREATE INDEX idx_marketplace_cart_item ON marketplace_cart(item_id);
CREATE INDEX idx_marketplace_cart_updated ON marketplace_cart(updated_at);

-- RLS
ALTER TABLE marketplace_cart ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart"
  ON marketplace_cart FOR ALL
  USING (user_id = auth.uid());
```

---

### 5. `marketplace_wishlist`

**Purpose**: User wishlists

**Schema**:
```sql
CREATE TABLE marketplace_wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  item_id UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,

  -- Privacy
  is_public BOOLEAN DEFAULT false,

  -- Notifications
  notify_on_sale BOOLEAN DEFAULT true,
  notify_on_restock BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, item_id)
);

-- Indexes
CREATE INDEX idx_marketplace_wishlist_user ON marketplace_wishlist(user_id);
CREATE INDEX idx_marketplace_wishlist_item ON marketplace_wishlist(item_id);

-- RLS
ALTER TABLE marketplace_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wishlist"
  ON marketplace_wishlist FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Public wishlists are viewable"
  ON marketplace_wishlist FOR SELECT
  USING (is_public = true);
```

---

## Payments & Finance Tables (10)

### 1. `orivapay_transactions`

**Purpose**: All payment transactions

**Schema**:
```sql
CREATE TABLE orivapay_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Parties
  buyer_id UUID NOT NULL REFERENCES profiles(id),
  seller_id UUID NOT NULL REFERENCES profiles(id),

  -- Transaction details
  item_id UUID REFERENCES marketplace_items(id),
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'refund', 'payout', 'escrow_release', 'commission')),

  -- Amounts (in cents to avoid floating point issues)
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  platform_fee_cents INTEGER NOT NULL,
  stripe_fee_cents INTEGER NOT NULL,
  seller_net_cents INTEGER NOT NULL,

  -- Payment method
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('card', 'bank', 'crypto')),
  payment_method_details JSONB DEFAULT '{}'::jsonb,

  -- Stripe
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_charge_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded', 'disputed')),
  failure_reason TEXT,

  -- Escrow
  uses_escrow BOOLEAN DEFAULT false,
  escrow_release_date TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_transactions_buyer ON orivapay_transactions(buyer_id);
CREATE INDEX idx_orivapay_transactions_seller ON orivapay_transactions(seller_id);
CREATE INDEX idx_orivapay_transactions_item ON orivapay_transactions(item_id);
CREATE INDEX idx_orivapay_transactions_status ON orivapay_transactions(status);
CREATE INDEX idx_orivapay_transactions_type ON orivapay_transactions(transaction_type);
CREATE INDEX idx_orivapay_transactions_stripe_intent ON orivapay_transactions(stripe_payment_intent_id);
CREATE INDEX idx_orivapay_transactions_created ON orivapay_transactions(created_at);

-- RLS
ALTER TABLE orivapay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions"
  ON orivapay_transactions FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "System creates transactions"
  ON orivapay_transactions FOR INSERT
  WITH CHECK (true); -- Handled by service layer
```

---

### 2. `orivapay_accounts`

**Purpose**: Stripe Connect account mapping

**Schema**:
```sql
CREATE TABLE orivapay_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,

  -- Stripe
  stripe_account_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_account_type VARCHAR(50) NOT NULL DEFAULT 'standard' CHECK (stripe_account_type IN ('standard', 'express', 'custom')),

  -- Status
  onboarding_completed BOOLEAN DEFAULT false,
  charges_enabled BOOLEAN DEFAULT false,
  payouts_enabled BOOLEAN DEFAULT false,

  -- Verification
  verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verification_fields_needed TEXT[],

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_accounts_user ON orivapay_accounts(user_id);
CREATE INDEX idx_orivapay_accounts_stripe ON orivapay_accounts(stripe_account_id);
CREATE INDEX idx_orivapay_accounts_status ON orivapay_accounts(verification_status);

-- RLS
ALTER TABLE orivapay_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own account"
  ON orivapay_accounts FOR ALL
  USING (user_id = auth.uid());
```

---

### 3. `orivapay_payouts`

**Purpose**: Payout scheduling and tracking

**Schema**:
```sql
CREATE TABLE orivapay_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Recipient
  earner_id UUID NOT NULL REFERENCES profiles(id),
  stripe_account_id VARCHAR(255) NOT NULL,

  -- Amount
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Stripe
  stripe_payout_id VARCHAR(255) UNIQUE,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'paid', 'failed', 'canceled')),
  failure_reason TEXT,

  -- Timing
  scheduled_date DATE NOT NULL,
  arrival_date DATE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_payouts_earner ON orivapay_payouts(earner_id);
CREATE INDEX idx_orivapay_payouts_status ON orivapay_payouts(status);
CREATE INDEX idx_orivapay_payouts_scheduled ON orivapay_payouts(scheduled_date);
CREATE INDEX idx_orivapay_payouts_stripe ON orivapay_payouts(stripe_payout_id);

-- RLS
ALTER TABLE orivapay_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Earners view own payouts"
  ON orivapay_payouts FOR SELECT
  USING (earner_id = auth.uid());
```

---

### 4. `orivapay_refunds`

**Purpose**: Refund requests and processing

**Schema**:
```sql
CREATE TABLE orivapay_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Transaction
  transaction_id UUID NOT NULL REFERENCES orivapay_transactions(id),

  -- Amount
  refund_amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  refund_type VARCHAR(50) NOT NULL CHECK (refund_type IN ('full', 'partial')),

  -- Reason
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('requested_by_customer', 'duplicate', 'fraudulent', 'defective_product', 'service_not_delivered')),
  reason_details TEXT,

  -- Stripe
  stripe_refund_id VARCHAR(255) UNIQUE,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'canceled')),
  failure_reason TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_refunds_transaction ON orivapay_refunds(transaction_id);
CREATE INDEX idx_orivapay_refunds_status ON orivapay_refunds(status);
CREATE INDEX idx_orivapay_refunds_stripe ON orivapay_refunds(stripe_refund_id);

-- RLS
ALTER TABLE orivapay_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transaction parties view refunds"
  ON orivapay_refunds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orivapay_transactions t
      WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );
```

---

### 5. `orivapay_disputes`

**Purpose**: Payment disputes and chargebacks

**Schema**:
```sql
CREATE TABLE orivapay_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Transaction
  transaction_id UUID NOT NULL REFERENCES orivapay_transactions(id),

  -- Dispute details
  dispute_reason VARCHAR(50) NOT NULL CHECK (dispute_reason IN ('fraudulent', 'product_not_received', 'product_unacceptable', 'duplicate', 'credit_not_processed')),
  dispute_evidence TEXT,

  -- Stripe
  stripe_dispute_id VARCHAR(255) UNIQUE,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'warning_needs_response' CHECK (status IN ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost')),

  -- Response
  seller_response TEXT,
  seller_response_at TIMESTAMP WITH TIME ZONE,
  evidence_submission_due DATE,

  -- Resolution
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_disputes_transaction ON orivapay_disputes(transaction_id);
CREATE INDEX idx_orivapay_disputes_status ON orivapay_disputes(status);
CREATE INDEX idx_orivapay_disputes_stripe ON orivapay_disputes(stripe_dispute_id);
CREATE INDEX idx_orivapay_disputes_due ON orivapay_disputes(evidence_submission_due);

-- RLS
ALTER TABLE orivapay_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transaction parties view disputes"
  ON orivapay_disputes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orivapay_transactions t
      WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

CREATE POLICY "Sellers respond to disputes"
  ON orivapay_disputes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM orivapay_transactions t
      WHERE t.id = transaction_id
      AND t.seller_id = auth.uid()
    )
  );
```

---

### 6. `orivapay_escrow`

**Purpose**: Escrow account management

**Schema**:
```sql
CREATE TABLE orivapay_escrow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Transaction
  transaction_id UUID NOT NULL REFERENCES orivapay_transactions(id) UNIQUE,
  agreement_id UUID REFERENCES agreements(id),

  -- Amount
  escrowed_amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Release conditions
  release_type VARCHAR(50) NOT NULL CHECK (release_type IN ('manual', 'milestone', 'time-based', 'deliverable')),
  release_conditions JSONB NOT NULL,
  conditions_met JSONB DEFAULT '{}'::jsonb,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'disputed', 'refunded')),

  -- Release
  released_at TIMESTAMP WITH TIME ZONE,
  released_by UUID REFERENCES profiles(id),
  release_notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_escrow_transaction ON orivapay_escrow(transaction_id);
CREATE INDEX idx_orivapay_escrow_agreement ON orivapay_escrow(agreement_id);
CREATE INDEX idx_orivapay_escrow_status ON orivapay_escrow(status);

-- RLS
ALTER TABLE orivapay_escrow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transaction parties view escrow"
  ON orivapay_escrow FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orivapay_transactions t
      WHERE t.id = transaction_id
      AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );
```

---

### 7. `orivapay_payment_methods`

**Purpose**: Saved payment methods

**Schema**:
```sql
CREATE TABLE orivapay_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Stripe
  stripe_payment_method_id VARCHAR(255) NOT NULL UNIQUE,

  -- Type
  payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('card', 'bank_account', 'crypto_wallet')),

  -- Card details (masked)
  card_brand VARCHAR(50),
  card_last4 VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,

  -- Bank details (masked)
  bank_name VARCHAR(100),
  bank_last4 VARCHAR(4),

  -- Crypto details
  crypto_network VARCHAR(50),
  crypto_address_masked VARCHAR(100),

  -- Settings
  is_default BOOLEAN DEFAULT false,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_payment_methods_user ON orivapay_payment_methods(user_id);
CREATE INDEX idx_orivapay_payment_methods_stripe ON orivapay_payment_methods(stripe_payment_method_id);
CREATE INDEX idx_orivapay_payment_methods_default ON orivapay_payment_methods(user_id, is_default);

-- RLS
ALTER TABLE orivapay_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own payment methods"
  ON orivapay_payment_methods FOR ALL
  USING (user_id = auth.uid());
```

---

### 8. `orivapay_webhooks`

**Purpose**: Stripe webhook event log

**Schema**:
```sql
CREATE TABLE orivapay_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Stripe event
  stripe_event_id VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(100) NOT NULL,

  -- Payload
  event_data JSONB NOT NULL,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Audit
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_webhooks_stripe_event ON orivapay_webhooks(stripe_event_id);
CREATE INDEX idx_orivapay_webhooks_type ON orivapay_webhooks(event_type);
CREATE INDEX idx_orivapay_webhooks_processed ON orivapay_webhooks(processed);
CREATE INDEX idx_orivapay_webhooks_received ON orivapay_webhooks(received_at);

-- No RLS (system table, accessed by service layer only)
```

---

### 9. `orivapay_tax_records`

**Purpose**: Tax compliance tracking (1099, VAT, GST)

**Schema**:
```sql
CREATE TABLE orivapay_tax_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Earner
  earner_id UUID NOT NULL REFERENCES profiles(id),

  -- Tax year
  tax_year INTEGER NOT NULL,

  -- Earnings
  total_earnings_cents INTEGER NOT NULL,
  platform_fees_cents INTEGER NOT NULL,
  net_earnings_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Tax forms
  requires_1099 BOOLEAN DEFAULT false,
  form_1099_issued BOOLEAN DEFAULT false,
  form_1099_issued_at TIMESTAMP WITH TIME ZONE,

  -- International
  vat_collected_cents INTEGER DEFAULT 0,
  gst_collected_cents INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(earner_id, tax_year)
);

-- Indexes
CREATE INDEX idx_orivapay_tax_records_earner ON orivapay_tax_records(earner_id);
CREATE INDEX idx_orivapay_tax_records_year ON orivapay_tax_records(tax_year);

-- RLS
ALTER TABLE orivapay_tax_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Earners view own tax records"
  ON orivapay_tax_records FOR SELECT
  USING (earner_id = auth.uid());
```

---

### 10. `orivapay_revenue_shares`

**Purpose**: Multi-party revenue splits

**Schema**:
```sql
CREATE TABLE orivapay_revenue_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Transaction
  transaction_id UUID NOT NULL REFERENCES orivapay_transactions(id),

  -- Recipient
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('affiliate', 'influencer', 'platform', 'creator_split')),

  -- Amount
  share_amount_cents INTEGER NOT NULL,
  share_percentage DECIMAL(5, 2),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Payout
  payout_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  payout_id UUID REFERENCES orivapay_payouts(id),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orivapay_revenue_shares_transaction ON orivapay_revenue_shares(transaction_id);
CREATE INDEX idx_orivapay_revenue_shares_recipient ON orivapay_revenue_shares(recipient_id);
CREATE INDEX idx_orivapay_revenue_shares_type ON orivapay_revenue_shares(recipient_type);
CREATE INDEX idx_orivapay_revenue_shares_status ON orivapay_revenue_shares(payout_status);

-- RLS
ALTER TABLE orivapay_revenue_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients view own shares"
  ON orivapay_revenue_shares FOR SELECT
  USING (recipient_id = auth.uid());
```

---

## Earner Profiles Tables (5)

### 1. `earner_profiles`

**Purpose**: Earner type configuration

**Schema**:
```sql
CREATE TABLE earner_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,

  -- Earner types (can have multiple)
  is_creator BOOLEAN DEFAULT false,
  is_vendor BOOLEAN DEFAULT false,
  is_developer BOOLEAN DEFAULT false,
  is_advertiser BOOLEAN DEFAULT false,
  is_affiliate BOOLEAN DEFAULT false,
  is_influencer BOOLEAN DEFAULT false,

  -- Commission rates (by type)
  creator_commission_rate DECIMAL(5, 2) DEFAULT 15.00,
  vendor_commission_rate DECIMAL(5, 2) DEFAULT 12.00,
  developer_commission_rate DECIMAL(5, 2) DEFAULT 20.00,
  advertiser_commission_rate DECIMAL(5, 2) DEFAULT 0.00, -- Advertisers pay, not get paid commissions
  affiliate_commission_rate DECIMAL(5, 2) DEFAULT 10.00,
  influencer_commission_rate DECIMAL(5, 2) DEFAULT 18.00,

  -- Business info
  business_name VARCHAR(200),
  business_type VARCHAR(50) CHECK (business_type IN ('individual', 'sole_proprietor', 'llc', 'corporation')),
  tax_id VARCHAR(50), -- Encrypted

  -- Verification
  identity_verified BOOLEAN DEFAULT false,
  business_verified BOOLEAN DEFAULT false,

  -- Settings
  payout_schedule VARCHAR(50) DEFAULT 'weekly' CHECK (payout_schedule IN ('daily', 'weekly', 'biweekly', 'monthly')),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_earner_profiles_user ON earner_profiles(user_id);
CREATE INDEX idx_earner_profiles_creator ON earner_profiles(is_creator) WHERE is_creator = true;
CREATE INDEX idx_earner_profiles_vendor ON earner_profiles(is_vendor) WHERE is_vendor = true;
CREATE INDEX idx_earner_profiles_developer ON earner_profiles(is_developer) WHERE is_developer = true;
CREATE INDEX idx_earner_profiles_advertiser ON earner_profiles(is_advertiser) WHERE is_advertiser = true;
CREATE INDEX idx_earner_profiles_affiliate ON earner_profiles(is_affiliate) WHERE is_affiliate = true;
CREATE INDEX idx_earner_profiles_influencer ON earner_profiles(is_influencer) WHERE is_influencer = true;

-- RLS
ALTER TABLE earner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own earner profile"
  ON earner_profiles FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Public can view basic earner info"
  ON earner_profiles FOR SELECT
  USING (true); -- Public earner profiles (limited fields via API)
```

---

### 2. `earner_revenue`

**Purpose**: Revenue tracking by earner

**Schema**:
```sql
CREATE TABLE earner_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  earner_id UUID NOT NULL REFERENCES profiles(id),

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Revenue
  gross_revenue_cents INTEGER NOT NULL DEFAULT 0,
  platform_fees_cents INTEGER NOT NULL DEFAULT 0,
  stripe_fees_cents INTEGER NOT NULL DEFAULT 0,
  refunds_cents INTEGER NOT NULL DEFAULT 0,
  net_revenue_cents INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Stats
  transaction_count INTEGER NOT NULL DEFAULT 0,
  unique_buyers_count INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(earner_id, period_start, period_end)
);

-- Indexes
CREATE INDEX idx_earner_revenue_earner ON earner_revenue(earner_id);
CREATE INDEX idx_earner_revenue_period ON earner_revenue(period_start, period_end);

-- RLS
ALTER TABLE earner_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Earners view own revenue"
  ON earner_revenue FOR SELECT
  USING (earner_id = auth.uid());
```

---

### 3. `earner_inventory`

**Purpose**: Inventory tracking for physical products

**Schema**:
```sql
CREATE TABLE earner_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
  earner_id UUID NOT NULL REFERENCES profiles(id),

  -- Inventory
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,

  -- Thresholds
  low_stock_threshold INTEGER DEFAULT 10,
  reorder_point INTEGER DEFAULT 5,

  -- Locations (for multi-warehouse)
  location VARCHAR(100),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(item_id, location)
);

-- Indexes
CREATE INDEX idx_earner_inventory_item ON earner_inventory(item_id);
CREATE INDEX idx_earner_inventory_earner ON earner_inventory(earner_id);
CREATE INDEX idx_earner_inventory_low_stock ON earner_inventory(available_quantity) WHERE available_quantity <= low_stock_threshold;

-- RLS
ALTER TABLE earner_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Earners manage own inventory"
  ON earner_inventory FOR ALL
  USING (earner_id = auth.uid());
```

---

### 4. `earner_analytics`

**Purpose**: Aggregated analytics for earner dashboards

**Schema**:
```sql
CREATE TABLE earner_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  earner_id UUID NOT NULL REFERENCES profiles(id),

  -- Period
  date DATE NOT NULL,

  -- Traffic
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,

  -- Engagement
  add_to_cart_count INTEGER DEFAULT 0,
  wishlist_count INTEGER DEFAULT 0,

  -- Conversion
  purchase_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0.00,

  -- Revenue
  revenue_cents INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(earner_id, date)
);

-- Indexes
CREATE INDEX idx_earner_analytics_earner ON earner_analytics(earner_id);
CREATE INDEX idx_earner_analytics_date ON earner_analytics(date);

-- RLS
ALTER TABLE earner_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Earners view own analytics"
  ON earner_analytics FOR SELECT
  USING (earner_id = auth.uid());
```

---

### 5. `earner_notifications`

**Purpose**: Earner-specific notifications (low stock, new orders, etc.)

**Schema**:
```sql
CREATE TABLE earner_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  earner_id UUID NOT NULL REFERENCES profiles(id),

  -- Notification
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('new_order', 'low_stock', 'payout_completed', 'dispute_opened', 'review_received')),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,

  -- Link
  link_type VARCHAR(50),
  link_id UUID,

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_earner_notifications_earner ON earner_notifications(earner_id);
CREATE INDEX idx_earner_notifications_unread ON earner_notifications(earner_id, is_read) WHERE is_read = false;
CREATE INDEX idx_earner_notifications_type ON earner_notifications(notification_type);

-- RLS
ALTER TABLE earner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Earners manage own notifications"
  ON earner_notifications FOR ALL
  USING (earner_id = auth.uid());
```

---

## Affiliate Network Tables (8)

### 1. `affiliate_campaigns`

**Purpose**: Affiliate marketing campaigns

**Schema**:
```sql
CREATE TABLE affiliate_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES profiles(id),

  -- Campaign details
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Target
  item_id UUID REFERENCES marketplace_items(id),
  category_id UUID, -- References collections or marketplace_categories

  -- Commission
  commission_rate DECIMAL(5, 2) NOT NULL,
  commission_type VARCHAR(50) NOT NULL CHECK (commission_type IN ('percentage', 'fixed')),
  fixed_commission_cents INTEGER,

  -- Cookie duration
  cookie_duration_days INTEGER DEFAULT 30,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Stats
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  total_earned_cents INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_affiliate_campaigns_affiliate ON affiliate_campaigns(affiliate_id);
CREATE INDEX idx_affiliate_campaigns_item ON affiliate_campaigns(item_id);
CREATE INDEX idx_affiliate_campaigns_active ON affiliate_campaigns(is_active);

-- RLS
ALTER TABLE affiliate_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates manage own campaigns"
  ON affiliate_campaigns FOR ALL
  USING (affiliate_id = auth.uid());

CREATE POLICY "Public can view active campaigns"
  ON affiliate_campaigns FOR SELECT
  USING (is_active = true);
```

---

### 2. `affiliate_urls`

**Purpose**: Shortened affiliate URLs

**Schema**:
```sql
CREATE TABLE affiliate_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- URL
  short_code VARCHAR(20) NOT NULL UNIQUE,
  original_url TEXT NOT NULL,

  -- Ownership
  campaign_id UUID NOT NULL REFERENCES affiliate_campaigns(id) ON DELETE CASCADE,
  affiliate_id UUID NOT NULL REFERENCES profiles(id),

  -- Stats
  click_count INTEGER DEFAULT 0,

  -- Metadata
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_affiliate_urls_short_code ON affiliate_urls(short_code);
CREATE INDEX idx_affiliate_urls_campaign ON affiliate_urls(campaign_id);
CREATE INDEX idx_affiliate_urls_affiliate ON affiliate_urls(affiliate_id);

-- RLS
ALTER TABLE affiliate_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates manage own URLs"
  ON affiliate_urls FOR ALL
  USING (affiliate_id = auth.uid());

CREATE POLICY "Public can resolve URLs"
  ON affiliate_urls FOR SELECT
  USING (true); -- Needed for URL resolution
```

---

### 3. `affiliate_clicks`

**Purpose**: Click tracking for attribution

**Schema**:
```sql
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Attribution
  url_id UUID NOT NULL REFERENCES affiliate_urls(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES affiliate_campaigns(id),
  affiliate_id UUID NOT NULL REFERENCES profiles(id),

  -- Visitor
  visitor_id UUID, -- Anonymous visitor tracking (hashed IP + user agent)
  user_id UUID REFERENCES profiles(id), -- Logged-in user

  -- Context
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,

  -- Geo
  country VARCHAR(2),
  region VARCHAR(100),
  city VARCHAR(100),

  -- Conversion
  converted BOOLEAN DEFAULT false,
  conversion_id UUID REFERENCES orivapay_transactions(id),
  converted_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_affiliate_clicks_url ON affiliate_clicks(url_id);
CREATE INDEX idx_affiliate_clicks_campaign ON affiliate_clicks(campaign_id);
CREATE INDEX idx_affiliate_clicks_affiliate ON affiliate_clicks(affiliate_id);
CREATE INDEX idx_affiliate_clicks_visitor ON affiliate_clicks(visitor_id);
CREATE INDEX idx_affiliate_clicks_converted ON affiliate_clicks(converted) WHERE converted = true;
CREATE INDEX idx_affiliate_clicks_clicked_at ON affiliate_clicks(clicked_at);

-- RLS
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own clicks"
  ON affiliate_clicks FOR SELECT
  USING (affiliate_id = auth.uid());

CREATE POLICY "System tracks clicks"
  ON affiliate_clicks FOR INSERT
  WITH CHECK (true); -- Handled by service layer
```

---

### 4. `affiliate_conversions`

**Purpose**: Conversion tracking and attribution

**Schema**:
```sql
CREATE TABLE affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Attribution
  click_id UUID NOT NULL REFERENCES affiliate_clicks(id),
  campaign_id UUID NOT NULL REFERENCES affiliate_campaigns(id),
  affiliate_id UUID NOT NULL REFERENCES profiles(id),

  -- Transaction
  transaction_id UUID NOT NULL REFERENCES orivapay_transactions(id) UNIQUE,

  -- Commission
  commission_amount_cents INTEGER NOT NULL,
  commission_rate DECIMAL(5, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Payout
  payout_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  payout_id UUID REFERENCES orivapay_payouts(id),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_affiliate_conversions_click ON affiliate_conversions(click_id);
CREATE INDEX idx_affiliate_conversions_campaign ON affiliate_conversions(campaign_id);
CREATE INDEX idx_affiliate_conversions_affiliate ON affiliate_conversions(affiliate_id);
CREATE INDEX idx_affiliate_conversions_transaction ON affiliate_conversions(transaction_id);
CREATE INDEX idx_affiliate_conversions_payout_status ON affiliate_conversions(payout_status);

-- RLS
ALTER TABLE affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own conversions"
  ON affiliate_conversions FOR SELECT
  USING (affiliate_id = auth.uid());
```

---

### 5. `affiliate_commissions`

**Purpose**: Commission calculations and payments

**Schema**:
```sql
CREATE TABLE affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Affiliate
  affiliate_id UUID NOT NULL REFERENCES profiles(id),

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Earnings
  total_commissions_cents INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Payout
  payout_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'paid', 'failed')),
  payout_id UUID REFERENCES orivapay_payouts(id),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(affiliate_id, period_start, period_end)
);

-- Indexes
CREATE INDEX idx_affiliate_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX idx_affiliate_commissions_period ON affiliate_commissions(period_start, period_end);
CREATE INDEX idx_affiliate_commissions_payout_status ON affiliate_commissions(payout_status);

-- RLS
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own commissions"
  ON affiliate_commissions FOR SELECT
  USING (affiliate_id = auth.uid());
```

---

### 6. `affiliate_analytics`

**Purpose**: Aggregated analytics for affiliate dashboards

**Schema**:
```sql
CREATE TABLE affiliate_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES profiles(id),
  campaign_id UUID REFERENCES affiliate_campaigns(id),

  -- Period
  date DATE NOT NULL,

  -- Traffic
  click_count INTEGER DEFAULT 0,
  unique_visitor_count INTEGER DEFAULT 0,

  -- Conversion
  conversion_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0.00,

  -- Revenue
  commission_earned_cents INTEGER DEFAULT 0,
  average_order_value_cents INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(affiliate_id, campaign_id, date)
);

-- Indexes
CREATE INDEX idx_affiliate_analytics_affiliate ON affiliate_analytics(affiliate_id);
CREATE INDEX idx_affiliate_analytics_campaign ON affiliate_analytics(campaign_id);
CREATE INDEX idx_affiliate_analytics_date ON affiliate_analytics(date);

-- RLS
ALTER TABLE affiliate_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own analytics"
  ON affiliate_analytics FOR SELECT
  USING (affiliate_id = auth.uid());
```

---

### 7. `affiliate_payouts`

**Purpose**: Affiliate payout history

**Schema**:
```sql
CREATE TABLE affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Affiliate
  affiliate_id UUID NOT NULL REFERENCES profiles(id),

  -- Payout
  payout_id UUID NOT NULL REFERENCES orivapay_payouts(id),

  -- Amount
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_affiliate_payouts_affiliate ON affiliate_payouts(affiliate_id);
CREATE INDEX idx_affiliate_payouts_payout ON affiliate_payouts(payout_id);
CREATE INDEX idx_affiliate_payouts_period ON affiliate_payouts(period_start, period_end);

-- RLS
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own payouts"
  ON affiliate_payouts FOR SELECT
  USING (affiliate_id = auth.uid());
```

---

### 8. `affiliate_referrals`

**Purpose**: Affiliate referral tracking (referring new affiliates)

**Schema**:
```sql
CREATE TABLE affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Referrer
  referrer_id UUID NOT NULL REFERENCES profiles(id),

  -- Referee
  referee_id UUID NOT NULL REFERENCES profiles(id),

  -- Bonus
  referral_bonus_cents INTEGER DEFAULT 0,
  bonus_paid BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(referrer_id, referee_id)
);

-- Indexes
CREATE INDEX idx_affiliate_referrals_referrer ON affiliate_referrals(referrer_id);
CREATE INDEX idx_affiliate_referrals_referee ON affiliate_referrals(referee_id);

-- RLS
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates view own referrals"
  ON affiliate_referrals FOR SELECT
  USING (referrer_id = auth.uid());
```

---

## Advertising Network Tables (12)

### 1. `ad_campaigns`

**Purpose**: Advertising campaign management

**Schema**:
```sql
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id UUID NOT NULL REFERENCES profiles(id),

  -- Campaign details
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Budget
  daily_budget_cents INTEGER NOT NULL,
  total_budget_cents INTEGER NOT NULL,
  spent_cents INTEGER DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Bidding
  bid_type VARCHAR(50) NOT NULL CHECK (bid_type IN ('cpc', 'cpm', 'cpa')),
  bid_amount_cents INTEGER NOT NULL,

  -- Schedule
  start_date DATE NOT NULL,
  end_date DATE,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'completed', 'rejected')),
  rejection_reason TEXT,

  -- Stats
  impression_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_campaigns_advertiser ON ad_campaigns(advertiser_id);
CREATE INDEX idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX idx_ad_campaigns_dates ON ad_campaigns(start_date, end_date);

-- RLS
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers manage own campaigns"
  ON ad_campaigns FOR ALL
  USING (advertiser_id = auth.uid());

CREATE POLICY "Active campaigns are viewable"
  ON ad_campaigns FOR SELECT
  USING (status = 'active');
```

---

### 2. `ad_creatives`

**Purpose**: Ad creative assets (images, text, video)

**Schema**:
```sql
CREATE TABLE ad_creatives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  advertiser_id UUID NOT NULL REFERENCES profiles(id),

  -- Creative details
  name VARCHAR(200) NOT NULL,
  creative_type VARCHAR(50) NOT NULL CHECK (creative_type IN ('image', 'video', 'text', 'carousel')),

  -- Assets
  image_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,

  -- Text
  headline VARCHAR(100),
  body TEXT,
  call_to_action VARCHAR(50),

  -- Link
  destination_url TEXT NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT true,
  moderation_status VARCHAR(50) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,

  -- Stats
  impression_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  ctr DECIMAL(5, 2) DEFAULT 0.00,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_creatives_campaign ON ad_creatives(campaign_id);
CREATE INDEX idx_ad_creatives_advertiser ON ad_creatives(advertiser_id);
CREATE INDEX idx_ad_creatives_active ON ad_creatives(is_active);

-- RLS
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers manage own creatives"
  ON ad_creatives FOR ALL
  USING (advertiser_id = auth.uid());
```

---

### 3. `ad_targeting`

**Purpose**: Ad targeting rules

**Schema**:
```sql
CREATE TABLE ad_targeting (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,

  -- Demographics
  age_min INTEGER,
  age_max INTEGER,
  genders TEXT[],
  languages TEXT[],

  -- Geo
  countries TEXT[],
  regions TEXT[],
  cities TEXT[],

  -- Interests
  interest_keywords TEXT[],
  excluded_keywords TEXT[],

  -- Behavioral
  semantic_targeting_enabled BOOLEAN DEFAULT true,
  thread_context_keywords TEXT[],

  -- Device
  devices TEXT[], -- ['mobile', 'desktop', 'tablet']
  operating_systems TEXT[], -- ['ios', 'android', 'web']

  -- Schedule
  days_of_week INTEGER[], -- 0 = Sunday, 6 = Saturday
  hours_of_day INTEGER[], -- 0-23

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_targeting_campaign ON ad_targeting(campaign_id);
CREATE INDEX idx_ad_targeting_countries ON ad_targeting USING GIN(countries);
CREATE INDEX idx_ad_targeting_interests ON ad_targeting USING GIN(interest_keywords);

-- RLS
ALTER TABLE ad_targeting ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers manage own targeting"
  ON ad_targeting FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns c
      WHERE c.id = campaign_id
      AND c.advertiser_id = auth.uid()
    )
  );
```

---

### 4. `ad_impressions`

**Purpose**: Ad impression tracking

**Schema**:
```sql
CREATE TABLE ad_impressions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Ad
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id),
  creative_id UUID NOT NULL REFERENCES ad_creatives(id),

  -- User
  user_id UUID REFERENCES profiles(id),
  visitor_id UUID, -- Anonymous visitor

  -- Context
  placement VARCHAR(50) NOT NULL CHECK (placement IN ('feed', 'sidebar', 'thread', 'marketplace')),
  thread_id UUID, -- If shown in thread context

  -- Device
  device_type VARCHAR(50),
  user_agent TEXT,
  ip_address INET,

  -- Geo
  country VARCHAR(2),
  region VARCHAR(100),
  city VARCHAR(100),

  -- Viewability
  is_viewable BOOLEAN DEFAULT true,
  view_duration_ms INTEGER,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_impressions_campaign ON ad_impressions(campaign_id);
CREATE INDEX idx_ad_impressions_creative ON ad_impressions(creative_id);
CREATE INDEX idx_ad_impressions_user ON ad_impressions(user_id);
CREATE INDEX idx_ad_impressions_created_at ON ad_impressions(created_at);

-- Partitioning by date (for performance)
-- CREATE TABLE ad_impressions_2025_01 PARTITION OF ad_impressions
-- FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- RLS
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System tracks impressions"
  ON ad_impressions FOR INSERT
  WITH CHECK (true); -- Handled by service layer

CREATE POLICY "Advertisers view own impressions"
  ON ad_impressions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns c
      WHERE c.id = campaign_id
      AND c.advertiser_id = auth.uid()
    )
  );
```

---

### 5. `ad_clicks`

**Purpose**: Ad click tracking

**Schema**:
```sql
CREATE TABLE ad_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Ad
  impression_id UUID REFERENCES ad_impressions(id),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id),
  creative_id UUID NOT NULL REFERENCES ad_creatives(id),

  -- User
  user_id UUID REFERENCES profiles(id),
  visitor_id UUID,

  -- Context
  placement VARCHAR(50) NOT NULL,
  thread_id UUID,

  -- Device
  device_type VARCHAR(50),
  user_agent TEXT,
  ip_address INET,

  -- Conversion
  converted BOOLEAN DEFAULT false,
  conversion_id UUID REFERENCES orivapay_transactions(id),
  converted_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_clicks_impression ON ad_clicks(impression_id);
CREATE INDEX idx_ad_clicks_campaign ON ad_clicks(campaign_id);
CREATE INDEX idx_ad_clicks_creative ON ad_clicks(creative_id);
CREATE INDEX idx_ad_clicks_user ON ad_clicks(user_id);
CREATE INDEX idx_ad_clicks_converted ON ad_clicks(converted) WHERE converted = true;
CREATE INDEX idx_ad_clicks_clicked_at ON ad_clicks(clicked_at);

-- RLS
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System tracks clicks"
  ON ad_clicks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Advertisers view own clicks"
  ON ad_clicks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns c
      WHERE c.id = campaign_id
      AND c.advertiser_id = auth.uid()
    )
  );
```

---

### 6. `ad_conversions`

**Purpose**: Ad conversion tracking

**Schema**:
```sql
CREATE TABLE ad_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Attribution
  click_id UUID NOT NULL REFERENCES ad_clicks(id),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id),
  creative_id UUID NOT NULL REFERENCES ad_creatives(id),

  -- Transaction
  transaction_id UUID NOT NULL REFERENCES orivapay_transactions(id) UNIQUE,

  -- Revenue
  conversion_value_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_conversions_click ON ad_conversions(click_id);
CREATE INDEX idx_ad_conversions_campaign ON ad_conversions(campaign_id);
CREATE INDEX idx_ad_conversions_creative ON ad_conversions(creative_id);
CREATE INDEX idx_ad_conversions_transaction ON ad_conversions(transaction_id);

-- RLS
ALTER TABLE ad_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers view own conversions"
  ON ad_conversions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns c
      WHERE c.id = campaign_id
      AND c.advertiser_id = auth.uid()
    )
  );
```

---

### 7. `ad_budgets`

**Purpose**: Budget tracking and spend limits

**Schema**:
```sql
CREATE TABLE ad_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,

  -- Period
  date DATE NOT NULL,

  -- Budget
  daily_budget_cents INTEGER NOT NULL,
  spent_cents INTEGER DEFAULT 0,
  remaining_cents INTEGER GENERATED ALWAYS AS (daily_budget_cents - spent_cents) STORED,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Status
  is_budget_exceeded BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(campaign_id, date)
);

-- Indexes
CREATE INDEX idx_ad_budgets_campaign ON ad_budgets(campaign_id);
CREATE INDEX idx_ad_budgets_date ON ad_budgets(date);
CREATE INDEX idx_ad_budgets_exceeded ON ad_budgets(is_budget_exceeded) WHERE is_budget_exceeded = true;

-- RLS
ALTER TABLE ad_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers view own budgets"
  ON ad_budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns c
      WHERE c.id = campaign_id
      AND c.advertiser_id = auth.uid()
    )
  );
```

---

### 8. `ad_analytics`

**Purpose**: Aggregated analytics for advertiser dashboards

**Schema**:
```sql
CREATE TABLE ad_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id),
  creative_id UUID REFERENCES ad_creatives(id),

  -- Period
  date DATE NOT NULL,

  -- Impressions
  impression_count INTEGER DEFAULT 0,
  unique_viewer_count INTEGER DEFAULT 0,

  -- Engagement
  click_count INTEGER DEFAULT 0,
  ctr DECIMAL(5, 2) DEFAULT 0.00,

  -- Conversion
  conversion_count INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0.00,
  conversion_value_cents INTEGER DEFAULT 0,

  -- Cost
  cost_cents INTEGER DEFAULT 0,
  cpc_cents INTEGER DEFAULT 0,
  cpm_cents INTEGER DEFAULT 0,
  cpa_cents INTEGER DEFAULT 0,
  roas DECIMAL(10, 2) DEFAULT 0.00, -- Return on ad spend

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(campaign_id, creative_id, date)
);

-- Indexes
CREATE INDEX idx_ad_analytics_campaign ON ad_analytics(campaign_id);
CREATE INDEX idx_ad_analytics_creative ON ad_analytics(creative_id);
CREATE INDEX idx_ad_analytics_date ON ad_analytics(date);

-- RLS
ALTER TABLE ad_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers view own analytics"
  ON ad_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns c
      WHERE c.id = campaign_id
      AND c.advertiser_id = auth.uid()
    )
  );
```

---

### 9. `ad_semantic_segments`

**Purpose**: Pre-computed semantic audience segments

**Schema**:
```sql
CREATE TABLE ad_semantic_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Segment details
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Semantic
  keyword_embedding VECTOR(1536), -- OpenAI ada-002 embeddings
  interest_keywords TEXT[],

  -- Size
  user_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_semantic_segments_embedding ON ad_semantic_segments USING ivfflat (keyword_embedding vector_cosine_ops);
CREATE INDEX idx_ad_semantic_segments_keywords ON ad_semantic_segments USING GIN(interest_keywords);

-- RLS
ALTER TABLE ad_semantic_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public segments are viewable"
  ON ad_semantic_segments FOR SELECT
  USING (true);
```

---

### 10. `ad_user_segments`

**Purpose**: User segment membership

**Schema**:
```sql
CREATE TABLE ad_user_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id UUID NOT NULL REFERENCES ad_semantic_segments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),

  -- Match score
  relevance_score DECIMAL(5, 2) DEFAULT 0.00,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(segment_id, user_id)
);

-- Indexes
CREATE INDEX idx_ad_user_segments_segment ON ad_user_segments(segment_id);
CREATE INDEX idx_ad_user_segments_user ON ad_user_segments(user_id);

-- RLS
ALTER TABLE ad_user_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own segments"
  ON ad_user_segments FOR SELECT
  USING (user_id = auth.uid());
```

---

### 11. `ad_billing`

**Purpose**: Advertiser billing history

**Schema**:
```sql
CREATE TABLE ad_billing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id UUID NOT NULL REFERENCES profiles(id),

  -- Billing period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Amount
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',

  -- Payment
  stripe_invoice_id VARCHAR(255),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX idx_ad_billing_advertiser ON ad_billing(advertiser_id);
CREATE INDEX idx_ad_billing_period ON ad_billing(period_start, period_end);
CREATE INDEX idx_ad_billing_status ON ad_billing(payment_status);

-- RLS
ALTER TABLE ad_billing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers view own billing"
  ON ad_billing FOR SELECT
  USING (advertiser_id = auth.uid());
```

---

### 12. `ad_fraud_detection`

**Purpose**: Ad fraud detection logs

**Schema**:
```sql
CREATE TABLE ad_fraud_detection (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Event
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('impression', 'click', 'conversion')),
  event_id UUID NOT NULL,
  campaign_id UUID REFERENCES ad_campaigns(id),

  -- Detection
  fraud_score DECIMAL(5, 2) NOT NULL,
  is_fraudulent BOOLEAN DEFAULT false,
  fraud_reasons TEXT[],

  -- Context
  ip_address INET,
  user_agent TEXT,
  visitor_id UUID,
  user_id UUID REFERENCES profiles(id),

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ad_fraud_detection_event ON ad_fraud_detection(event_type, event_id);
CREATE INDEX idx_ad_fraud_detection_campaign ON ad_fraud_detection(campaign_id);
CREATE INDEX idx_ad_fraud_detection_fraudulent ON ad_fraud_detection(is_fraudulent) WHERE is_fraudulent = true;
CREATE INDEX idx_ad_fraud_detection_detected_at ON ad_fraud_detection(detected_at);

-- RLS
ALTER TABLE ad_fraud_detection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advertisers view own fraud detection"
  ON ad_fraud_detection FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns c
      WHERE c.id = campaign_id
      AND c.advertiser_id = auth.uid()
    )
  );
```

---

## Entity Relationship Diagram (High-Level)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EXISTING CORE SYSTEM                            │
│                                                                          │
│  ┌──────────┐     ┌────────────┐     ┌────────────┐     ┌──────────┐  │
│  │ profiles │     │  entries   │     │collections │     │agreements│  │
│  └────┬─────┘     └─────┬──────┘     └─────┬──────┘     └────┬─────┘  │
│       │                 │                    │                  │        │
└───────┼─────────────────┼────────────────────┼──────────────────┼────────┘
        │                 │                    │                  │
┌───────┼─────────────────┼────────────────────┼──────────────────┼────────┐
│       │                 │                    │                  │        │
│       ▼                 ▼                    ▼                  ▼        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    MARKETPLACE CORE                               │   │
│  │  marketplace_items, categories, reviews, cart, wishlist          │   │
│  └────────────────────────┬─────────────────────────────────────────┘   │
│                            │                                             │
│       ┌────────────────────┼────────────────────┐                       │
│       ▼                    ▼                    ▼                       │
│  ┌─────────┐    ┌──────────────────┐    ┌──────────────┐              │
│  │PAYMENTS │    │   AFFILIATES     │    │ ADVERTISING  │              │
│  │         │    │                  │    │              │              │
│  │transactions│  │campaigns         │    │campaigns     │              │
│  │accounts    │  │urls              │    │creatives     │              │
│  │payouts     │  │clicks            │    │impressions   │              │
│  │refunds     │  │conversions       │    │clicks        │              │
│  │disputes    │  │commissions       │    │conversions   │              │
│  │escrow      │  │analytics         │    │analytics     │              │
│  └─────────┘    └──────────────────┘    └──────────────┘              │
│                                                                          │
│                    ┌────────────────────┐                                │
│                    │  EARNER PROFILES   │                                │
│                    │  profiles, revenue,│                                │
│                    │  inventory, analytics│                              │
│                    └────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Migration Strategy

### Phase 1: Core Tables (Week 1)

```sql
-- 1. Extend existing tables
ALTER TABLE entries ADD COLUMN marketplace_metadata JSONB;
ALTER TABLE collections ADD COLUMN collection_type VARCHAR(50);
ALTER TABLE agreements ADD COLUMN marketplace_transaction_id UUID;
ALTER TABLE agreements ADD COLUMN escrow_metadata JSONB;

-- 2. Create marketplace core
CREATE TABLE marketplace_items (...);
CREATE TABLE marketplace_cart (...);
CREATE TABLE marketplace_wishlist (...);

-- 3. Create payment core
CREATE TABLE orivapay_transactions (...);
CREATE TABLE orivapay_accounts (...);
CREATE TABLE orivapay_payment_methods (...);

-- 4. Create earner core
CREATE TABLE earner_profiles (...);
```

### Phase 2: Affiliate & Advertising (Week 2)

```sql
-- 1. Affiliate network
CREATE TABLE affiliate_campaigns (...);
CREATE TABLE affiliate_urls (...);
CREATE TABLE affiliate_clicks (...);
CREATE TABLE affiliate_conversions (...);

-- 2. Advertising network
CREATE TABLE ad_campaigns (...);
CREATE TABLE ad_creatives (...);
CREATE TABLE ad_targeting (...);
CREATE TABLE ad_impressions (...);
CREATE TABLE ad_clicks (...);
```

### Phase 3: Analytics & Optimization (Week 3)

```sql
-- 1. Analytics tables
CREATE TABLE earner_analytics (...);
CREATE TABLE affiliate_analytics (...);
CREATE TABLE ad_analytics (...);

-- 2. Fraud detection
CREATE TABLE ad_fraud_detection (...);

-- 3. Performance indexes
CREATE INDEX idx_entries_marketplace_price ON entries (...);
CREATE INDEX idx_ad_impressions_created_at ON ad_impressions (...);
```

---

## Database Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| **Marketplace item lookup** | <50ms | Index on `entries.marketplace_metadata->>'item_type'` |
| **Cart operations** | <30ms | Composite index on `(user_id, item_id)` |
| **Transaction creation** | <200ms | Async webhook processing |
| **Affiliate URL resolution** | <100ms | Redis cache + index on `short_code` |
| **Ad serving** | <50ms | Pre-computed segments + Redis cache |
| **Analytics aggregation** | <500ms | Daily materialized views |

---

## Backup & Recovery Strategy

1. **Continuous Backups**: Supabase PITR (Point-in-Time Recovery) with 7-day retention
2. **Daily Snapshots**: Full database snapshot at 2 AM UTC
3. **Transaction Logs**: All payment transactions logged to separate audit table
4. **Disaster Recovery**: RTO <1 hour, RPO <5 minutes

---

## Security & Compliance

1. **PCI DSS**: All payment data stored in Stripe, not in Oriva database
2. **GDPR**: User data deletion cascades to all marketplace/payment tables
3. **Encryption**: Tax IDs encrypted at rest with Supabase vault
4. **RLS**: All tables have Row-Level Security policies
5. **Audit Logs**: `created_at`, `updated_at` on all tables

---

## Database Sizing Estimates (Year 1)

| Table | Estimated Rows | Size |
|-------|----------------|------|
| **marketplace_items** | 50,000 | 500 MB |
| **orivapay_transactions** | 10,000,000 | 2 GB |
| **affiliate_clicks** | 50,000,000 | 5 GB |
| **ad_impressions** | 100,000,000 | 10 GB |
| **ad_clicks** | 5,000,000 | 500 MB |
| **Total** | ~165M rows | ~18 GB |

**Projected Year 3**: ~500M rows, ~60 GB (within Supabase Pro limits)

---

## Next Steps

1. ✅ **Phase 1 Artifacts Complete**: research.md, atomic-integration-analysis.md, data-model.md
2. ⏳ **Create quickstart.md**: Developer onboarding guide
3. ⏳ **Create CLAUDE.md**: AI agent implementation guidance
4. ⏳ **Update OrivaFlow_CollaborativeCommerce.md**: Align with expanded spec

---

*Ready for Phase 2: Implementation*