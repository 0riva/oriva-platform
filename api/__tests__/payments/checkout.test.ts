/**
 * API Tests: Checkout Endpoints (T077)
 *
 * Tests for checkout creation and completion endpoints
 * Following TDD pattern - tests written before implementation
 *
 * Endpoints tested:
 * - POST /api/payments/checkout/create - Initiate checkout session
 * - POST /api/payments/checkout/complete - Finalize payment
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

describe('Checkout API Endpoints', () => {
  let supabase: SupabaseClient;
  let authToken: string;
  let testUserId: string;
  let testItemId: string;
  let testSellerUserId: string;
  let highValueItemId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Create test users
    const { data: authData } = await supabase.auth.signUp({
      email: 'buyer@checkout-test.com',
      password: 'test-password-123',
    });
    testUserId = authData.user!.id;
    authToken = authData.session!.access_token;

    const { data: sellerAuth } = await supabase.auth.signUp({
      email: 'seller@checkout-test.com',
      password: 'test-password-456',
    });
    testSellerUserId = sellerAuth.user!.id;

    // Create profiles
    await supabase.from('profiles').insert([
      {
        id: testUserId,
        username: 'checkoutbuyer',
        display_name: 'Checkout Buyer',
      },
      {
        id: testSellerUserId,
        username: 'checkoutseller',
        display_name: 'Checkout Seller',
        stripe_account_id: 'acct_test_seller123',
      },
    ]);

    // Create test marketplace items
    const { data: regularItem } = await supabase.from('entries').insert({
      user_id: testSellerUserId,
      content: 'Test product for checkout',
      parent_type: 'marketplace',
      marketplace_metadata: {
        title: 'Regular Test Product',
        price: 25.00,
        currency: 'USD',
        category: 'creator_pack',
        subcategory: 'templates',
        earner_type: 'creator',
        inventory_count: 10,
        fulfillment_type: 'instant',
      },
    }).select().single();
    testItemId = regularItem!.id;

    const { data: highValueItem } = await supabase.from('entries').insert({
      user_id: testSellerUserId,
      content: 'High value product for escrow testing',
      parent_type: 'marketplace',
      marketplace_metadata: {
        title: 'Premium Package',
        price: 750.00,
        currency: 'USD',
        category: 'creator_pack',
        subcategory: 'consulting',
        earner_type: 'creator',
        inventory_count: 5,
        fulfillment_type: 'manual',
      },
    }).select().single();
    highValueItemId = highValueItem!.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('entries').delete().eq('user_id', testSellerUserId);
    await supabase.from('profiles').delete().in('id', [testUserId, testSellerUserId]);
    await supabase.auth.admin.deleteUser(testUserId);
    await supabase.auth.admin.deleteUser(testSellerUserId);
  });

  describe('POST /api/payments/checkout/create', () => {
    it('should create checkout session for regular item', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: testItemId,
          quantity: 2,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toMatchObject({
        clientSecret: expect.stringMatching(/^pi_.*_secret_.*/),
        paymentIntentId: expect.stringMatching(/^pi_.*/),
        transactionId: expect.any(String),
        amount: 5000, // $25.00 * 2 = $50.00 = 5000 cents
        platformFee: 750, // 15% of 5000 cents (creator rate)
        useEscrow: false, // Below $500 threshold
      });
    });

    it('should use escrow for high-value transactions (>= $500)', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: highValueItemId,
          quantity: 1,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toMatchObject({
        clientSecret: expect.any(String),
        paymentIntentId: expect.any(String),
        transactionId: expect.any(String),
        amount: 75000, // $750.00 = 75000 cents
        platformFee: 11250, // 15% of 75000 cents
        useEscrow: true, // Above $500 threshold
      });
    });

    it('should handle quantity parameter correctly', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: testItemId,
          quantity: 3,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.amount).toBe(7500); // $25.00 * 3 = $75.00 = 7500 cents
      expect(data.platformFee).toBe(1125); // 15% of 7500 cents
    });

    it('should default to quantity 1 when not provided', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: testItemId,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.amount).toBe(2500); // $25.00 * 1 = $25.00 = 2500 cents
    });

    it('should return 400 for invalid item ID', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: '00000000-0000-0000-0000-000000000000',
          quantity: 1,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/item not found/i);
    });

    it('should return 400 for insufficient inventory', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: testItemId,
          quantity: 999, // Exceeds inventory
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/insufficient inventory/i);
    });

    it('should return 400 for invalid quantity', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: testItemId,
          quantity: 0,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/quantity must be at least 1/i);
    });

    it('should return 400 for negative quantity', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: testItemId,
          quantity: -5,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/quantity must be at least 1/i);
    });

    it('should return 400 for missing itemId', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          quantity: 1,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/itemId is required/i);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: testItemId,
          quantity: 1,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/unauthorized|authentication required/i);
    });

    it('should return 400 when seller has no Stripe account', async () => {
      // Create seller without Stripe account
      const { data: noStripeSellerAuth } = await supabase.auth.signUp({
        email: 'nostripe@checkout-test.com',
        password: 'test-password-789',
      });
      const noStripeSellerId = noStripeSellerAuth.user!.id;

      await supabase.from('profiles').insert({
        id: noStripeSellerId,
        username: 'nostripeseller',
        display_name: 'No Stripe Seller',
        // No stripe_account_id
      });

      const { data: noStripeItem } = await supabase.from('entries').insert({
        user_id: noStripeSellerId,
        content: 'Item from seller without Stripe',
        parent_type: 'marketplace',
        marketplace_metadata: {
          title: 'No Stripe Product',
          price: 10.00,
          currency: 'USD',
          category: 'creator_pack',
          subcategory: 'templates',
          earner_type: 'creator',
          inventory_count: 5,
          fulfillment_type: 'instant',
        },
      }).select().single();

      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: noStripeItem!.id,
          quantity: 1,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/seller.*stripe account/i);

      // Cleanup
      await supabase.from('entries').delete().eq('id', noStripeItem!.id);
      await supabase.from('profiles').delete().eq('id', noStripeSellerId);
      await supabase.auth.admin.deleteUser(noStripeSellerId);
    });
  });

  describe('POST /api/payments/checkout/complete', () => {
    let testTransactionId: string;

    beforeEach(async () => {
      // Create a checkout session first
      const createResponse = await fetch(`${API_BASE_URL}/api/payments/checkout/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          itemId: testItemId,
          quantity: 1,
        }),
      });
      const createData = await createResponse.json();
      testTransactionId = createData.transactionId;
    });

    it('should complete payment successfully', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          transactionId: testTransactionId,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toMatchObject({
        success: true,
        transactionId: testTransactionId,
        status: 'succeeded',
      });
    });

    it('should update transaction status in database', async () => {
      await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          transactionId: testTransactionId,
        }),
      });

      const { data: transaction } = await supabase
        .from('orivapay_transactions')
        .select('status')
        .eq('id', testTransactionId)
        .single();

      expect(transaction?.status).toBe('succeeded');
    });

    it('should update inventory for physical products', async () => {
      const { data: itemBefore } = await supabase
        .from('entries')
        .select('marketplace_metadata')
        .eq('id', testItemId)
        .single();

      const inventoryBefore = itemBefore!.marketplace_metadata.inventory_count;

      await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          transactionId: testTransactionId,
        }),
      });

      const { data: itemAfter } = await supabase
        .from('entries')
        .select('marketplace_metadata')
        .eq('id', testItemId)
        .single();

      const inventoryAfter = itemAfter!.marketplace_metadata.inventory_count;

      expect(inventoryAfter).toBe(inventoryBefore - 1);
    });

    it('should return 400 for invalid transaction ID', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          transactionId: '00000000-0000-0000-0000-000000000000',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/transaction not found/i);
    });

    it('should return 400 for already completed transaction', async () => {
      // Complete once
      await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          transactionId: testTransactionId,
        }),
      });

      // Try to complete again
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          transactionId: testTransactionId,
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/already.*completed|processed/i);
    });

    it('should return 400 for missing transactionId', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/transactionId is required/i);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: testTransactionId,
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toMatch(/unauthorized|authentication required/i);
    });

    it('should return 403 when user does not own transaction', async () => {
      // Create another user
      const { data: otherUserAuth } = await supabase.auth.signUp({
        email: 'other@checkout-test.com',
        password: 'test-password-999',
      });
      const otherUserToken = otherUserAuth.session!.access_token;

      const response = await fetch(`${API_BASE_URL}/api/payments/checkout/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${otherUserToken}`,
        },
        body: JSON.stringify({
          transactionId: testTransactionId,
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toMatch(/forbidden|not authorized/i);

      // Cleanup
      await supabase.auth.admin.deleteUser(otherUserAuth.user!.id);
    });
  });
});
