// Task: T007 - PATCH /api/v1/notifications/:id contract test (TDD - must fail before implementation)
// Description: Test notification state updates (read, dismiss, click)

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('PATCH /api/v1/notifications/:id - Contract Tests', () => {
  let testApiKey: string;
  let testNotificationId: string;

  beforeAll(async () => {
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
    testNotificationId = 'test-notification-id';
  });

  it('should mark notification as read', async () => {
    const response = await request(API_BASE_URL)
      .patch(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ status: 'read' })
      .expect(200);

    expect(response.body.status).toBe('read');
    expect(response.body).toHaveProperty('read_at');
  });

  it('should dismiss notification', async () => {
    const response = await request(API_BASE_URL)
      .patch(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ status: 'dismissed', dismissed_from: 'oriva_core' })
      .expect(200);

    expect(response.body.status).toBe('dismissed');
    expect(response.body).toHaveProperty('dismissed_at');
    expect(response.body.dismissed_from).toBe('oriva_core');
  });

  it('should mark as clicked', async () => {
    const response = await request(API_BASE_URL)
      .patch(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ status: 'clicked', click_action: 'View Session' })
      .expect(200);

    expect(response.body.status).toBe('clicked');
    expect(response.body).toHaveProperty('clicked_at');
  });

  it('should handle idempotent dismissal', async () => {
    // First dismissal
    await request(API_BASE_URL)
      .patch(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ status: 'dismissed' })
      .expect(200);

    // Second dismissal should also succeed
    const response = await request(API_BASE_URL)
      .patch(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ status: 'dismissed' })
      .expect(200);

    expect(response.body.status).toBe('dismissed');
  });

  it('should reject invalid status transition', async () => {
    await request(API_BASE_URL)
      .patch(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ status: 'invalid_status' })
      .expect(400);
  });

  it('should enforce authentication', async () => {
    await request(API_BASE_URL)
      .patch(`/api/v1/notifications/${testNotificationId}`)
      .send({ status: 'read' })
      .expect(401);
  });

  it('should return 404 for non-existent notification', async () => {
    await request(API_BASE_URL)
      .patch('/api/v1/notifications/non-existent-id')
      .set('Authorization', `Bearer ${testApiKey}`)
      .send({ status: 'read' })
      .expect(404);
  });
});
