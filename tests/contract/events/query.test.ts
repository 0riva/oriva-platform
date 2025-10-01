// Task: T003 - GET /api/v1/apps/:appId/events contract test (TDD - must fail before implementation)
// Description: Test event list retrieval with filtering and pagination

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('GET /api/v1/apps/:appId/events - Contract Tests', () => {
  let testApiKey: string;
  let testAppId: string;
  let testUserId: string;

  beforeAll(async () => {
    testAppId = 'test-app';
    testApiKey = process.env.TEST_API_KEY || 'test_api_key_placeholder';
    testUserId = process.env.TEST_USER_ID || 'test-user-id';
  });

  it('should retrieve event list with pagination', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/events`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('events');
    expect(Array.isArray(response.body.events)).toBe(true);
    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('limit');
    expect(response.body).toHaveProperty('offset');
  });

  it('should filter by event_category', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/events?event_category=notification`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    expect(response.body.events).toBeDefined();
    // All returned events should have category 'notification'
    response.body.events.forEach((event: any) => {
      expect(event.event_category).toBe('notification');
    });
  });

  it('should filter by event_type', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/events?event_type=dismissed`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    expect(response.body.events).toBeDefined();
    response.body.events.forEach((event: any) => {
      expect(event.event_type).toBe('dismissed');
    });
  });

  it('should filter by date range', async () => {
    const startDate = new Date('2025-09-01').toISOString();
    const endDate = new Date('2025-09-30').toISOString();

    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/events?start_date=${startDate}&end_date=${endDate}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    expect(response.body.events).toBeDefined();
    response.body.events.forEach((event: any) => {
      const eventDate = new Date(event.created_at);
      expect(eventDate >= new Date(startDate)).toBe(true);
      expect(eventDate <= new Date(endDate)).toBe(true);
    });
  });

  it('should support pagination with limit and offset', async () => {
    const limit = 10;
    const offset = 5;

    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/events?limit=${limit}&offset=${offset}`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    expect(response.body.limit).toBe(limit);
    expect(response.body.offset).toBe(offset);
    expect(response.body.events.length).toBeLessThanOrEqual(limit);
  });

  it('should enforce authentication', async () => {
    await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/events`)
      // No Authorization header
      .expect(401);
  });

  it('should enforce app isolation - apps only see their own events', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/events`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    // All events should belong to testAppId
    response.body.events.forEach((event: any) => {
      expect(event.app_id).toBe(testAppId);
    });
  });

  it('should return 404 for non-existent app', async () => {
    await request(API_BASE_URL)
      .get('/api/v1/apps/non-existent-app/events')
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(404);
  });

  it('should sort events by created_at DESC', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/v1/apps/${testAppId}/events`)
      .set('Authorization', `Bearer ${testApiKey}`)
      .expect(200);

    const events = response.body.events;
    for (let i = 1; i < events.length; i++) {
      const prevDate = new Date(events[i - 1].created_at);
      const currDate = new Date(events[i].created_at);
      expect(prevDate >= currDate).toBe(true);
    }
  });
});
