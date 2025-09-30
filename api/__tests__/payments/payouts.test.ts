/**
 * API Tests: Payout Endpoints (T082)
 *
 * Tests for seller payout creation endpoints
 *
 * Endpoints tested:
 * - POST /api/payments/payouts/create - Request payout of available balance
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Payout API Endpoints', () => {
  let supabase: SupabaseClient;
  let testSellerUserId: string;
  let sellerAuthToken: string;
  let testBuyerUserId: string;
  let testItemId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Create test seller with Stripe account
    const { data: sellerAuth } = await supabase.auth.signUp({
      email: 'seller@payout-test.com',
      password: 'test-password-123',
    });
    testSellerUserId = sellerAuth.user!.id;
    sellerAuthToken = sellerAuth.session!.access_token;

    // Create test buyer
    const { data: buyerAuth } = await supabase.auth.signUp({
      email: 'buyer@payout-test.com',
      password: 'test-password-456',
    });
    testBuyerUserId = buyerAuth.user!.id;

    // Create profiles
    await supabase.from('profiles').insert([
      {
        id: testSellerUserId,
        username: 'payoutseller',
        display_name: 'Payout Seller',
        stripe_account_id: 'acct_test_payout_seller',
      },
      {
        id: testBuyerUserId,
        username: 'payoutbuyer',
        display_name: 'Payout Buyer',
      },
    ]);

    // Create test marketplace item
    const { data: item } = await supabase.from('entries').insert({
      user_id: testSellerUserId,
      content: 'Test product for payout testing',
      parent_type: 'marketplace',
      marketplace_metadata: {
        title: 'Payout Test Product',
        price: 100.00,
        currency: 'USD',
        category: 'creator_pack',
        subcategory: 'templates',
        earner_type: 'creator',
        inventory_count: 10,
        fulfillment_type: 'instant',
      },
    }).select().single();
    testItemId = item!.id;

    // Create successful transactions to build up balance
    const transactions = [
      {
        buyer_id: testBuyerUserId,
        seller_id: testSellerUserId,
        item_id: testItemId,
        amount_cents: 10000, // $100
        platform_fee_cents: 1500, // 15%
        stripe_fee_cents: 320, // 2.9% + $0.30
        seller_net_cents: 8180, // $81.80
        currency: 'usd',
        quantity: 1,
        status: 'succeeded',
        stripe_payment_intent_id: 'pi_test_payout1',
      },
      {
        buyer_id: testBuyerUserId,
        seller_id: testSellerUserId,
        item_id: testItemId,
        amount_cents: 10000, // $100
        platform_fee_cents: 1500, // 15%
        stripe_fee_cents: 320, // 2.9% + $0.30
        seller_net_cents: 8180, // $81.80
        currency: 'usd',
        quantity: 1,
        status: 'succeeded',
        stripe_payment_intent_id: 'pi_test_payout2',
      },
    ];

    await supabase.from('orivapay_transactions').insert(transactions);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('orivapay_transactions').delete().eq('seller_id', testSellerUserId);
    await supabase.from('entries').delete().eq('id', testItemId);
    await supabase.from('profiles').delete().in('id', [testSellerUserId, testBuyerUserId]);
    await supabase.auth.admin.deleteUser(testSellerUserId);
    await supabase.auth.admin.deleteUser(testBuyerUserId);
  });

  describe('POST /api/payments/payouts/create', () => {
    it('should create payout for available balance', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerAuthToken}`,
        },
        body: JSON.stringify({
          amountCents: 10000, // Request $100 payout
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toMatchObject({
        success: true,
        payoutId: expect.any(String),
        amountCents: 10000,
        status: 'pending',
      });
    });

    it('should create payout for full available balance when amount not specified', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerAuthToken}`,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toMatchObject({
        success: true,
        payoutId: expect.any(String),
        amountCents: expect.any(Number),
        status: 'pending',
      });

      // Should be positive amount (remaining balance after previous test)
      expect(data.amountCents).toBeGreaterThan(0);
    });

    it('should return 400 for invalid amount (negative)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerAuthToken}`,
        },
        body: JSON.stringify({
          amountCents: -1000,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/amount.*must be.*positive/i);
    });

    it('should return 400 for invalid amount (zero)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerAuthToken}`,
        },
        body: JSON.stringify({
          amountCents: 0,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/amount.*must be.*positive/i);
    });

    it('should return 400 for non-integer amount', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerAuthToken}`,
        },
        body: JSON.stringify({
          amountCents: 100.5,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/amount.*must be.*integer/i);
    });

    it('should return 400 for insufficient balance', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerAuthToken}`,
        },
        body: JSON.stringify({
          amountCents: 999999999, // Exceeds available balance
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/insufficient.*balance/i);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amountCents: 10000,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/unauthorized|authentication required/i);
    });

    it('should return 400 when user has no Stripe account', async () => {
      // Create user without Stripe account
      const { data: noStripeAuth } = await supabase.auth.signUp({
        email: 'nostripe@payout-test.com',
        password: 'test-password-789',
      });
      const noStripeUserId = noStripeAuth.user!.id;
      const noStripeToken = noStripeAuth.session!.access_token;

      await supabase.from('profiles').insert({
        id: noStripeUserId,
        username: 'nostripeseller',
        display_name: 'No Stripe Seller',
        // No stripe_account_id
      });

      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${noStripeToken}`,
        },
        body: JSON.stringify({
          amountCents: 10000,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/stripe account.*not.*configured/i);

      // Cleanup
      await supabase.from('profiles').delete().eq('id', noStripeUserId);
      await supabase.auth.admin.deleteUser(noStripeUserId);
    });

    it('should return 400 when user has zero balance', async () => {
      // Create new seller with no transactions
      const { data: noBalanceAuth } = await supabase.auth.signUp({
        email: 'nobalance@payout-test.com',
        password: 'test-password-999',
      });
      const noBalanceUserId = noBalanceAuth.user!.id;
      const noBalanceToken = noBalanceAuth.session!.access_token;

      await supabase.from('profiles').insert({
        id: noBalanceUserId,
        username: 'nobalanceseller',
        display_name: 'No Balance Seller',
        stripe_account_id: 'acct_test_nobalance',
      });

      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${noBalanceToken}`,
        },
        body: JSON.stringify({
          amountCents: 1000,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/insufficient.*balance|no.*available.*balance/i);

      // Cleanup
      await supabase.from('profiles').delete().eq('id', noBalanceUserId);
      await supabase.auth.admin.deleteUser(noBalanceUserId);
    });

    it('should record payout in database', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sellerAuthToken}`,
        },
        body: JSON.stringify({
          amountCents: 5000,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify payout exists in database
      const { data: payout, error } = await supabase
        .from('orivapay_payouts')
        .select('*')
        .eq('id', data.payoutId)
        .single();

      expect(error).toBeNull();
      expect(payout).toMatchObject({
        id: data.payoutId,
        seller_id: testSellerUserId,
        amount_cents: 5000,
        status: 'pending',
      });
    });

    it('should return 405 for non-POST methods', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sellerAuthToken}`,
        },
      });

      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.error).toMatch(/method not allowed/i);
    });

    it('should handle concurrent payout requests correctly', async () => {
      // Create multiple payout requests simultaneously
      const promises = [
        fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sellerAuthToken}`,
          },
          body: JSON.stringify({ amountCents: 1000 }),
        }),
        fetch(`${API_BASE_URL}/api/payments/payouts/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sellerAuthToken}`,
          },
          body: JSON.stringify({ amountCents: 1000 }),
        }),
      ];

      const responses = await Promise.all(promises);

      // Both requests should complete
      // Either both succeed (if balance sufficient) or one succeeds and one fails (insufficient balance)
      const statuses = responses.map(r => r.status);
      expect(statuses.every(s => s === 200 || s === 400)).toBe(true);
    });
  });
});