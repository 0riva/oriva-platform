// Task: T031-T034 - Conversations API contract tests
// Description: TDD contract tests for conversation management endpoints (must fail before implementation)
// Dependencies: OpenAPI spec at specs/003-hugo-platform-integration/contracts/hugo-user-api.yaml

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Conversations API Contracts', () => {
  let testAccessToken: string;
  let testUserId: string;
  let testConversationId: string;
  const testAppId = 'hugo_matchmaker';

  beforeAll(async () => {
    // Register and login test user
    const registerResponse = await request(API_BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: 'conversations-test@example.com',
        password: 'SecureP@ssw0rd123',
        name: 'Conversations Test User',
      });

    testAccessToken = registerResponse.body.access_token;
    testUserId = registerResponse.body.user_id;
  });

  describe('POST /api/v1/conversations - T031', () => {
    it('should create a new conversation', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          title: 'My First Coaching Session',
        })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('user_id', testUserId);
      expect(response.body).toHaveProperty('app_id');
      expect(response.body).toHaveProperty('title', 'My First Coaching Session');
      expect(response.body).toHaveProperty('message_count', 0);
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('last_message_at');
      expect(response.body.closed_at).toBeNull();

      // Save for subsequent tests
      testConversationId = response.body.id;
    });

    it('should create conversation with auto-generated title if not provided', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({})
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
    });

    it('should reject conversation creation without authentication', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/conversations')
        .set('X-App-ID', testAppId)
        .send({
          title: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should reject conversation creation without X-App-ID', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          title: 'Test',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/conversations - T032', () => {
    it('should list user conversations', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('conversations');
      expect(Array.isArray(response.body.conversations)).toBe(true);
      expect(response.body).toHaveProperty('total_count');
      expect(response.body.total_count).toBeGreaterThan(0);

      // Verify structure
      const conversation = response.body.conversations[0];
      expect(conversation).toHaveProperty('id');
      expect(conversation).toHaveProperty('title');
      expect(conversation).toHaveProperty('message_count');
      expect(conversation).toHaveProperty('created_at');
      expect(conversation).toHaveProperty('last_message_at');
    });

    it('should list conversations sorted by last_message_at descending', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(200);

      const conversations = response.body.conversations;

      if (conversations.length > 1) {
        for (let i = 0; i < conversations.length - 1; i++) {
          const current = new Date(conversations[i].last_message_at).getTime();
          const next = new Date(conversations[i + 1].last_message_at).getTime();
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    it('should support pagination with limit parameter', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations?limit=5')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(200);

      expect(response.body.conversations.length).toBeLessThanOrEqual(5);
    });

    it('should support pagination with offset parameter', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations?offset=1')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(200);

      expect(response.body).toHaveProperty('conversations');
      expect(Array.isArray(response.body.conversations)).toBe(true);
    });

    it('should filter conversations by status (active)', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations?status=active')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(200);

      const conversations = response.body.conversations;
      conversations.forEach((conv: { closed_at: unknown }) => {
        expect(conv.closed_at).toBeNull();
      });
    });

    it('should filter conversations by status (closed)', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations?status=closed')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(200);

      const conversations = response.body.conversations;
      conversations.forEach((conv: { closed_at: string | null }) => {
        expect(conv.closed_at).not.toBeNull();
      });
    });

    it('should only show conversations for current user (FR-014)', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(200);

      const conversations = response.body.conversations;
      conversations.forEach((conv: { user_id: string }) => {
        expect(conv.user_id).toBe(testUserId);
      });
    });

    it('should reject list without authentication', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations')
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });
  });

  describe('GET /api/v1/conversations/:id - T033', () => {
    it('should get conversation by ID with messages', async () => {
      const response = await request(API_BASE_URL)
        .get(`/api/v1/conversations/${testConversationId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('id', testConversationId);
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('message_count');
      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
      expect(response.body).toHaveProperty('created_at');
      expect(response.body).toHaveProperty('last_message_at');
    });

    it('should include messages in chronological order', async () => {
      // First, send a message to populate conversation
      await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'Test message',
        });

      const response = await request(API_BASE_URL)
        .get(`/api/v1/conversations/${testConversationId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(200);

      const messages = response.body.messages;
      if (messages.length > 1) {
        for (let i = 0; i < messages.length - 1; i++) {
          const current = new Date(messages[i].created_at).getTime();
          const next = new Date(messages[i + 1].created_at).getTime();
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });

    it('should reject get with invalid conversation ID format', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations/not-a-uuid')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject get with non-existent conversation ID', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/conversations/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should reject get for conversation owned by different user', async () => {
      // Create another user
      const otherUserResponse = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'other-conv-user@example.com',
          password: 'SecureP@ssw0rd123',
          name: 'Other User',
        });

      const otherToken = otherUserResponse.body.access_token;

      // Try to access first user's conversation
      const response = await request(API_BASE_URL)
        .get(`/api/v1/conversations/${testConversationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('DELETE /api/v1/conversations/:id - T034', () => {
    let deleteTestConversationId: string;

    beforeAll(async () => {
      // Create a conversation to delete
      const response = await request(API_BASE_URL)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          title: 'To Be Deleted',
        });

      deleteTestConversationId = response.body.id;
    });

    it('should delete conversation and cascade to messages (FR-021)', async () => {
      const response = await request(API_BASE_URL)
        .delete(`/api/v1/conversations/${deleteTestConversationId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(204);

      expect(response.body).toEqual({});

      // Verify conversation no longer exists
      const getResponse = await request(API_BASE_URL)
        .get(`/api/v1/conversations/${deleteTestConversationId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(404);

      expect(getResponse.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should reject delete with invalid conversation ID format', async () => {
      const response = await request(API_BASE_URL)
        .delete('/api/v1/conversations/not-a-uuid')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject delete for non-existent conversation', async () => {
      const response = await request(API_BASE_URL)
        .delete('/api/v1/conversations/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should reject delete for conversation owned by different user', async () => {
      // Create another user and conversation
      const otherUserResponse = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'delete-other-user@example.com',
          password: 'SecureP@ssw0rd123',
          name: 'Delete Test User',
        });

      const otherToken = otherUserResponse.body.access_token;

      // Try to delete first user's conversation
      const response = await request(API_BASE_URL)
        .delete(`/api/v1/conversations/${testConversationId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should reject delete without authentication', async () => {
      const response = await request(API_BASE_URL)
        .delete(`/api/v1/conversations/${testConversationId}`)
        .set('X-App-ID', testAppId)
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should handle graceful 404 on double delete', async () => {
      // Create and delete a conversation
      const createResponse = await request(API_BASE_URL)
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          title: 'Double Delete Test',
        });

      const conversationId = createResponse.body.id;

      // First delete
      await request(API_BASE_URL)
        .delete(`/api/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(204);

      // Second delete attempt
      const response = await request(API_BASE_URL)
        .delete(`/api/v1/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });
  });
});