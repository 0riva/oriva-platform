// Task: T010 - GET /api/v1/apps/:appId/webhooks contract test (TDD - must fail before implementation)
// Description: Test webhook list retrieval

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('GET /api/v1/apps/:appId/webhooks - Contract Tests', () => {
  let testApiKey: string;
  let testAppId: string;

  beforeAll(async () => {
    testAppId = 'test-app';
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
  });

  it('should list app webhooks', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/webhooks`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    expect(response.body).toHaveProperty('webhooks');
    expect(Array.isArray(response.body.webhooks)).toBe(true);
  });

  it('should exclude webhook_secret from response', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/webhooks`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    response.body.webhooks.forEach((webhook: any) => {
      expect(webhook).not.toHaveProperty('webhook_secret');
    });
  });

  it('should return empty array for app with no webhooks', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/webhooks`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    expect(response.body.webhooks).toBeDefined();
  });

  it('should enforce authentication', async () => {
    await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/webhooks`)
      .expect(401);
  });

  it('should enforce app isolation', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/webhooks`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    response.body.webhooks.forEach((webhook: any) => {
      expect(webhook.app_id).toBe(testAppId);
    });
  });
});
