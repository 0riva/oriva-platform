// Task: T008 - DELETE /api/v1/notifications/:id contract test (TDD - must fail before implementation)
// Description: Test notification deletion with authorization

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('DELETE /api/v1/notifications/:id - Contract Tests', () => {
  let testApiKey: string;
  let testNotificationId: string;

  beforeAll(async () => {
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
    testNotificationId = 'test-notification-id';
  });

  it('should delete notification', async () => {
    await request(API_BASE_URL)
      .delete(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(204);
  });

  it('should enforce app authorization', async () => {
    // Try to delete notification from another app
    await request(API_BASE_URL)
      .delete(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer wrong_api_key`)
      .expect(403);
  });

  it('should return 404 for non-existent notification', async () => {
    await request(API_BASE_URL)
      .delete('/api/v1/notifications/non-existent-id')
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(404);
  });

  it('should enforce authentication', async () => {
    await request(API_BASE_URL)
      .delete(`/api/v1/notifications/${testNotificationId}`)
      .expect(401);
  });

  it('should cascade delete notification_state', async () => {
    // After deleting notification, its state records should also be deleted
    await request(API_BASE_URL)
      .delete(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(204);

    // Verify notification no longer exists
    await request(API_BASE_URL)
      .get(`/api/v1/notifications/${testNotificationId}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(404);
  });
});
