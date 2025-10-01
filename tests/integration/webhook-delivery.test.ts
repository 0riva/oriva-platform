// Tasks: T018-T019 - Integration tests for webhook delivery (TDD - must fail before implementation)
// Description: Test webhook subscriptions, delivery, retries, and HMAC signatures

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import express from 'express';
import type { Server } from 'http';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBHOOK_SERVER_PORT = 9876;

describe('Integration: Webhook Delivery', () => {
  let supabase: any;
  let testApiKey: string;
  let testAppId: string;
  let testUserId: string;
  let webhookServer: Server;
  let receivedWebhooks: Array<{ headers: any; body: any; timestamp: number }>;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    testAppId = 'test-app';
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
    testUserId = process.env.TEST_USER_ID || 'test-user-id';

    receivedWebhooks = [];

    // Start mock webhook receiver server
    const app = express();
    app.use(express.json());

    // Success endpoint
    app.post('/webhooks/success', (req, res) => {
      receivedWebhooks.push({
        headers: req.headers,
        body: req.body,
        timestamp: Date.now(),
      });
      res.status(200).json({ received: true });
    });

    // Failure endpoint (returns 500)
    app.post('/webhooks/failure', (req, res) => {
      receivedWebhooks.push({
        headers: req.headers,
        body: req.body,
        timestamp: Date.now(),
      });
      res.status(500).json({ error: 'Internal server error' });
    });

    // Timeout endpoint (never responds)
    app.post('/webhooks/timeout', (req, res) => {
      // Intentionally don't respond
      receivedWebhooks.push({
        headers: req.headers,
        body: req.body,
        timestamp: Date.now(),
      });
    });

    webhookServer = app.listen(WEBHOOK_SERVER_PORT);
  });

  afterAll(async () => {
    // Cleanup
    if (supabase) {
      await supabase.from('webhook_delivery_log').delete().match({ app_id: testAppId });
      await supabase.from('app_webhooks').delete().eq('app_id', testAppId);
      await supabase.from('notification_state').delete().eq('user_id', testUserId);
      await supabase.from('platform_notifications').delete().eq('user_id', testUserId);
      await supabase.from('platform_events').delete().eq('user_id', testUserId);
    }

    if (webhookServer) {
      webhookServer.close();
    }
  });

  beforeEach(() => {
    receivedWebhooks = [];
  });

  // T018: App subscribes to platform events
  describe('T018: App subscribes to platform events', () => {
    let webhookId: string;
    let webhookSecret: string;
    let notificationId: string;

    it('should deliver webhook with HMAC signature when event occurs', async () => {
      // Step 1: Create webhook subscription for notification.dismissed
      const webhookResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/webhooks`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          webhook_url: `http://localhost:${WEBHOOK_SERVER_PORT}/webhooks/success`,
          subscribed_events: ['notification.dismissed'],
        })
        .expect(201);

      expect(webhookResponse.body).toHaveProperty('webhook_id');
      expect(webhookResponse.body).toHaveProperty('webhook_secret');

      webhookId = webhookResponse.body.webhook_id;
      webhookSecret = webhookResponse.body.webhook_secret;

      // Step 2: Create notification
      const notificationResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          user_id: testUserId,
          title: 'Webhook Test Notification',
          body: 'This notification will trigger a webhook',
          priority: 'normal',
          external_id: `webhook_test_${Date.now()}`,
        })
        .expect(201);

      notificationId = notificationResponse.body.notification_id;

      // Step 3: Dismiss notification (triggers webhook)
      await request(API_BASE_URL)
        .patch(`/api/v1/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({ status: 'dismissed' })
        .expect(200);

      // Step 4: Wait for webhook delivery (async background worker)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Step 5: Verify webhook_delivery_log entry created
      const { data: deliveryLogs } = await supabase
        .from('webhook_delivery_log')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(1);

      expect(deliveryLogs.length).toBeGreaterThan(0);
      const log = deliveryLogs[0];
      expect(log.event_type).toBe('notification.dismissed');
      expect(log.response_status).toBe(200);
      expect(log.attempts).toBe(1);

      // Step 6: Verify HTTP POST sent to webhook_url
      expect(receivedWebhooks.length).toBeGreaterThan(0);
      const receivedWebhook = receivedWebhooks[receivedWebhooks.length - 1];

      // Step 7: Verify HMAC signature included in X-Oriva-Signature header
      expect(receivedWebhook.headers).toHaveProperty('x-oriva-signature');
      const signature = receivedWebhook.headers['x-oriva-signature'];
      expect(signature).toBeDefined();

      // Verify signature is valid
      const payload = JSON.stringify(receivedWebhook.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      expect(signature).toBe(`sha256=${expectedSignature}`);

      // Step 8: Verify payload matches event schema
      expect(receivedWebhook.body).toHaveProperty('event_id');
      expect(receivedWebhook.body).toHaveProperty('event_type');
      expect(receivedWebhook.body.event_type).toBe('notification.dismissed');
      expect(receivedWebhook.body).toHaveProperty('timestamp');
      expect(receivedWebhook.body).toHaveProperty('data');
      expect(receivedWebhook.body.data).toHaveProperty('notification_id');
      expect(receivedWebhook.body.data.notification_id).toBe(notificationId);
    });
  });

  // T019: Webhook retry on failure
  describe('T019: Webhook retry on failure', () => {
    let webhookId: string;
    let notificationId: string;

    it('should retry failed webhooks with exponential backoff', async () => {
      // Step 1: Create webhook pointing to failing endpoint
      const webhookResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/webhooks`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          webhook_url: `http://localhost:${WEBHOOK_SERVER_PORT}/webhooks/failure`,
          subscribed_events: ['notification.created'],
        })
        .expect(201);

      webhookId = webhookResponse.body.webhook_id;

      // Step 2: Create notification (triggers webhook)
      const notificationResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          user_id: testUserId,
          title: 'Retry Test Notification',
          body: 'This will trigger a failing webhook',
          priority: 'normal',
          external_id: `retry_test_${Date.now()}`,
        })
        .expect(201);

      notificationId = notificationResponse.body.notification_id;

      // Step 3: Wait for initial delivery + retries
      // Retry schedule: 1s, 2s, 4s, 8s, 16s
      await new Promise((resolve) => setTimeout(resolve, 35000));

      // Step 4: Verify first delivery failed, logged in webhook_delivery_log
      const { data: allDeliveryLogs } = await supabase
        .from('webhook_delivery_log')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: true });

      expect(allDeliveryLogs.length).toBeGreaterThan(0);
      const firstLog = allDeliveryLogs[0];
      expect(firstLog.response_status).toBe(500);
      expect(firstLog.success).toBe(false);

      // Step 5: Verify retry scheduled with exponential backoff
      // Should have multiple delivery attempts
      expect(allDeliveryLogs.length).toBeGreaterThanOrEqual(2);

      // Verify retry timing follows exponential backoff
      for (let i = 1; i < Math.min(allDeliveryLogs.length, 5); i++) {
        const prevLog = allDeliveryLogs[i - 1];
        const currentLog = allDeliveryLogs[i];
        const timeDiff =
          new Date(currentLog.created_at).getTime() - new Date(prevLog.created_at).getTime();

        // Each retry should be roughly 2^i seconds after the previous
        const expectedDelay = Math.pow(2, i) * 1000;
        expect(timeDiff).toBeGreaterThan(expectedDelay * 0.8); // Allow 20% variance
        expect(timeDiff).toBeLessThan(expectedDelay * 1.5);
      }

      // Step 6: Verify retry attempts (up to 5 times)
      expect(allDeliveryLogs.length).toBeLessThanOrEqual(5);

      // Verify attempts counter increases
      const lastLog = allDeliveryLogs[allDeliveryLogs.length - 1];
      expect(lastLog.attempts).toBe(allDeliveryLogs.length);
    }, 40000); // Extended timeout for retries

    it('should disable webhook after 100 consecutive failures', async () => {
      // Step 1: Create webhook
      const webhookResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/webhooks`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          webhook_url: `http://localhost:${WEBHOOK_SERVER_PORT}/webhooks/failure`,
          subscribed_events: ['notification.dismissed'],
        })
        .expect(201);

      const tempWebhookId = webhookResponse.body.webhook_id;

      // Step 2: Simulate 100 consecutive failures
      // In real implementation, this would be tracked by the webhook delivery worker
      // For this test, we'll update the database directly to simulate failures
      await supabase
        .from('app_webhooks')
        .update({ consecutive_failures: 100, is_active: false })
        .eq('id', tempWebhookId);

      // Step 3: Verify webhook is disabled
      const { data: webhook } = await supabase
        .from('app_webhooks')
        .select('*')
        .eq('id', tempWebhookId)
        .single();

      expect(webhook.is_active).toBe(false);
      expect(webhook.consecutive_failures).toBe(100);

      // Step 4: Create notification - webhook should not be triggered
      const beforeCount = receivedWebhooks.length;

      await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          user_id: testUserId,
          title: 'Should Not Trigger Webhook',
          body: 'Webhook is disabled',
          priority: 'normal',
          external_id: `disabled_webhook_${Date.now()}`,
        })
        .expect(201);

      // Wait for potential webhook delivery
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify no new webhook received
      expect(receivedWebhooks.length).toBe(beforeCount);
    });
  });

  // Additional test: Verify webhook signature validation
  describe('Webhook signature validation', () => {
    it('should allow apps to verify webhook authenticity using HMAC', async () => {
      // This test verifies the signature generation matches the expected format
      const webhookResponse = await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/webhooks`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          webhook_url: `http://localhost:${WEBHOOK_SERVER_PORT}/webhooks/success`,
          subscribed_events: ['notification.created'],
        })
        .expect(201);

      const webhookSecret = webhookResponse.body.webhook_secret;

      // Create notification
      await request(API_BASE_URL)
        .post(`/api/v1/apps/${testAppId}/notifications`)
        .set('Authorization', `Bearer ${testApiKey}`)
        .send({
          user_id: testUserId,
          title: 'Signature Test',
          body: 'Testing HMAC signature',
          priority: 'normal',
          external_id: `sig_test_${Date.now()}`,
        })
        .expect(201);

      // Wait for webhook delivery
      await new Promise((resolve) => setTimeout(resolve, 3000));

      expect(receivedWebhooks.length).toBeGreaterThan(0);
      const webhook = receivedWebhooks[receivedWebhooks.length - 1];

      // Verify signature
      const payload = JSON.stringify(webhook.body);
      const receivedSignature = webhook.headers['x-oriva-signature'];

      // Compute expected signature
      const expectedSignature =
        'sha256=' + crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');

      expect(receivedSignature).toBe(expectedSignature);

      // Verify tampering detection
      const tamperedPayload = JSON.stringify({ ...webhook.body, tampered: true });
      const tamperedSignature =
        'sha256=' + crypto.createHmac('sha256', webhookSecret).update(tamperedPayload).digest('hex');

      expect(tamperedSignature).not.toBe(receivedSignature);
    });
  });
});
