// Task: T040 - Marketplace Items API contract tests (TDD - must fail before implementation)
// Description: Test marketplace item CRUD operations, search, and categories

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

// Test server configuration
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Marketplace Items API Contracts', () => {
  let testAccessToken: string;
  let testUserId: string;
  let testItemId: string;
  let testCategoryId: string;

  // Test user data
  const testUser = {
    email: `marketplace-test-${Date.now()}@example.com`,
    password: 'SecureP@ssw0rd123',
    name: 'Marketplace Test User',
  };

  // Test marketplace item data
  const testItem = {
    title: 'Test Premium Widget',
    description: 'A high-quality widget for testing marketplace functionality',
    price: 29.99,
    currency: 'USD',
    item_type: 'digital_product',
    category_id: null as string | null, // Will be set after category creation
    inventory_count: 100,
    metadata: {
      features: ['Feature A', 'Feature B', 'Feature C'],
      download_url: 'https://example.com/download/widget',
    },
  };

  // Setup: Register and login test user
  beforeAll(async () => {
    // Register test user
    const registerResponse = await request(API_BASE_URL)
      .post('/api/v1/auth/register')
      .send(testUser)
      .expect(201);

    testUserId = registerResponse.body.user.id;
    testAccessToken = registerResponse.body.access_token;
  });

  // Cleanup: Delete test data
  afterAll(async () => {
    // Delete test user account
    if (testAccessToken) {
      await request(API_BASE_URL)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({ password: testUser.password });
    }
  });

  describe('GET /api/v1/marketplace/items - T041', () => {
    it('should list marketplace items without authentication', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/marketplace/items')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
    });

    it('should support pagination parameters', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/marketplace/items?page=1&limit=10')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.items.length).toBeLessThanOrEqual(10);
    });

    it('should filter by item_type', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/marketplace/items?item_type=digital_product')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      // If items exist, verify they match the filter
      if (response.body.items.length > 0) {
        expect(response.body.items[0].item_type).toBe('digital_product');
      }
    });

    it('should filter by price range', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/marketplace/items?min_price=10&max_price=50')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      // Verify price filtering if items exist
      response.body.items.forEach((item: any) => {
        expect(item.price).toBeGreaterThanOrEqual(10);
        expect(item.price).toBeLessThanOrEqual(50);
      });
    });

    it('should reject invalid pagination parameters', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/marketplace/items?page=-1&limit=0')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/marketplace/items - T042', () => {
    it('should create a marketplace item with valid data', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/marketplace/items')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send(testItem)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title', testItem.title);
      expect(response.body).toHaveProperty('description', testItem.description);
      expect(response.body).toHaveProperty('price', testItem.price);
      expect(response.body).toHaveProperty('currency', testItem.currency);
      expect(response.body).toHaveProperty('item_type', testItem.item_type);
      expect(response.body).toHaveProperty('seller_id', testUserId);
      expect(response.body).toHaveProperty('status', 'draft'); // Default status
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('updated_at');

      // Save for subsequent tests
      testItemId = response.body.id;
    });

    it('should reject item creation without authentication', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/marketplace/items')
        .send(testItem)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should reject item creation with missing required fields', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/marketplace/items')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          title: 'Incomplete Item',
          // Missing description, price, item_type
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject item creation with invalid price', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/marketplace/items')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          ...testItem,
          price: -10, // Negative price
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/price/i);
    });

    it('should reject item creation with invalid item_type', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/marketplace/items')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          ...testItem,
          item_type: 'invalid_type',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/marketplace/items/:id - T043', () => {
    it('should get item details by ID', async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/v1/marketplace/items/${testItemId}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('id', testItemId);
      expect(response.body).toHaveProperty('title', testItem.title);
      expect(response.body).toHaveProperty('description');
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('seller_id');
      expect(response.body).toHaveProperty('metadata');
    });

    it('should return 404 for non-existent item', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/marketplace/items/00000000-0000-0000-0000-000000000000')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'ITEM_NOT_FOUND');
    });

    it('should return 400 for invalid item ID format', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/marketplace/items/invalid-id')
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('PUT /api/v1/marketplace/items/:id - T043', () => {
    it('should update item with valid data', async () => {
      const updatedData = {
        title: 'Updated Premium Widget',
        description: 'Updated description with more details',
        price: 39.99,
        status: 'published',
      };

      const response = await request(API_BASE_URL)
        .put(`/api/v1/marketplace/items/${testItemId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send(updatedData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('id', testItemId);
      expect(response.body).toHaveProperty('title', updatedData.title);
      expect(response.body).toHaveProperty('description', updatedData.description);
      expect(response.body).toHaveProperty('price', updatedData.price);
      expect(response.body).toHaveProperty('status', updatedData.status);
      expect(response.body.updated_at).not.toBe(response.body.created_at);
    });

    it('should reject update without authentication', async () => {
      const response = await request(API_BASE_URL)
        .put(`/api/v1/marketplace/items/${testItemId}`)
        .send({ title: 'Unauthorized Update' })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should reject update by non-owner', async () => {
      // Register another user
      const otherUser = {
        email: `other-user-${Date.now()}@example.com`,
        password: 'SecureP@ssw0rd123',
        name: 'Other User',
      };

      const registerResponse = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send(otherUser)
        .expect(201);

      const otherToken = registerResponse.body.access_token;

      const response = await request(API_BASE_URL)
        .put(`/api/v1/marketplace/items/${testItemId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Unauthorized Update Attempt' })
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'FORBIDDEN');

      // Cleanup
      await request(API_BASE_URL)
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ password: otherUser.password });
    });

    it('should reject update with invalid status transition', async () => {
      const response = await request(API_BASE_URL)
        .put(`/api/v1/marketplace/items/${testItemId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({ status: 'invalid_status' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/marketplace/items/:id - T043', () => {
    it('should delete item by owner', async () => {
      const response = await request(API_BASE_URL)
        .delete(`/api/v1/marketplace/items/${testItemId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(204);

      expect(response.body).toEqual({});

      // Verify deletion
      await request(API_BASE_URL)
        .get(`/api/v1/marketplace/items/${testItemId}`)
        .expect(404);
    });

    it('should reject deletion without authentication', async () => {
      const response = await request(API_BASE_URL)
        .delete(`/api/v1/marketplace/items/${testItemId}`)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should return 404 when deleting non-existent item', async () => {
      const response = await request(API_BASE_URL)
        .delete('/api/v1/marketplace/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'ITEM_NOT_FOUND');
    });
  });

  describe('Rate Limiting - T041-T043', () => {
    it('should enforce rate limits for unauthenticated users', async () => {
      // Free tier: 10 requests per minute for marketplace browsing
      const requests = Array.from({ length: 12 }, () =>
        request(API_BASE_URL).get('/api/v1/marketplace/items')
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
      expect(rateLimited[0].body).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED');
      expect(rateLimited[0].headers).toHaveProperty('retry-after');
    });
  });
});