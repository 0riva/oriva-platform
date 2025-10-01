// Task: T012 - DELETE /api/v1/apps/:appId/webhooks/:id contract test (TDD - must fail before implementation)
// Description: Test webhook deletion

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('DELETE /api/v1/apps/:appId/webhooks/:id - Contract Tests', () => {
  let testApiKey: string;
  let testAppId: string;
  let testWebhookId: string;

  beforeAll(async () => {
    testAppId = 'test-app';
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
    testWebhookId = 'test-webhook-id';
  });

  it('should delete webhook', async () => {
    await request(API_BASE_URL)
      .delete(`/api/v1/apps/${testAppId}/webhooks/${testWebhookId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(204);
  });

  it('should return 404 for non-existent webhook', async () => {
    await request(API_BASE_URL)
      .delete(`/api/v1/apps/${testAppId}/webhooks/non-existent-id`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(404);
  });

  it('should enforce authentication', async () => {
    await request(API_BASE_URL)
      .delete(`/api/v1/apps/${testAppId}/webhooks/${testWebhookId}`)
      .expect(401);
  });

  it('should enforce app authorization', async () => {
    await request(API_BASE_URL)
      .delete(`/api/v1/apps/other-app/webhooks/${testWebhookId}`)
      .set('Authorization', `Bearer wrong_api_key`)
      .expect(403);
  });
});
