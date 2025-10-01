// Task: T011 - PATCH /api/v1/apps/:appId/webhooks/:id contract test (TDD - must fail before implementation)
// Description: Test webhook updates

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('PATCH /api/v1/apps/:appId/webhooks/:id - Contract Tests', () => {
  let testApiKey: string;
  let testAppId: string;
  let testWebhookId: string;

  beforeAll(async () => {
    testAppId = 'test-app';
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
    testWebhookId = 'test-webhook-id';
  });

  it('should update webhook URL', async () => {
    const response = await request(API_BASE_URL)
      .patch(`/api/v1/apps/${testAppId}/webhooks/${testWebhookId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ webhook_url: 'https://new-url.com/webhooks' })
      .expect(200);

    expect(response.body.webhook_url).toBe('https://new-url.com/webhooks');
  });

  it('should update subscribed_events', async () => {
    const newEvents = ['notification.dismissed', 'notification.clicked', 'notification.created'];
    const response = await request(API_BASE_URL)
      .patch(`/api/v1/apps/${testAppId}/webhooks/${testWebhookId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ subscribed_events: newEvents })
      .expect(200);

    expect(response.body.subscribed_events).toEqual(newEvents);
  });

  it('should toggle is_active', async () => {
    const response = await request(API_BASE_URL)
      .patch(`/api/v1/apps/${testAppId}/webhooks/${testWebhookId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ is_active: false })
      .expect(200);

    expect(response.body.is_active).toBe(false);
  });

  it('should return 404 for non-existent webhook', async () => {
    await request(API_BASE_URL)
      .patch(`/api/v1/apps/${testAppId}/webhooks/non-existent-id`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ is_active: false })
      .expect(404);
  });

  it('should enforce authentication', async () => {
    await request(API_BASE_URL)
      .patch(`/api/v1/apps/${testAppId}/webhooks/${testWebhookId}`)
      .send({ is_active: false })
      .expect(401);
  });

  it('should enforce app authorization', async () => {
    await request(API_BASE_URL)
      .patch(`/api/v1/apps/other-app/webhooks/${testWebhookId}`)
      .set('Authorization', `Bearer wrong_api_key`)
      .send({ is_active: false })
      .expect(403);
  });
});
