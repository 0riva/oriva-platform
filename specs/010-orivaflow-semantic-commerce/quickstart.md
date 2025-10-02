# OrivaFlow Quickstart Guide

**Feature**: 010-orivaflow-semantic-commerce
**Audience**: Developers implementing marketplace & commerce
**Estimated Time**: 30 minutes to first marketplace item

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Database Setup](#database-setup)
4. [Create Your First Marketplace Item](#create-your-first-marketplace-item)
5. [Implement Checkout Flow](#implement-checkout-flow)
6. [Test OrivaPay Integration](#test-orivapay-integration)
7. [Add Affiliate Tracking](#add-affiliate-tracking)
8. [Deploy to Production](#deploy-to-production)
9. [Common Issues & Solutions](#common-issues--solutions)

---

## Prerequisites

**Before starting**, ensure you have:

1. ✅ Completed Oriva Core setup (see `/docs/active/setup/README.md`)
2. ✅ Node.js 18+ and npm installed
3. ✅ Supabase CLI installed (`npm install -g supabase`)
4. ✅ Stripe CLI installed (for webhook testing)
5. ✅ Vercel CLI installed (`npm install -g vercel`)

**Required Accounts**:
- Stripe Account (test mode)
- Supabase Project
- Vercel Account

**Required Environment Variables**:
```bash
# .env.local
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Development Environment Setup

### Step 1: Pull Latest Code

```bash
cd oriva-core
git checkout main
git pull origin main
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Run Database Migrations

```bash
# Start local Supabase
supabase start

# Run migrations
supabase db push

# Verify tables created
supabase db diff
```

**Expected Output**:
```
✅ marketplace_items table created
✅ orivapay_transactions table created
✅ affiliate_campaigns table created
✅ ad_campaigns table created
```

### Step 4: Start Development Server

```bash
npm start
```

Server should start on `http://localhost:8081`

---

## Database Setup

### Create Extended Schema

The OrivaFlow schema extends existing Oriva tables. Run the following SQL in Supabase Studio:

```sql
-- 1. Extend entries table for marketplace items
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS marketplace_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_entries_marketplace_type
  ON entries ((marketplace_metadata->>'item_type'))
  WHERE marketplace_metadata->>'item_type' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_marketplace_price
  ON entries (((marketplace_metadata->>'price')::numeric))
  WHERE marketplace_metadata->>'price' IS NOT NULL;

-- 2. Extend collections for marketplace categories
ALTER TABLE collections
ADD COLUMN IF NOT EXISTS collection_type VARCHAR(50) DEFAULT 'standard';

CREATE INDEX IF NOT EXISTS idx_collections_type
  ON collections (collection_type);

-- 3. Extend agreements for escrow
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS marketplace_transaction_id UUID,
ADD COLUMN IF NOT EXISTS escrow_metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Enable RLS on new tables (example)
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published items"
  ON marketplace_items FOR SELECT
  USING (is_published = true);

CREATE POLICY "Earners manage own items"
  ON marketplace_items FOR ALL
  USING (earner_id = auth.uid());
```

### Verify Schema

```bash
# Check entries table has marketplace_metadata column
supabase db inspect entries

# Check collections table has collection_type column
supabase db inspect collections
```

---

## Create Your First Marketplace Item

### Step 1: Set Up Earner Profile

First, create an earner profile for the authenticated user:

```typescript
// src/services/marketplace/EarnerProfileService.ts

import { ServiceLocator } from '../ServiceLocator';
import { DatabaseService } from '../DatabaseService';

export class EarnerProfileService {
  private db: DatabaseService;

  constructor() {
    this.db = ServiceLocator.get(DatabaseService);
  }

  async createEarnerProfile(userId: string, earnerTypes: {
    is_creator?: boolean;
    is_vendor?: boolean;
    is_developer?: boolean;
  }) {
    const { data, error } = await this.db.getClient()
      .from('earner_profiles')
      .insert({
        user_id: userId,
        ...earnerTypes,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getEarnerProfile(userId: string) {
    const { data, error } = await this.db.getClient()
      .from('earner_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore "not found"
    return data;
  }
}
```

**Usage**:

```typescript
const earnerService = ServiceLocator.get(EarnerProfileService);
const profile = await earnerService.createEarnerProfile(userId, {
  is_vendor: true,
});
```

### Step 2: Create Marketplace Item (EntryCard Approach)

**Option A: Using Extended Entries Table (Constitutional Approach)**

```typescript
// src/services/marketplace/MarketplaceItemService.ts

import { ServiceLocator } from '../ServiceLocator';
import { DatabaseService } from '../DatabaseService';
import type { MarketplaceMetadata } from '../../types/marketplace';

export class MarketplaceItemService {
  private db: DatabaseService;

  constructor() {
    this.db = ServiceLocator.get(DatabaseService);
  }

  async createMarketplaceItem(
    userId: string,
    content: string,
    marketplaceData: MarketplaceMetadata
  ) {
    // Create entry with marketplace metadata
    const { data, error } = await this.db.getClient()
      .from('entries')
      .insert({
        user_id: userId,
        content,
        entry_type: 'marketplace_item',
        marketplace_metadata: marketplaceData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMarketplaceItems(filters?: {
    item_type?: string;
    earner_type?: string;
    min_price?: number;
    max_price?: number;
  }) {
    let query = this.db.getClient()
      .from('entries')
      .select('*')
      .eq('entry_type', 'marketplace_item')
      .eq('marketplace_metadata->is_published', true);

    if (filters?.item_type) {
      query = query.eq('marketplace_metadata->item_type', filters.item_type);
    }

    if (filters?.earner_type) {
      query = query.eq('marketplace_metadata->earner_type', filters.earner_type);
    }

    if (filters?.min_price) {
      query = query.gte('marketplace_metadata->price', filters.min_price);
    }

    if (filters?.max_price) {
      query = query.lte('marketplace_metadata->price', filters.max_price);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  async publishItem(itemId: string) {
    const { data, error } = await this.db.getClient()
      .from('entries')
      .update({
        marketplace_metadata: {
          ...data.marketplace_metadata,
          is_published: true,
        },
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
```

### Step 3: Create Marketplace Item UI

```typescript
// src/components/organisms/MarketplaceItemCreator.tsx

import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { ServiceLocator } from '../../services/ServiceLocator';
import { MarketplaceItemService } from '../../services/marketplace/MarketplaceItemService';
import { EntryEditor } from '../molecules/EntryEditor';
import { PriceInput } from '../atoms/PriceInput';
import { EarnerTypeSelector } from '../atoms/EarnerTypeSelector';
import { Button } from '../atoms/Button';

interface Props {
  userId: string;
  onItemCreated: (itemId: string) => void;
}

export const MarketplaceItemCreator: React.FC<Props> = ({
  userId,
  onItemCreated,
}) => {
  const [content, setContent] = useState('');
  const [price, setPrice] = useState('');
  const [earnerType, setEarnerType] = useState<'creator' | 'vendor' | 'developer'>('vendor');
  const [itemType, setItemType] = useState<'product' | 'service' | 'extension'>('product');
  const [loading, setLoading] = useState(false);

  const marketplaceService = ServiceLocator.get(MarketplaceItemService);

  const handleCreate = async () => {
    if (!content || !price) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const item = await marketplaceService.createMarketplaceItem(userId, content, {
        item_type: itemType,
        earner_type: earnerType,
        price: parseFloat(price),
        currency: 'USD',
        is_published: false,
        inventory_count: null, // Digital product
        category_ids: [],
        requires_shipping: false,
      });

      Alert.alert('Success', 'Marketplace item created!');
      onItemCreated(item.id);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <EntryEditor
        value={content}
        onChange={setContent}
        placeholder="Describe your product or service..."
      />

      <PriceInput
        value={price}
        onChange={setPrice}
        currency="USD"
      />

      <EarnerTypeSelector
        value={earnerType}
        onChange={setEarnerType}
      />

      <Button
        title={loading ? 'Creating...' : 'Create Marketplace Item'}
        onPress={handleCreate}
        disabled={loading}
      />
    </View>
  );
};
```

### Step 4: Display Marketplace Item

```typescript
// src/components/molecules/MarketplaceItemCard.tsx

import React from 'react';
import { EntryCard } from './EntryCard';
import { PriceTag } from '../atoms/PriceTag';
import { EarnerBadge } from '../atoms/EarnerBadge';
import { BuyButton } from '../atoms/BuyButton';
import type { Entry } from '../../types/entry';

interface Props {
  entry: Entry;
  onBuy: (itemId: string) => void;
}

export const MarketplaceItemCard: React.FC<Props> = ({ entry, onBuy }) => {
  const metadata = entry.marketplace_metadata;

  return (
    <EntryCard entry={entry}>
      <PriceTag
        price={metadata.price}
        currency={metadata.currency}
      />
      <EarnerBadge type={metadata.earner_type} />
      <BuyButton onPress={() => onBuy(entry.id)} />
    </EntryCard>
  );
};
```

### Step 5: Test Marketplace Item Creation

```bash
# Run the app
npm start

# Navigate to marketplace creator screen
# Create a test product:
# - Content: "Premium AI Template Bundle"
# - Price: $29.99
# - Type: product
# - Earner Type: creator

# Verify in Supabase Studio:
# SELECT * FROM entries WHERE entry_type = 'marketplace_item';
```

---

## Implement Checkout Flow

### Step 1: Set Up Stripe Connect

```typescript
// src/services/payments/StripeService.ts

import Stripe from 'stripe';
import { ServiceLocator } from '../ServiceLocator';

export class StripeService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16',
    });
  }

  async createConnectedAccount(userId: string, email: string) {
    const account = await this.stripe.accounts.create({
      type: 'standard',
      email,
      metadata: { oriva_user_id: userId },
    });

    return account;
  }

  async createAccountLink(accountId: string) {
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/earner/onboarding/refresh`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/earner/onboarding/complete`,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  async createPaymentIntent(
    amount: number, // in cents
    currency: string,
    sellerId: string,
    platformFee: number // in cents
  ) {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency,
      application_fee_amount: platformFee,
      transfer_data: {
        destination: sellerId, // Stripe account ID
      },
      metadata: {
        platform: 'oriva',
      },
    });

    return paymentIntent;
  }
}
```

### Step 2: Create Checkout Service

```typescript
// src/services/payments/CheckoutService.ts

import { ServiceLocator } from '../ServiceLocator';
import { StripeService } from './StripeService';
import { DatabaseService } from '../DatabaseService';

export class CheckoutService {
  private stripe: StripeService;
  private db: DatabaseService;

  constructor() {
    this.stripe = ServiceLocator.get(StripeService);
    this.db = ServiceLocator.get(DatabaseService);
  }

  async createCheckoutSession(
    buyerId: string,
    itemId: string,
    quantity: number = 1
  ) {
    // 1. Get item details
    const { data: item } = await this.db.getClient()
      .from('entries')
      .select('*, profiles!inner(*)')
      .eq('id', itemId)
      .single();

    if (!item) throw new Error('Item not found');

    const metadata = item.marketplace_metadata;
    const sellerId = item.user_id;

    // 2. Get seller's Stripe account
    const { data: sellerAccount } = await this.db.getClient()
      .from('orivapay_accounts')
      .select('stripe_account_id')
      .eq('user_id', sellerId)
      .single();

    if (!sellerAccount) throw new Error('Seller not onboarded');

    // 3. Calculate fees
    const subtotal = Math.round(metadata.price * 100 * quantity); // Convert to cents
    const platformFeeRate = this.getPlatformFeeRate(metadata.earner_type);
    const platformFee = Math.round(subtotal * platformFeeRate);

    // 4. Create payment intent
    const paymentIntent = await this.stripe.createPaymentIntent(
      subtotal,
      metadata.currency.toLowerCase(),
      sellerAccount.stripe_account_id,
      platformFee
    );

    // 5. Create transaction record
    const { data: transaction } = await this.db.getClient()
      .from('orivapay_transactions')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        item_id: itemId,
        transaction_type: 'purchase',
        amount_cents: subtotal,
        currency: metadata.currency,
        platform_fee_cents: platformFee,
        stripe_fee_cents: Math.round(subtotal * 0.029 + 30), // Stripe fee estimate
        seller_net_cents: subtotal - platformFee - Math.round(subtotal * 0.029 + 30),
        payment_method: 'card',
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
      })
      .select()
      .single();

    return {
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction.id,
    };
  }

  private getPlatformFeeRate(earnerType: string): number {
    const rates = {
      creator: 0.15,
      vendor: 0.12,
      developer: 0.20,
      influencer: 0.18,
      affiliate: 0.10,
    };
    return rates[earnerType] || 0.15;
  }
}
```

### Step 3: Create Checkout UI

```typescript
// src/components/organisms/CheckoutFlow.tsx

import React, { useState, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { CardField, useConfirmPayment } from '@stripe/stripe-react-native';
import { ServiceLocator } from '../../services/ServiceLocator';
import { CheckoutService } from '../../services/payments/CheckoutService';
import { Button } from '../atoms/Button';
import { CheckoutSummary } from '../molecules/CheckoutSummary';

interface Props {
  itemId: string;
  buyerId: string;
  onComplete: (transactionId: string) => void;
}

export const CheckoutFlow: React.FC<Props> = ({
  itemId,
  buyerId,
  onComplete,
}) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { confirmPayment } = useConfirmPayment();
  const checkoutService = ServiceLocator.get(CheckoutService);

  useEffect(() => {
    initCheckout();
  }, []);

  const initCheckout = async () => {
    try {
      const session = await checkoutService.createCheckoutSession(buyerId, itemId);
      setClientSecret(session.clientSecret);
      setTransactionId(session.transactionId);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handlePayment = async () => {
    if (!clientSecret) return;

    setLoading(true);

    try {
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        Alert.alert('Payment failed', error.message);
      } else if (paymentIntent) {
        Alert.alert('Success', 'Payment completed!');
        onComplete(transactionId!);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <CheckoutSummary itemId={itemId} />

      <CardField
        postalCodeEnabled={true}
        placeholder={{
          number: '4242 4242 4242 4242',
        }}
        cardStyle={{
          backgroundColor: '#FFFFFF',
          textColor: '#000000',
        }}
        style={{
          width: '100%',
          height: 50,
          marginVertical: 30,
        }}
      />

      <Button
        title={loading ? 'Processing...' : 'Complete Purchase'}
        onPress={handlePayment}
        disabled={loading || !clientSecret}
      />
    </View>
  );
};
```

---

## Test OrivaPay Integration

### Step 1: Start Stripe CLI for Webhooks

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

**Expected Output**:
```
Ready! Your webhook signing secret is whsec_... (^C to quit)
```

Copy the webhook secret to `.env.local`:
```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 2: Create Webhook Handler

```typescript
// pages/api/webhooks/stripe.ts

import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { ServiceLocator } from '../../../src/services/ServiceLocator';
import { DatabaseService } from '../../../src/services/DatabaseService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    const body = await buffer(req);
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const db = ServiceLocator.get(DatabaseService);

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Update transaction status
      await db.getClient()
        .from('orivapay_transactions')
        .update({ status: 'succeeded' })
        .eq('stripe_payment_intent_id', paymentIntent.id);

      console.log('PaymentIntent succeeded:', paymentIntent.id);
      break;

    case 'payment_intent.payment_failed':
      const failedIntent = event.data.object as Stripe.PaymentIntent;

      await db.getClient()
        .from('orivapay_transactions')
        .update({
          status: 'failed',
          failure_reason: failedIntent.last_payment_error?.message,
        })
        .eq('stripe_payment_intent_id', failedIntent.id);

      console.log('PaymentIntent failed:', failedIntent.id);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
}

async function buffer(req: NextApiRequest) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
```

### Step 3: Test Payment Flow

```bash
# Trigger a test payment using Stripe test card
# Card number: 4242 4242 4242 4242
# Expiry: Any future date
# CVC: Any 3 digits
# ZIP: Any 5 digits

# Check webhook events in terminal
# Verify transaction status updated in Supabase
```

---

## Add Affiliate Tracking

### Step 1: Create Affiliate Service

```typescript
// src/services/affiliate/AffiliateService.ts

import { ServiceLocator } from '../ServiceLocator';
import { DatabaseService } from '../DatabaseService';
import { nanoid } from 'nanoid';

export class AffiliateService {
  private db: DatabaseService;

  constructor() {
    this.db = ServiceLocator.get(DatabaseService);
  }

  async createAffiliateCampaign(
    affiliateId: string,
    itemId: string,
    commissionRate: number
  ) {
    const { data, error } = await this.db.getClient()
      .from('affiliate_campaigns')
      .insert({
        affiliate_id: affiliateId,
        item_id: itemId,
        name: `Campaign for item ${itemId}`,
        commission_rate: commissionRate,
        commission_type: 'percentage',
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createAffiliateURL(
    campaignId: string,
    affiliateId: string,
    originalUrl: string
  ) {
    const shortCode = nanoid(8);

    const { data, error } = await this.db.getClient()
      .from('affiliate_urls')
      .insert({
        short_code: shortCode,
        original_url: originalUrl,
        campaign_id: campaignId,
        affiliate_id: affiliateId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      shortUrl: `${process.env.NEXT_PUBLIC_APP_URL}/a/${shortCode}`,
    };
  }

  async resolveAffiliateURL(shortCode: string) {
    const { data, error } = await this.db.getClient()
      .from('affiliate_urls')
      .select('*')
      .eq('short_code', shortCode)
      .single();

    if (error) throw error;

    // Increment click count
    await this.db.getClient()
      .from('affiliate_urls')
      .update({ click_count: data.click_count + 1 })
      .eq('id', data.id);

    return data;
  }

  async trackClick(
    urlId: string,
    campaignId: string,
    affiliateId: string,
    context: {
      visitorId?: string;
      userId?: string;
      referrer?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ) {
    const { data, error } = await this.db.getClient()
      .from('affiliate_clicks')
      .insert({
        url_id: urlId,
        campaign_id: campaignId,
        affiliate_id: affiliateId,
        ...context,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
```

### Step 2: Create Affiliate URL Resolution Endpoint

```typescript
// pages/api/a/[shortCode].ts

import { NextApiRequest, NextApiResponse } from 'next';
import { ServiceLocator } from '../../../src/services/ServiceLocator';
import { AffiliateService } from '../../../src/services/affiliate/AffiliateService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { shortCode } = req.query;

  if (typeof shortCode !== 'string') {
    return res.status(400).json({ error: 'Invalid short code' });
  }

  const affiliateService = ServiceLocator.get(AffiliateService);

  try {
    const url = await affiliateService.resolveAffiliateURL(shortCode);

    // Track click
    await affiliateService.trackClick(
      url.id,
      url.campaign_id,
      url.affiliate_id,
      {
        referrer: req.headers.referer,
        userAgent: req.headers['user-agent'],
        ipAddress: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      }
    );

    // Redirect to original URL
    res.redirect(302, url.original_url);
  } catch (error) {
    console.error('Affiliate URL resolution failed:', error);
    res.redirect(302, process.env.NEXT_PUBLIC_APP_URL!);
  }
}
```

### Step 3: Test Affiliate Tracking

```bash
# Create affiliate campaign
curl -X POST http://localhost:3000/api/affiliate/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "affiliateId": "user_123",
    "itemId": "item_456",
    "commissionRate": 10.0
  }'

# Create affiliate URL
curl -X POST http://localhost:3000/api/affiliate/urls \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "campaign_789",
    "affiliateId": "user_123",
    "originalUrl": "https://oriva.app/marketplace/item/456"
  }'

# Test URL resolution
curl http://localhost:3000/a/abc12345

# Verify click tracked in Supabase
SELECT * FROM affiliate_clicks ORDER BY clicked_at DESC LIMIT 10;
```

---

## Deploy to Production

### Step 1: Environment Variables

Set production environment variables in Vercel:

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_PUBLISHABLE_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
```

### Step 2: Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Verify deployment
vercel ls
```

### Step 3: Configure Stripe Webhooks (Production)

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `account.updated`
   - `payout.created`
   - `payout.paid`
4. Copy webhook signing secret to Vercel env vars

### Step 4: Run Database Migrations (Production)

```bash
# Connect to production Supabase
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

### Step 5: Verify Production Deployment

```bash
# Test marketplace item creation
curl -X POST https://your-domain.vercel.app/api/marketplace/items \
  -H "Authorization: Bearer $SUPABASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Premium AI Template Bundle",
    "price": 29.99,
    "currency": "USD",
    "item_type": "product",
    "earner_type": "creator"
  }'

# Test affiliate URL resolution
curl https://your-domain.vercel.app/a/abc12345
```

---

## Common Issues & Solutions

### Issue 1: "Marketplace metadata column not found"

**Solution**:
```sql
ALTER TABLE entries ADD COLUMN marketplace_metadata JSONB DEFAULT '{}'::jsonb;
```

### Issue 2: "Stripe webhook signature verification failed"

**Solution**:
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard
- Check webhook endpoint URL is correct
- Ensure `bodyParser` is disabled in API route config

### Issue 3: "RLS policy blocks insert"

**Solution**:
```sql
-- Grant insert permission for authenticated users
CREATE POLICY "Users can create marketplace items"
  ON marketplace_items FOR INSERT
  WITH CHECK (earner_id = auth.uid());
```

### Issue 4: "ServiceLocator not registered"

**Solution**:
```typescript
// Ensure service is registered in ServiceLocator
ServiceLocator.register(MarketplaceItemService, new MarketplaceItemService());
```

### Issue 5: "Affiliate URL resolution slow"

**Solution**:
```sql
-- Add index on short_code
CREATE INDEX idx_affiliate_urls_short_code ON affiliate_urls(short_code);

-- Use Vercel Edge Functions for <100ms resolution
```

---

## Next Steps

1. ✅ **Marketplace Items**: Create and display marketplace items
2. ✅ **Checkout Flow**: Implement Stripe payment integration
3. ✅ **Affiliate Tracking**: Set up affiliate URL resolution and click tracking
4. ⏳ **Ad Serving**: Implement advertising network (see `plan.md` Phase 7)
5. ⏳ **Semantic Commerce**: Integrate Hugo AI for contextual recommendations (Phase 8)
6. ⏳ **Mobile Optimization**: PWA setup for iOS/Android (Phase 9)

---

## Resources

- **Stripe Docs**: https://stripe.com/docs/connect
- **Supabase RLS Guide**: https://supabase.com/docs/guides/auth/row-level-security
- **Vercel Edge Functions**: https://vercel.com/docs/functions/edge-functions
- **React Native Stripe**: https://github.com/stripe/stripe-react-native

---

## Support

- **GitHub Issues**: https://github.com/oriva/oriva-core/issues
- **Slack**: #orivaflow-dev
- **Email**: dev@oriva.com

---

**Ready to build the marketplace! 🚀**