/**
 * API Tests: Stripe Webhook Handler (T080)
 *
 * Tests for Stripe webhook event processing with signature verification
 *
 * Endpoints tested:
 * - POST /api/payments/webhooks/stripe - Handle Stripe webhook events
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Test configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

/**
 * Generate Stripe webhook signature
 * This mimics Stripe's signature generation for testing
 */
function generateStripeSignature(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

describe('Stripe Webhook Handler', () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let testSellerUserId: string;
  let testItemId: string;
  let testTransactionId: string;
  let testPaymentIntentId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Create test users
    const { data: buyerAuth } = await supabase.auth.signUp({
      email: 'buyer@webhook-test.com',
      password: 'test-password-123',
    });
    testUserId = buyerAuth.user!.id;

    const { data: sellerAuth } = await supabase.auth.signUp({
      email: 'seller@webhook-test.com',
      password: 'test-password-456',
    });
    testSellerUserId = sellerAuth.user!.id;

    // Create profiles
    await supabase.from('profiles').insert([
      {
        id: testUserId,
        username: 'webhookbuyer',
        display_name: 'Webhook Buyer',
      },
      {
        id: testSellerUserId,
        username: 'webhookseller',
        display_name: 'Webhook Seller',
        stripe_account_id: 'acct_test_seller456',
      },
    ]);

    // Create test marketplace item
    const { data: item } = await supabase.from('entries').insert({
      user_id: testSellerUserId,
      content: 'Test product for webhook testing',
      parent_type: 'marketplace',
      marketplace_metadata: {
        title: 'Webhook Test Product',
        price: 50.00,
        currency: 'USD',
        category: 'creator_pack',
        subcategory: 'templates',
        earner_type: 'creator',
        inventory_count: 10,
        fulfillment_type: 'instant',
      },
    }).select().single();
    testItemId = item!.id;

    // Create test transaction
    testPaymentIntentId = 'pi_test_webhook123';
    const { data: transaction } = await supabase.from('orivapay_transactions').insert({
      buyer_id: testUserId,
      seller_id: testSellerUserId,
      item_id: testItemId,
      amount_cents: 5000,
      platform_fee_cents: 750,
      stripe_fee_cents: 175,
      seller_net_cents: 4075,
      currency: 'usd',
      quantity: 1,
      status: 'pending',
      stripe_payment_intent_id: testPaymentIntentId,
    }).select().single();
    testTransactionId = transaction!.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('orivapay_transactions').delete().eq('id', testTransactionId);
    await supabase.from('entries').delete().eq('id', testItemId);
    await supabase.from('profiles').delete().in('id', [testUserId, testSellerUserId]);
    await supabase.auth.admin.deleteUser(testUserId);
    await supabase.auth.admin.deleteUser(testSellerUserId);
  });

  describe('POST /api/payments/webhooks/stripe', () => {
    it('should process payment_intent.succeeded event', async () => {
      const event = {
        id: 'evt_test_success',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: testPaymentIntentId,
            amount: 5000,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      };

      const payload = JSON.stringify(event);
      const signature = generateStripeSignature(payload, STRIPE_WEBHOOK_SECRET);

      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: payload,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        received: true,
        eventType: 'payment_intent.succeeded',
      });

      // Verify transaction status updated
      const { data: transaction } = await supabase
        .from('orivapay_transactions')
        .select('status')
        .eq('id', testTransactionId)
        .single();

      expect(transaction?.status).toBe('succeeded');
    });

    it('should process payment_intent.payment_failed event', async () => {
      // Create a failed transaction
      const failedPaymentIntentId = 'pi_test_failed123';
      const { data: failedTransaction } = await supabase.from('orivapay_transactions').insert({
        buyer_id: testUserId,
        seller_id: testSellerUserId,
        item_id: testItemId,
        amount_cents: 3000,
        platform_fee_cents: 450,
        stripe_fee_cents: 117,
        seller_net_cents: 2433,
        currency: 'usd',
        quantity: 1,
        status: 'pending',
        stripe_payment_intent_id: failedPaymentIntentId,
      }).select().single();

      const event = {
        id: 'evt_test_failed',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: failedPaymentIntentId,
            amount: 3000,
            currency: 'usd',
            status: 'failed',
            last_payment_error: {
              message: 'Your card was declined',
            },
          },
        },
      };

      const payload = JSON.stringify(event);
      const signature = generateStripeSignature(payload, STRIPE_WEBHOOK_SECRET);

      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: payload,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        received: true,
        eventType: 'payment_intent.payment_failed',
      });

      // Verify transaction status updated
      const { data: transaction } = await supabase
        .from('orivapay_transactions')
        .select('status')
        .eq('id', failedTransaction!.id)
        .single();

      expect(transaction?.status).toBe('failed');

      // Cleanup
      await supabase.from('orivapay_transactions').delete().eq('id', failedTransaction!.id);
    });

    it('should reject request with invalid signature', async () => {
      const event = {
        id: 'evt_test_invalid_sig',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: testPaymentIntentId,
            amount: 5000,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      };

      const payload = JSON.stringify(event);
      const invalidSignature = 't=123456789,v1=invalid_signature_hash';

      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': invalidSignature,
        },
        body: payload,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/signature.*invalid|verification failed/i);
    });

    it('should reject request with missing signature', async () => {
      const event = {
        id: 'evt_test_no_sig',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: testPaymentIntentId,
            amount: 5000,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      };

      const payload = JSON.stringify(event);

      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // No Stripe-Signature header
        },
        body: payload,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/signature.*missing|required/i);
    });

    it('should handle unknown event types gracefully', async () => {
      const event = {
        id: 'evt_test_unknown',
        type: 'customer.created',
        data: {
          object: {
            id: 'cus_test123',
          },
        },
      };

      const payload = JSON.stringify(event);
      const signature = generateStripeSignature(payload, STRIPE_WEBHOOK_SECRET);

      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: payload,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        received: true,
        eventType: 'customer.created',
      });
    });

    it('should handle malformed JSON payload', async () => {
      const malformedPayload = '{ invalid json }';
      const signature = generateStripeSignature(malformedPayload, STRIPE_WEBHOOK_SECRET);

      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: malformedPayload,
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/invalid.*json|parse error/i);
    });

    it('should return 405 for non-POST methods', async () => {
      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'GET',
      });

      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.error).toMatch(/method not allowed/i);
    });

    it('should handle payment_intent for non-existent transaction gracefully', async () => {
      const nonExistentPaymentIntentId = 'pi_nonexistent_999';

      const event = {
        id: 'evt_test_nonexistent',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: nonExistentPaymentIntentId,
            amount: 1000,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      };

      const payload = JSON.stringify(event);
      const signature = generateStripeSignature(payload, STRIPE_WEBHOOK_SECRET);

      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: payload,
      });

      // Should still return 200 to acknowledge receipt
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        received: true,
        eventType: 'payment_intent.succeeded',
      });
    });

    it('should process charge.refunded event', async () => {
      // Create a refunded transaction
      const refundedPaymentIntentId = 'pi_test_refunded123';
      const { data: refundedTransaction } = await supabase.from('orivapay_transactions').insert({
        buyer_id: testUserId,
        seller_id: testSellerUserId,
        item_id: testItemId,
        amount_cents: 2000,
        platform_fee_cents: 300,
        stripe_fee_cents: 88,
        seller_net_cents: 1612,
        currency: 'usd',
        quantity: 1,
        status: 'succeeded',
        stripe_payment_intent_id: refundedPaymentIntentId,
      }).select().single();

      const event = {
        id: 'evt_test_refunded',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_test_refund123',
            payment_intent: refundedPaymentIntentId,
            amount_refunded: 2000,
            refunded: true,
          },
        },
      };

      const payload = JSON.stringify(event);
      const signature = generateStripeSignature(payload, STRIPE_WEBHOOK_SECRET);

      const response = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: payload,
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchObject({
        received: true,
        eventType: 'charge.refunded',
      });

      // Verify transaction status updated
      const { data: transaction } = await supabase
        .from('orivapay_transactions')
        .select('status')
        .eq('id', refundedTransaction!.id)
        .single();

      expect(transaction?.status).toBe('refunded');

      // Cleanup
      await supabase.from('orivapay_transactions').delete().eq('id', refundedTransaction!.id);
    });

    it('should handle rapid successive webhook calls (idempotency)', async () => {
      // Create a fresh transaction for idempotency test
      const idempotencyPaymentIntentId = 'pi_test_idempotency123';
      const { data: idempotencyTransaction } = await supabase.from('orivapay_transactions').insert({
        buyer_id: testUserId,
        seller_id: testSellerUserId,
        item_id: testItemId,
        amount_cents: 1500,
        platform_fee_cents: 225,
        stripe_fee_cents: 73,
        seller_net_cents: 1202,
        currency: 'usd',
        quantity: 1,
        status: 'pending',
        stripe_payment_intent_id: idempotencyPaymentIntentId,
      }).select().single();

      const event = {
        id: 'evt_test_idempotency',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: idempotencyPaymentIntentId,
            amount: 1500,
            currency: 'usd',
            status: 'succeeded',
          },
        },
      };

      const payload = JSON.stringify(event);
      const signature = generateStripeSignature(payload, STRIPE_WEBHOOK_SECRET);

      // Send same webhook twice
      const response1 = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: payload,
      });

      const response2 = await fetch(`${API_BASE_URL}/api/payments/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Stripe-Signature': signature,
        },
        body: payload,
      });

      // Both should succeed
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // Verify transaction updated correctly
      const { data: transaction } = await supabase
        .from('orivapay_transactions')
        .select('status')
        .eq('id', idempotencyTransaction!.id)
        .single();

      expect(transaction?.status).toBe('succeeded');

      // Cleanup
      await supabase.from('orivapay_transactions').delete().eq('id', idempotencyTransaction!.id);
    });
  });
});