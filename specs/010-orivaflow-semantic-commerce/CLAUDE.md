# OrivaFlow - AI Agent Implementation Guide

**Feature**: 010-orivaflow-semantic-commerce
**Audience**: AI Agents (Claude Code, Cursor, etc.)
**Last Updated**: 2025-01-28

---

## Purpose of This Document

This document provides **AI-optimized guidance** for implementing OrivaFlow marketplace and commerce systems. It is designed to help AI agents:

1. **Understand Constitutional Compliance**: How to extend existing atomic systems
2. **Navigate Complex Architecture**: Marketplace, payments, affiliates, advertising
3. **Follow Implementation Patterns**: ServiceLocator, RLS, TDD workflows
4. **Avoid Common Pitfalls**: Design violations, performance issues, security gaps

---

## Quick Reference

| Task | Start Here | Key Files |
|------|-----------|-----------|
| **Create marketplace item** | [Marketplace Implementation](#marketplace-implementation) | `MarketplaceItemService.ts`, `entries` table |
| **Implement checkout** | [Payment Implementation](#payment-implementation) | `CheckoutService.ts`, `StripeService.ts` |
| **Add affiliate tracking** | [Affiliate Implementation](#affiliate-implementation) | `AffiliateService.ts`, `affiliate_urls` table |
| **Build ad serving** | [Advertising Implementation](#advertising-implementation) | `AdServingService.ts`, Vercel Edge Functions |
| **Integrate Hugo AI** | [Semantic Commerce](#semantic-commerce-integration) | `SemanticCommerceService.ts`, Hugo AI API |

---

## Constitutional Compliance Checklist

Before implementing any feature, verify:

- [ ] **Extends EntryCard**: Marketplace items ARE EntryCards with `marketplace_metadata`
- [ ] **Uses ServiceLocator**: All services registered via ServiceLocator pattern
- [ ] **Follows Atomic Design**: atoms → molecules → organisms hierarchy
- [ ] **TDD Workflow**: Tests before implementation
- [ ] **RLS Security**: Row-Level Security policies on all tables
- [ ] **Performance Targets**: <200ms API, <16ms renders, <100ms Edge Functions

see memory/constitution_update_checklist.md

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React Native + Web)             │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ MarketplaceFeed│  │ EarnerDashboard│  │ CheckoutFlow   │    │
│  │  (Organism)    │  │  (Organism)    │  │  (Organism)    │    │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘    │
│           │                   │                    │             │
│  ┌────────▼───────────────────▼────────────────────▼───────┐    │
│  │              SERVICE LAYER (ServiceLocator)             │    │
│  │  MarketplaceItemService | CheckoutService              │    │
│  │  AffiliateService | AdServingService                   │    │
│  │  SemanticCommerceService                               │    │
│  └────────┬───────────────────┬────────────────────┬───────┘    │
└───────────┼───────────────────┼────────────────────┼────────────┘
            │                   │                    │
┌───────────▼───────────────────▼────────────────────▼────────────┐
│                     EDGE FUNCTIONS (Vercel)                      │
│  /api/a/[shortCode] - Affiliate URL resolution (<100ms)         │
│  /api/ads/serve - Ad serving (<50ms)                            │
│  /api/webhooks/stripe - Stripe webhook handling                 │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                  SERVERLESS FUNCTIONS (Vercel)                   │
│  /api/marketplace/items - CRUD operations (<200ms)              │
│  /api/payments/checkout - Payment processing (<500ms)           │
│  /api/hugo/analyze - Semantic analysis (<1000ms)                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                  DATABASE (Supabase PostgreSQL)                  │
│  Extended: entries, collections, agreements                      │
│  New: marketplace_items, orivapay_*, affiliate_*, ad_*          │
│  RLS: All tables have row-level security policies               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                   EXTERNAL SERVICES                              │
│  Stripe Connect - Multi-party payments                          │
│  Hugo AI Platform - Semantic intelligence                       │
│  Redis (Upstash) - Caching for Edge Functions                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Marketplace Implementation

### Decision: EntryCard Extension vs Separate Table

**Constitutional Approach**: Marketplace items ARE EntryCards

#### Implementation Pattern

```typescript
// ✅ CORRECT: Extend EntryCard with marketplace metadata
const marketplaceItem = {
  // EntryCard base fields
  id: 'uuid',
  user_id: 'seller_uuid',
  content: 'Premium AI Template Bundle - 50+ templates for...',
  entry_type: 'marketplace_item',

  // Marketplace metadata (JSONB)
  marketplace_metadata: {
    item_type: 'product',
    earner_type: 'creator',
    price: 29.99,
    currency: 'USD',
    inventory_count: null, // Digital = infinite
    is_published: true,
    category_ids: ['category_uuid_1', 'category_uuid_2'],
    requires_shipping: false,
  },
};

// ❌ WRONG: Separate product table (violates Constitution)
const product = {
  id: 'uuid',
  seller_id: 'seller_uuid',
  title: 'Premium AI Template Bundle',
  description: '50+ templates for...',
  // ... duplicates EntryCard functionality
};
```

### Service Implementation

```typescript
// src/services/marketplace/MarketplaceItemService.ts

import { ServiceLocator } from '../ServiceLocator';
import { DatabaseService } from '../DatabaseService';
import type { Entry, MarketplaceMetadata } from '../../types';

export class MarketplaceItemService {
  private db: DatabaseService;

  constructor() {
    this.db = ServiceLocator.get(DatabaseService);
  }

  async createItem(
    userId: string,
    content: string,
    metadata: MarketplaceMetadata
  ): Promise<Entry> {
    const { data, error } = await this.db.getClient()
      .from('entries')
      .insert({
        user_id: userId,
        content,
        entry_type: 'marketplace_item',
        marketplace_metadata: metadata,
      })
      .select('*, profiles!inner(*)')
      .single();

    if (error) throw error;
    return data;
  }

  async getItems(filters?: {
    item_type?: string;
    earner_type?: string;
    category_id?: string;
    min_price?: number;
    max_price?: number;
    search?: string;
  }): Promise<Entry[]> {
    let query = this.db.getClient()
      .from('entries')
      .select('*, profiles!inner(*)')
      .eq('entry_type', 'marketplace_item')
      .eq('marketplace_metadata->is_published', true);

    // Apply filters
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

    if (filters?.category_id) {
      query = query.contains('marketplace_metadata->category_ids', [filters.category_id]);
    }

    if (filters?.search) {
      query = query.textSearch('content', filters.search);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  async updateItem(
    itemId: string,
    updates: Partial<MarketplaceMetadata>
  ): Promise<Entry> {
    // Fetch current item
    const { data: current } = await this.db.getClient()
      .from('entries')
      .select('marketplace_metadata')
      .eq('id', itemId)
      .single();

    // Merge updates
    const updated = await this.db.getClient()
      .from('entries')
      .update({
        marketplace_metadata: {
          ...current.marketplace_metadata,
          ...updates,
        },
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updated.error) throw updated.error;
    return updated.data;
  }

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await this.db.getClient()
      .from('entries')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  }
}

// Register service
ServiceLocator.register(MarketplaceItemService, new MarketplaceItemService());
```

### Component Implementation

```typescript
// src/components/molecules/MarketplaceItemCard.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { EntryCard } from './EntryCard';
import { PriceTag } from '../atoms/PriceTag';
import { EarnerBadge } from '../atoms/EarnerBadge';
import { BuyButton } from '../atoms/BuyButton';
import type { Entry } from '../../types';

interface Props {
  entry: Entry;
  onBuy: (itemId: string) => void;
  variant?: 'compact' | 'full';
  testID?: string;
}

export const MarketplaceItemCard: React.FC<Props> = ({
  entry,
  onBuy,
  variant = 'full',
  testID,
}) => {
  const metadata = entry.marketplace_metadata;

  return (
    <EntryCard
      entry={entry}
      variant={variant}
      testID={testID}
    >
      {/* Marketplace-specific atoms */}
      <View style={styles.metadataContainer}>
        <PriceTag
          price={metadata.price}
          currency={metadata.currency}
          size="medium"
        />
        <EarnerBadge
          type={metadata.earner_type}
          size="small"
        />
      </View>

      {variant === 'full' && (
        <BuyButton
          onPress={() => onBuy(entry.id)}
          disabled={metadata.inventory_count === 0}
          testID={`${testID}-buy-button`}
        />
      )}
    </EntryCard>
  );
};

const styles = StyleSheet.create({
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
});
```

### TDD Workflow

```typescript
// __tests__/services/MarketplaceItemService.test.ts

import { MarketplaceItemService } from '../../../src/services/marketplace/MarketplaceItemService';
import { ServiceLocator } from '../../../src/services/ServiceLocator';
import { mockSupabaseClient } from '../../mocks/supabase';

describe('MarketplaceItemService', () => {
  let service: MarketplaceItemService;

  beforeEach(() => {
    service = ServiceLocator.get(MarketplaceItemService);
  });

  describe('createItem', () => {
    it('should create marketplace item as EntryCard', async () => {
      const userId = 'user_123';
      const content = 'Premium AI Template Bundle';
      const metadata = {
        item_type: 'product' as const,
        earner_type: 'creator' as const,
        price: 29.99,
        currency: 'USD' as const,
        is_published: false,
        inventory_count: null,
        category_ids: [],
        requires_shipping: false,
      };

      const item = await service.createItem(userId, content, metadata);

      expect(item.entry_type).toBe('marketplace_item');
      expect(item.marketplace_metadata).toEqual(metadata);
      expect(item.content).toBe(content);
    });

    it('should enforce RLS - only authenticated users can create', async () => {
      // Test without auth token
      await expect(
        service.createItem('unauthorized', 'Test', {} as any)
      ).rejects.toThrow('RLS policy violation');
    });
  });

  describe('getItems', () => {
    it('should filter by item_type', async () => {
      const items = await service.getItems({ item_type: 'product' });

      expect(items.every(i => i.marketplace_metadata.item_type === 'product')).toBe(true);
    });

    it('should filter by price range', async () => {
      const items = await service.getItems({ min_price: 10, max_price: 50 });

      expect(items.every(i => {
        const price = i.marketplace_metadata.price;
        return price >= 10 && price <= 50;
      })).toBe(true);
    });

    it('should only return published items', async () => {
      const items = await service.getItems();

      expect(items.every(i => i.marketplace_metadata.is_published)).toBe(true);
    });
  });
});
```

---

## Payment Implementation

### Stripe Connect Architecture

**Flow**: Buyer → Oriva Platform → Stripe Connect → Seller

#### Key Decisions

1. **Standard Connect Accounts**: Best balance of features and compliance
2. **Platform Fees**: 10-20% based on earner type
3. **Escrow**: High-value transactions (>$500) use Agreement system
4. **Webhooks**: Async payment confirmation via Vercel Serverless

### Service Implementation

```typescript
// src/services/payments/CheckoutService.ts

import { ServiceLocator } from '../ServiceLocator';
import { StripeService } from './StripeService';
import { DatabaseService } from '../DatabaseService';
import { EscrowService } from './EscrowService';

export class CheckoutService {
  private stripe: StripeService;
  private db: DatabaseService;
  private escrow: EscrowService;

  constructor() {
    this.stripe = ServiceLocator.get(StripeService);
    this.db = ServiceLocator.get(DatabaseService);
    this.escrow = ServiceLocator.get(EscrowService);
  }

  async createCheckoutSession(
    buyerId: string,
    itemId: string,
    quantity: number = 1
  ) {
    // 1. Get item and seller
    const { data: item } = await this.db.getClient()
      .from('entries')
      .select('*, profiles!inner(id, email)')
      .eq('id', itemId)
      .single();

    if (!item) throw new Error('Item not found');

    const metadata = item.marketplace_metadata;
    const sellerId = item.user_id;

    // 2. Get seller's Stripe account
    const { data: sellerAccount } = await this.db.getClient()
      .from('orivapay_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('user_id', sellerId)
      .single();

    if (!sellerAccount?.charges_enabled) {
      throw new Error('Seller not onboarded');
    }

    // 3. Calculate fees
    const subtotal = Math.round(metadata.price * 100 * quantity);
    const platformFeeRate = this.getPlatformFeeRate(metadata.earner_type);
    const platformFee = Math.round(subtotal * platformFeeRate);
    const stripeFee = Math.round(subtotal * 0.029 + 30);
    const sellerNet = subtotal - platformFee - stripeFee;

    // 4. Determine if escrow needed (high-value transactions)
    const useEscrow = subtotal >= 50000; // $500+

    // 5. Create payment intent
    const paymentIntent = await this.stripe.createPaymentIntent(
      subtotal,
      metadata.currency.toLowerCase(),
      sellerAccount.stripe_account_id,
      platformFee,
      {
        on_behalf_of: useEscrow ? undefined : sellerAccount.stripe_account_id,
        metadata: {
          oriva_buyer_id: buyerId,
          oriva_seller_id: sellerId,
          oriva_item_id: itemId,
          use_escrow: useEscrow.toString(),
        },
      }
    );

    // 6. Create transaction record
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
        stripe_fee_cents: stripeFee,
        seller_net_cents: sellerNet,
        payment_method: 'card',
        stripe_payment_intent_id: paymentIntent.id,
        status: 'pending',
        uses_escrow: useEscrow,
      })
      .select()
      .single();

    // 7. Create escrow if needed
    if (useEscrow) {
      await this.escrow.createEscrow(transaction.id, {
        amount_cents: subtotal,
        release_type: 'manual',
        release_conditions: {
          type: 'deliverable',
          criteria: 'Buyer confirms receipt',
        },
      });
    }

    return {
      clientSecret: paymentIntent.client_secret,
      transactionId: transaction.id,
      useEscrow,
    };
  }

  private getPlatformFeeRate(earnerType: string): number {
    const rates = {
      creator: 0.15,     // 15%
      vendor: 0.12,      // 12%
      developer: 0.20,   // 20%
      influencer: 0.18,  // 18%
      affiliate: 0.10,   // 10% (affiliates also earn commissions)
    };
    return rates[earnerType] || 0.15;
  }

  async confirmPayment(transactionId: string) {
    // Called by webhook after Stripe confirms payment
    const { data: transaction } = await this.db.getClient()
      .from('orivapay_transactions')
      .update({ status: 'succeeded' })
      .eq('id', transactionId)
      .select()
      .single();

    // Update inventory if physical product
    const { data: item } = await this.db.getClient()
      .from('entries')
      .select('marketplace_metadata')
      .eq('id', transaction.item_id)
      .single();

    if (item.marketplace_metadata.inventory_count !== null) {
      await this.db.getClient()
        .from('entries')
        .update({
          marketplace_metadata: {
            ...item.marketplace_metadata,
            inventory_count: item.marketplace_metadata.inventory_count - 1,
          },
        })
        .eq('id', transaction.item_id);
    }

    return transaction;
  }
}
```

### Webhook Handler (Vercel Serverless)

```typescript
// pages/api/webhooks/stripe.ts

import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { ServiceLocator } from '../../../src/services/ServiceLocator';
import { CheckoutService } from '../../../src/services/payments/CheckoutService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const config = {
  api: {
    bodyParser: false, // Required for webhook signature verification
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
    console.error('Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const checkoutService = ServiceLocator.get(CheckoutService);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const transactionId = paymentIntent.metadata.oriva_transaction_id;

        await checkoutService.confirmPayment(transactionId);
        console.log('Payment confirmed:', transactionId);
        break;
      }

      case 'payment_intent.payment_failed': {
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        // Handle failed payment
        break;
      }

      case 'account.updated': {
        // Sync Stripe Connect account status
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function buffer(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
```

---

## Affiliate Implementation

### URL Resolution Strategy

**Target**: <100ms resolution globally

**Architecture**:
- Vercel Edge Functions (deployed to 18+ regions)
- Redis cache (Upstash) for hot URLs
- Base62 encoding for short codes

### Service Implementation

```typescript
// src/services/affiliate/AffiliateService.ts

import { ServiceLocator } from '../ServiceLocator';
import { DatabaseService } from '../DatabaseService';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 8);

export class AffiliateService {
  private db: DatabaseService;

  constructor() {
    this.db = ServiceLocator.get(DatabaseService);
  }

  async createCampaign(
    affiliateId: string,
    itemId: string,
    config: {
      name: string;
      commission_rate: number;
      commission_type: 'percentage' | 'fixed';
      fixed_commission_cents?: number;
    }
  ) {
    const { data, error } = await this.db.getClient()
      .from('affiliate_campaigns')
      .insert({
        affiliate_id: affiliateId,
        item_id: itemId,
        ...config,
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
    originalUrl: string,
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
    }
  ) {
    const shortCode = nanoid();

    const { data, error } = await this.db.getClient()
      .from('affiliate_urls')
      .insert({
        short_code: shortCode,
        original_url: originalUrl,
        campaign_id: campaignId,
        affiliate_id: affiliateId,
        utm_source: utm?.source,
        utm_medium: utm?.medium,
        utm_campaign: utm?.campaign,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      shortUrl: `${process.env.NEXT_PUBLIC_APP_URL}/a/${shortCode}`,
    };
  }

  async resolveURL(shortCode: string) {
    const { data, error } = await this.db.getClient()
      .from('affiliate_urls')
      .select('*, affiliate_campaigns!inner(*)')
      .eq('short_code', shortCode)
      .single();

    if (error) throw error;

    // Increment click count (async, don't block resolution)
    this.incrementClickCount(data.id).catch(console.error);

    return data;
  }

  private async incrementClickCount(urlId: string) {
    await this.db.getClient()
      .rpc('increment_click_count', { url_id: urlId });
  }

  async trackClick(
    urlId: string,
    campaignId: string,
    affiliateId: string,
    context: {
      visitor_id?: string;
      user_id?: string;
      referrer?: string;
      user_agent?: string;
      ip_address?: string;
      country?: string;
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

  async trackConversion(
    clickId: string,
    transactionId: string
  ) {
    // Get click details
    const { data: click } = await this.db.getClient()
      .from('affiliate_clicks')
      .select('*, affiliate_campaigns!inner(*)')
      .eq('id', clickId)
      .single();

    if (!click) throw new Error('Click not found');

    // Get transaction details
    const { data: transaction } = await this.db.getClient()
      .from('orivapay_transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (!transaction) throw new Error('Transaction not found');

    // Calculate commission
    const campaign = click.affiliate_campaigns;
    const commissionAmount = campaign.commission_type === 'percentage'
      ? Math.round(transaction.amount_cents * (campaign.commission_rate / 100))
      : campaign.fixed_commission_cents;

    // Create conversion record
    const { data: conversion, error } = await this.db.getClient()
      .from('affiliate_conversions')
      .insert({
        click_id: clickId,
        campaign_id: click.campaign_id,
        affiliate_id: click.affiliate_id,
        transaction_id: transactionId,
        commission_amount_cents: commissionAmount,
        commission_rate: campaign.commission_rate,
        currency: transaction.currency,
        payout_status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Mark click as converted
    await this.db.getClient()
      .from('affiliate_clicks')
      .update({
        converted: true,
        conversion_id: transactionId,
        converted_at: new Date().toISOString(),
      })
      .eq('id', clickId);

    return conversion;
  }
}
```

### Edge Function (Vercel Edge Runtime)

```typescript
// pages/api/a/[shortCode].ts

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export default async function handler(req: NextRequest) {
  const shortCode = req.nextUrl.pathname.split('/').pop();

  if (!shortCode) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  try {
    // 1. Check Redis cache (hot URLs)
    const cached = await redis.get<string>(`aff:${shortCode}`);

    if (cached) {
      // Track click asynchronously (don't block redirect)
      trackClick(shortCode, req).catch(console.error);

      return NextResponse.redirect(cached);
    }

    // 2. Fetch from database
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/affiliate_urls?short_code=eq.${shortCode}&select=*`,
      {
        headers: {
          'apikey': process.env.SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
        },
      }
    );

    const data = await response.json();

    if (!data || data.length === 0) {
      return NextResponse.redirect(new URL('/', req.url));
    }

    const url = data[0];

    // 3. Cache in Redis (24 hour TTL)
    await redis.set(`aff:${shortCode}`, url.original_url, { ex: 86400 });

    // 4. Track click
    trackClick(shortCode, req, url).catch(console.error);

    // 5. Redirect
    return NextResponse.redirect(url.original_url);
  } catch (error) {
    console.error('Affiliate URL resolution failed:', error);
    return NextResponse.redirect(new URL('/', req.url));
  }
}

async function trackClick(shortCode: string, req: NextRequest, urlData?: any) {
  // Extract context
  const context = {
    referrer: req.headers.get('referer') || undefined,
    user_agent: req.headers.get('user-agent') || undefined,
    ip_address: req.headers.get('x-forwarded-for') || req.ip,
    country: req.geo?.country,
    region: req.geo?.region,
    city: req.geo?.city,
  };

  // Send to tracking endpoint (async)
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/affiliate/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      short_code: shortCode,
      url_id: urlData?.id,
      campaign_id: urlData?.campaign_id,
      affiliate_id: urlData?.affiliate_id,
      ...context,
    }),
  });
}
```

---

## Advertising Implementation

### Ad Serving Architecture

**Target**: <50ms ad selection and rendering

**Strategy**:
1. **Pre-computed Segments**: Daily batch job creates semantic audience segments
2. **Real-time Scoring**: Edge function scores ads against user context
3. **Redis Cache**: Cache user segments and ad metadata
4. **Fraud Detection**: Post-impression validation (async)

### Service Implementation

```typescript
// src/services/advertising/AdServingService.ts

import { ServiceLocator } from '../ServiceLocator';
import { DatabaseService } from '../DatabaseService';
import { HugoAIService } from '../hugo/HugoAIService';

export class AdServingService {
  private db: DatabaseService;
  private hugo: HugoAIService;

  constructor() {
    this.db = ServiceLocator.get(DatabaseService);
    this.hugo = ServiceLocator.get(HugoAIService);
  }

  async selectAd(context: {
    user_id?: string;
    thread_id?: string;
    placement: 'feed' | 'sidebar' | 'thread' | 'marketplace';
    user_interests?: string[];
    thread_keywords?: string[];
  }) {
    // 1. Get user segments (cached)
    const segments = await this.getUserSegments(context.user_id);

    // 2. Get active campaigns for placement
    const { data: campaigns } = await this.db.getClient()
      .from('ad_campaigns')
      .select('*, ad_creatives!inner(*), ad_targeting!inner(*)')
      .eq('status', 'active')
      .gte('daily_budget_cents', 'spent_cents') // Has budget remaining
      .lte('start_date', new Date().toISOString())
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`);

    if (!campaigns || campaigns.length === 0) {
      return null;
    }

    // 3. Score ads against context
    const scoredAds = campaigns.map(campaign => {
      const score = this.scoreAd(campaign, context, segments);
      return { campaign, score };
    });

    // 4. Sort by score and select top ad
    scoredAds.sort((a, b) => b.score - a.score);

    const selectedAd = scoredAds[0];

    if (!selectedAd || selectedAd.score < 0.3) {
      return null; // No relevant ads
    }

    // 5. Track impression (async)
    this.trackImpression(selectedAd.campaign, context).catch(console.error);

    return {
      campaign: selectedAd.campaign,
      creative: selectedAd.campaign.ad_creatives[0],
      score: selectedAd.score,
    };
  }

  private scoreAd(
    campaign: any,
    context: any,
    userSegments: string[]
  ): number {
    const targeting = campaign.ad_targeting;

    let score = 0;

    // Segment match (40%)
    const segmentMatch = targeting.interest_keywords?.some(
      (keyword: string) => userSegments.includes(keyword)
    );
    if (segmentMatch) score += 0.4;

    // Keyword match (40%)
    if (context.thread_keywords && targeting.interest_keywords) {
      const keywordOverlap = context.thread_keywords.filter(
        (k: string) => targeting.interest_keywords.includes(k)
      ).length;
      score += (keywordOverlap / context.thread_keywords.length) * 0.4;
    }

    // Bid amount (20%)
    const maxBid = 10000; // $100 max bid
    score += (campaign.bid_amount_cents / maxBid) * 0.2;

    return Math.min(score, 1.0);
  }

  private async getUserSegments(userId?: string): Promise<string[]> {
    if (!userId) return [];

    const { data } = await this.db.getClient()
      .from('ad_user_segments')
      .select('ad_semantic_segments!inner(interest_keywords)')
      .eq('user_id', userId);

    if (!data) return [];

    return data.flatMap(s => s.ad_semantic_segments.interest_keywords);
  }

  private async trackImpression(campaign: any, context: any) {
    await this.db.getClient()
      .from('ad_impressions')
      .insert({
        campaign_id: campaign.id,
        creative_id: campaign.ad_creatives[0].id,
        user_id: context.user_id,
        placement: context.placement,
        thread_id: context.thread_id,
        is_viewable: true,
      });

    // Update campaign impression count
    await this.db.getClient()
      .rpc('increment_impression_count', { campaign_id: campaign.id });
  }

  async trackClick(impressionId: string) {
    const { data: impression } = await this.db.getClient()
      .from('ad_impressions')
      .select('*')
      .eq('id', impressionId)
      .single();

    if (!impression) throw new Error('Impression not found');

    await this.db.getClient()
      .from('ad_clicks')
      .insert({
        impression_id: impressionId,
        campaign_id: impression.campaign_id,
        creative_id: impression.creative_id,
        user_id: impression.user_id,
        placement: impression.placement,
      });

    // Update campaign click count
    await this.db.getClient()
      .rpc('increment_click_count', { campaign_id: impression.campaign_id });
  }
}
```

---

## Semantic Commerce Integration

### Hugo AI Services Used

**⚠️ IMPORTANT**: Hugo AI API is **in development** and will be available soon but is **not yet ready**.

**Integration Approach**:
- OrivaFlow implements **wrapper services only** (NO AI development)
- Wrapper services call Hugo AI API endpoints
- Use **mock responses** during Phases 1-6 development
- Hugo AI API expected by Phase 7 (week 11 of implementation)

**Services Available** (from Hugo AI team):
1. **Thread Analysis**: Extract needs/intent from conversations
2. **Content Classification**: Categorize marketplace items
3. **Consensus Summarization**: Product review summaries
4. **Bias Detection**: Fair product recommendations

### Expected Hugo AI API Contract

**Base URL**: `https://api.oriva.com/hugo` (TBD - to be provided by Hugo AI team)

**Authentication**: Bearer token (Oriva Platform API token)

**Endpoints**:

```typescript
// POST /api/hugo/analyze-thread
interface AnalyzeThreadRequest {
  thread_id: string;
  include_needs?: boolean;
  include_expertise_gaps?: boolean;
  include_collaboration_opportunities?: boolean;
}

interface AnalyzeThreadResponse {
  topics: Array<{ name: string; confidence: number }>;
  needs: Array<{ description: string; confidence: number }>;
  expertise_gaps: Array<{ domain: string; confidence: number }>;
  collaboration_opportunities: Array<{ type: string; participants: string[] }>;
  sentiment: 'seeking' | 'frustrated' | 'satisfied';
}

// POST /api/hugo/classify-content
interface ClassifyContentRequest {
  content: string;
  context?: 'marketplace' | 'thread' | 'profile';
}

interface ClassifyContentResponse {
  categories: Array<{ name: string; confidence: number }>;
  tags: string[];
  primary_category: string;
}

// POST /api/hugo/summarize-consensus
interface SummarizeConsensusRequest {
  entries: Array<{ id: string; content: string; author_id: string }>;
}

interface SummarizeConsensusResponse {
  summary: string;
  agreements: string[];
  disagreements: string[];
  confidence: number;
}

// POST /api/hugo/detect-bias
interface DetectBiasRequest {
  content: string;
  context?: string;
}

interface DetectBiasResponse {
  biases: Array<{ type: string; severity: number; description: string }>;
  overall_score: number; // 0-1, where 0 = no bias
}
```

**Mock Implementation for Development**:

```typescript
// src/services/hugo/__mocks__/HugoAIService.ts
export class MockHugoAIService {
  async analyzeThread(thread: any): Promise<AnalyzeThreadResponse> {
    return {
      topics: [{ name: 'project management', confidence: 0.85 }],
      needs: [{ description: 'seeking productivity tools', confidence: 0.9 }],
      expertise_gaps: [{ domain: 'PM consulting', confidence: 0.75 }],
      collaboration_opportunities: [],
      sentiment: 'seeking'
    };
  }

  async classifyContent(content: string): Promise<ClassifyContentResponse> {
    return {
      categories: [{ name: 'Business', confidence: 0.8 }],
      tags: ['productivity', 'management'],
      primary_category: 'Business'
    };
  }

  // ... other mock methods
}
```

### Service Implementation

```typescript
// src/services/semantic/SemanticCommerceService.ts

import { ServiceLocator } from '../ServiceLocator';
import { HugoAIService } from '../hugo/HugoAIService';
import { MarketplaceItemService } from '../marketplace/MarketplaceItemService';

export class SemanticCommerceService {
  private hugo: HugoAIService;
  private marketplace: MarketplaceItemService;

  constructor() {
    this.hugo = ServiceLocator.get(HugoAIService);
    this.marketplace = ServiceLocator.get(MarketplaceItemService);
  }

  async analyzeThreadForCommerce(threadId: string) {
    // 1. Get thread content
    const thread = await this.getThreadContent(threadId);

    // 2. Analyze with Hugo AI
    const analysis = await this.hugo.analyzeThread(thread);

    // 3. Extract commercial intent
    const commercialIntent = this.extractCommercialIntent(analysis);

    if (!commercialIntent) {
      return null;
    }

    // 4. Find relevant marketplace items
    const recommendations = await this.findRelevantItems(commercialIntent);

    return {
      intent: commercialIntent,
      recommendations,
      confidence: analysis.confidence,
    };
  }

  private extractCommercialIntent(analysis: any) {
    // Look for needs, problems, questions that could be solved by products/services
    const needs = analysis.needs || [];
    const problems = analysis.problems || [];
    const questions = analysis.questions || [];

    if (needs.length === 0 && problems.length === 0 && questions.length === 0) {
      return null;
    }

    return {
      type: 'product_need',
      keywords: [...needs, ...problems, ...questions],
      context: analysis.summary,
    };
  }

  private async findRelevantItems(intent: any) {
    // Use semantic search to find matching marketplace items
    const items = await this.marketplace.searchBySemanticSimilarity(
      intent.keywords,
      { limit: 5, threshold: 0.7 }
    );

    return items.map(item => ({
      item,
      relevance: this.calculateRelevance(item, intent),
    }));
  }

  async summarizeProductReviews(itemId: string) {
    // Get all reviews
    const { data: reviews } = await this.db.getClient()
      .from('marketplace_reviews')
      .select('*')
      .eq('item_id', itemId)
      .eq('moderation_status', 'approved');

    if (!reviews || reviews.length === 0) {
      return null;
    }

    // Use Hugo AI consensus summarization
    const summary = await this.hugo.summarizeConsensus(
      reviews.map(r => r.content)
    );

    return {
      summary: summary.summary,
      positive_themes: summary.agreements,
      negative_themes: summary.disagreements,
      average_rating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
      total_reviews: reviews.length,
    };
  }
}
```

---

## Performance Optimization

### Query Optimization

```sql
-- Create indexes for fast marketplace queries
CREATE INDEX CONCURRENTLY idx_entries_marketplace_published
  ON entries (created_at DESC)
  WHERE entry_type = 'marketplace_item'
  AND marketplace_metadata->>'is_published' = 'true';

CREATE INDEX CONCURRENTLY idx_entries_marketplace_price
  ON entries (((marketplace_metadata->>'price')::numeric))
  WHERE entry_type = 'marketplace_item';

-- Create GIN index for JSONB queries
CREATE INDEX CONCURRENTLY idx_entries_marketplace_metadata
  ON entries USING GIN (marketplace_metadata jsonb_path_ops);

-- Create index for affiliate URL resolution
CREATE INDEX CONCURRENTLY idx_affiliate_urls_short_code_active
  ON affiliate_urls (short_code)
  WHERE expires_at IS NULL OR expires_at > NOW();

-- Create composite index for ad serving
CREATE INDEX CONCURRENTLY idx_ad_campaigns_active_budget
  ON ad_campaigns (status, daily_budget_cents, spent_cents)
  WHERE status = 'active';
```

### Caching Strategy

```typescript
// src/services/cache/RedisCacheService.ts

import { Redis } from '@upstash/redis';

export class RedisCacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
  }

  async getMarketplaceItem(itemId: string) {
    const cached = await this.redis.get(`item:${itemId}`);
    if (cached) return JSON.parse(cached as string);
    return null;
  }

  async setMarketplaceItem(itemId: string, data: any, ttl: number = 3600) {
    await this.redis.set(`item:${itemId}`, JSON.stringify(data), { ex: ttl });
  }

  async invalidateMarketplaceItem(itemId: string) {
    await this.redis.del(`item:${itemId}`);
  }

  async getUserSegments(userId: string) {
    const cached = await this.redis.get(`segments:${userId}`);
    if (cached) return JSON.parse(cached as string);
    return null;
  }

  async setUserSegments(userId: string, segments: string[], ttl: number = 86400) {
    await this.redis.set(`segments:${userId}`, JSON.stringify(segments), { ex: ttl });
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// Focus on business logic, not implementation details
describe('MarketplaceItemService', () => {
  it('should extend EntryCard with marketplace metadata', () => {
    // Test constitutional compliance
  });

  it('should enforce RLS policies', () => {
    // Test security
  });

  it('should handle inventory updates atomically', () => {
    // Test concurrency
  });
});
```

### Integration Tests

```typescript
// Test service interactions
describe('Checkout Flow Integration', () => {
  it('should create payment intent and transaction record', async () => {
    // Test CheckoutService + StripeService + DatabaseService
  });

  it('should handle webhook events correctly', async () => {
    // Test webhook handler + transaction updates
  });
});
```

### E2E Tests

```typescript
// Test full user workflows
describe('Purchase Flow E2E', () => {
  it('should complete purchase from item view to confirmation', async () => {
    // Navigate to marketplace
    // Select item
    // Add to cart
    // Checkout
    // Complete payment
    // Verify transaction
  });
});
```

---

## Common Pitfalls

### ❌ Creating Separate Product Table

```typescript
// WRONG - Violates Constitution
CREATE TABLE products (
  id UUID PRIMARY KEY,
  seller_id UUID,
  title VARCHAR(200),
  // ... duplicates EntryCard
);
```

**Fix**: Use `entries` table with `marketplace_metadata`

### ❌ Synchronous Webhook Processing

```typescript
// WRONG - Blocks webhook response
export default async function handler(req, res) {
  const event = stripe.webhooks.constructEvent(...);

  await processPayment(event); // ❌ Can timeout

  res.json({ received: true });
}
```

**Fix**: Queue async job, respond immediately

### ❌ Missing RLS Policies

```typescript
// WRONG - No security
CREATE TABLE marketplace_items (...);
// ❌ Anyone can read/write
```

**Fix**: Enable RLS and create policies

### ❌ N+1 Query Problem

```typescript
// WRONG - Fetches seller for each item
items.map(async item => {
  const seller = await getUser(item.user_id); // ❌ N queries
});
```

**Fix**: Use `select('*, profiles!inner(*)')`

---

## Deployment Checklist

- [ ] Database migrations applied
- [ ] RLS policies enabled on all tables
- [ ] Stripe webhook configured
- [ ] Environment variables set
- [ ] Redis cache configured
- [ ] Edge Functions deployed
- [ ] Performance monitoring enabled
- [ ] Error tracking configured (Sentry)

---

## Next Steps

After completing Phase 1 implementation:

1. **Phase 2**: Marketplace Core Services (3 weeks)
2. **Phase 3**: OrivaPay Integration (3 weeks)
3. **Phase 4**: Affiliate Network (2 weeks)
4. **Phase 5**: Advertising Network (3 weeks)
5. **Phase 6**: Multi-Currency (1 week)
6. **Phase 7**: Admin Tools (2 weeks)
7. **Phase 8**: Semantic Integration (2 weeks)
8. **Phase 9**: Mobile Optimization (1 week)

---

**Ready to implement! Follow the patterns, adhere to the Constitution, and ship quality code. 🚀**