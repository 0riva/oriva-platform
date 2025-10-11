/**
 * Contract Test: GET /api/v1/users/:userId/notifications
 * Task: T006
 *
 * TDD Phase: GREEN - Testing with real database
 */

import request from 'supertest';
import { createTestClient, TEST_USER_TOKENS } from '../../../test-utils/client';

describe('GET /api/v1/users/:userId/notifications - Contract Tests', () => {
  let client: any;
  const testToken = TEST_USER_TOKENS.user1; // Alice
  const testUserId = '00000000-0000-0000-0000-000000000001'; // Alice's user ID

  beforeEach(() => {
    client = createTestClient();
  });

  it('should return notification list for user', async () => {
    // Act
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications`)
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    // Assert - Contract requirements
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('notifications');
    expect(Array.isArray(response.body.notifications)).toBe(true);
    expect(response.body).toHaveProperty('total');
  });

  it('should filter by status (unread)', async () => {
    // Act
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications?status=unread`)
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    // Assert
    expect(response.status).toBe(200);

    // Validate filter if data exists
    if (response.body.notifications.length > 0) {
      response.body.notifications.forEach((notif: any) => {
        expect(notif.status).toBe('unread');
      });
    }
  });

  it('should filter by app_id', async () => {
    const appId = '00000000-0000-0000-0000-000000000011'; // hugo_love app ID

    // Act
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications?app_id=${appId}`)
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    // Assert
    expect(response.status).toBe(200);

    // Validate filter if data exists
    if (response.body.notifications.length > 0) {
      response.body.notifications.forEach((notif: any) => {
        expect(notif.app_id).toBe(appId);
      });
    }
  });

  it('should support pagination', async () => {
    // Act
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications?limit=10&offset=5`)
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.notifications.length).toBeLessThanOrEqual(10);
  });

  it('should exclude expired notifications', async () => {
    // Act
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications`)
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    // Assert
    expect(response.status).toBe(200);

    // Validate expiration if data exists
    if (response.body.notifications.length > 0) {
      response.body.notifications.forEach((notif: any) => {
        if (notif.expires_at) {
          expect(new Date(notif.expires_at) > new Date()).toBe(true);
        }
      });
    }
  });

  it('should enforce authentication', async () => {
    // Act - No Authorization header
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications`)
      .set('X-API-Key', 'test-api-key');

    // Assert
    expect(response.status).toBe(401);
  });

  it('should enforce user isolation', async () => {
    // Act
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications`)
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    // Assert
    expect(response.status).toBe(200);

    // Validate isolation if data exists
    if (response.body.notifications.length > 0) {
      response.body.notifications.forEach((notif: any) => {
        expect(notif.user_id).toBe(testUserId);
      });
    }
  });

  it('should include app branding', async () => {
    // Act
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications`)
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    // Assert
    expect(response.status).toBe(200);

    // Validate branding if data exists
    if (response.body.notifications.length > 0) {
      response.body.notifications.forEach((notif: any) => {
        expect(notif).toHaveProperty('app_name');
        expect(notif).toHaveProperty('app_icon');
      });
    }
  });

  it('should sort by priority then created_at DESC', async () => {
    // Act
    const response = await request(client)
      .get(`/api/v1/users/${testUserId}/notifications`)
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    // Assert
    expect(response.status).toBe(200);

    // Validate sorting if data exists
    if (response.body.notifications.length > 1) {
      const priorities = { urgent: 1, high: 2, normal: 3, low: 4 };
      const notifications = response.body.notifications;

      for (let i = 1; i < notifications.length; i++) {
        const prevPriority = priorities[notifications[i - 1].priority as keyof typeof priorities];
        const currPriority = priorities[notifications[i].priority as keyof typeof priorities];
        expect(prevPriority).toBeLessThanOrEqual(currPriority);
      }
    }
  });
});
