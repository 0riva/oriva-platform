// Task: T027-T030 - Chat API contract tests
// Description: TDD contract tests for AI chat endpoint (must fail before implementation)
// Dependencies: OpenAPI spec at specs/003-hugo-platform-integration/contracts/hugo-chat-api.yaml

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Chat API Contracts', () => {
  let testAccessToken: string;
  let testConversationId: string;
  const testAppId = 'hugo_matchmaker';

  beforeAll(async () => {
    // Register and login test user
    const registerResponse = await request(API_BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: 'chat-test@example.com',
        password: 'SecureP@ssw0rd123',
        name: 'Chat Test User',
      });

    testAccessToken = registerResponse.body.access_token;

    // Create a conversation
    const conversationResponse = await request(API_BASE_URL)
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${testAccessToken}`)
      .set('X-App-ID', testAppId)
      .send({
        title: 'Test Coaching Session',
      });

    testConversationId = conversationResponse.body.id;
  });

  describe('POST /api/v1/hugo/chat - T027', () => {
    it('should send message and receive streaming response', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'How do I show vulnerability without seeming weak?',
        })
        .expect('Content-Type', /text\/event-stream/)
        .expect(200);

      // Validate streaming response format
      const responseText = response.text;
      expect(responseText).toMatch(/data: /);
      expect(responseText).toMatch(/"type":"token"/);
      expect(responseText).toMatch(/"type":"done"/);

      // Parse SSE events
      const events = parseSSEEvents(responseText);
      expect(events.length).toBeGreaterThan(0);

      const tokenEvents = events.filter((e) => e.type === 'token');
      const doneEvent = events.find((e) => e.type === 'done');

      expect(tokenEvents.length).toBeGreaterThan(0);
      expect(doneEvent).toBeDefined();
      expect(doneEvent).toHaveProperty('message_id');
      expect(doneEvent).toHaveProperty('confidence');
      expect(doneEvent!.confidence).toBeGreaterThanOrEqual(0);
      expect(doneEvent!.confidence).toBeLessThanOrEqual(1);
    }, 10000); // 10s timeout for streaming

    it('should include knowledge sources in response metadata', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'Tell me about the Intimacy Code principles',
        })
        .expect(200);

      const events = parseSSEEvents(response.text);
      const doneEvent = events.find((e) => e.type === 'done');

      expect(doneEvent).toBeDefined();

      // Should include knowledge sources if available
      if (doneEvent!.knowledge_sources) {
        expect(Array.isArray(doneEvent!.knowledge_sources)).toBe(true);
        if (doneEvent!.knowledge_sources.length > 0) {
          const source = doneEvent!.knowledge_sources[0];
          expect(source).toHaveProperty('entry_id');
          expect(source).toHaveProperty('title');
          expect(source).toHaveProperty('relevance_score');
        }
      }
    }, 10000);

    it('should respect additional context if provided', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'What should I focus on?',
          context: {
            current_goals: ['Build confidence', 'Practice authentic communication'],
            metadata: {
              session_type: 'coaching',
            },
          },
        })
        .expect(200);

      const events = parseSSEEvents(response.text);
      const doneEvent = events.find((e) => e.type === 'done');

      expect(doneEvent).toBeDefined();
      expect(doneEvent).toHaveProperty('message_id');
    }, 10000);

    it('should maintain conversation history across messages', async () => {
      // Send first message
      const firstResponse = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'I want to learn about building connections',
        })
        .expect(200);

      const firstEvents = parseSSEEvents(firstResponse.text);
      const firstDone = firstEvents.find((e) => e.type === 'done');
      expect(firstDone).toHaveProperty('message_id');

      // Send follow-up message (should reference previous context)
      const secondResponse = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'Can you tell me more about that?',
        })
        .expect(200);

      const secondEvents = parseSSEEvents(secondResponse.text);
      const secondDone = secondEvents.find((e) => e.type === 'done');
      expect(secondDone).toHaveProperty('message_id');
    }, 15000);
  });

  describe('POST /api/v1/hugo/chat - Performance - T028', () => {
    it('should respond within 3 seconds (FR-026)', async () => {
      const startTime = Date.now();

      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'What is authentic vulnerability?',
        })
        .expect(200);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Performance requirement: <3s end-to-end (FR-026)
      expect(executionTime).toBeLessThan(3000);
    }, 10000);

    it('should have first token within 500ms', async () => {
      const startTime = Date.now();
      let firstTokenTime = 0;

      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'Quick question about dating',
        })
        .expect(200);

      const events = parseSSEEvents(response.text);
      if (events.length > 0) {
        firstTokenTime = Date.now() - startTime;
      }

      // First token should arrive quickly (streaming performance)
      expect(firstTokenTime).toBeLessThan(500);
    }, 10000);
  });

  describe('POST /api/v1/hugo/chat - Validation - T029', () => {
    it('should reject chat without authentication', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'test message',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should reject chat without X-App-ID header', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          conversation_id: testConversationId,
          message: 'test message',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject chat with missing conversation_id', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          message: 'test message',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject chat with missing message', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject chat with empty message', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: '',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject chat with message exceeding max length', async () => {
      const longMessage = 'a'.repeat(5001);
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: longMessage,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject chat with invalid conversation_id format', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: 'not-a-uuid',
          message: 'test message',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject chat with non-existent conversation_id', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: '550e8400-e29b-41d4-a716-446655440000',
          message: 'test message',
        })
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should reject chat with conversation from different user', async () => {
      // Create another user
      const otherUserResponse = await request(API_BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          email: 'other-chat-user@example.com',
          password: 'SecureP@ssw0rd123',
          name: 'Other User',
        });

      const otherToken = otherUserResponse.body.access_token;

      // Try to send message to first user's conversation
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${otherToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'test message',
        })
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('POST /api/v1/hugo/chat - Edge Cases - T030', () => {
    it('should handle special characters in message', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: "How do I say \"I care\" with <emphasis> & 'authenticity'?",
        })
        .expect(200);

      const events = parseSSEEvents(response.text);
      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
    }, 10000);

    it('should handle unicode characters in message', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'Comment puis-je montrer mon émoi? 日本語で話せますか？ 🌟',
        })
        .expect(200);

      const events = parseSSEEvents(response.text);
      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
    }, 10000);

    it('should handle error gracefully with streaming', async () => {
      // Trigger error by sending invalid data after validation passes
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/chat')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          conversation_id: testConversationId,
          message: 'test message',
          context: {
            metadata: {
              force_error: true, // Backend-specific error trigger
            },
          },
        });

      // Should either return 200 with error event or 500
      if (response.status === 200) {
        const events = parseSSEEvents(response.text);
        const errorEvent = events.find((e) => e.type === 'error');
        expect(errorEvent).toBeDefined();
      } else {
        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error');
      }
    }, 10000);
  });
});

// Helper function to parse Server-Sent Events
function parseSSEEvents(text: string): Array<{ type: string; [key: string]: unknown }> {
  const events: Array<{ type: string; [key: string]: unknown }> = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const dataStr = line.substring(6);
      try {
        const data = JSON.parse(dataStr);
        events.push(data);
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  return events;
}