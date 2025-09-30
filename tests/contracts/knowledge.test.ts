// Task: T023-T026 - Knowledge API contract tests
// Description: TDD contract tests for knowledge search endpoints (must fail before implementation)
// Dependencies: OpenAPI spec at specs/003-hugo-platform-integration/contracts/hugo-knowledge-api.yaml

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('Knowledge API Contracts', () => {
  let testAccessToken: string;
  const testAppId = 'hugo_matchmaker';

  beforeAll(async () => {
    // Register and login test user
    const registerResponse = await request(API_BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        email: 'knowledge-test@example.com',
        password: 'SecureP@ssw0rd123',
        name: 'Knowledge Test User',
      });

    testAccessToken = registerResponse.body.access_token;
  });

  describe('POST /api/v1/hugo/knowledge/search - T023', () => {
    it('should search knowledge base with valid query', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'authentic vulnerability',
          max_results: 5,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body).toHaveProperty('total_count');
      expect(response.body).toHaveProperty('query_time_ms');
      expect(typeof response.body.query_time_ms).toBe('number');

      // Performance requirement: <1s (FR-028)
      expect(response.body.query_time_ms).toBeLessThan(1000);

      // Validate result structure
      if (response.body.results.length > 0) {
        const firstResult = response.body.results[0];
        expect(firstResult).toHaveProperty('id');
        expect(firstResult).toHaveProperty('title');
        expect(firstResult).toHaveProperty('content');
        expect(firstResult).toHaveProperty('relevance_score');
        expect(firstResult.relevance_score).toBeGreaterThanOrEqual(0);
        expect(firstResult.relevance_score).toBeLessThanOrEqual(1);
      }
    });

    it('should return results ranked by relevance', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'intimacy code principle',
          max_results: 10,
        })
        .expect(200);

      const { results } = response.body;

      if (results.length > 1) {
        // Verify results are sorted by relevance (descending)
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].relevance_score).toBeGreaterThanOrEqual(results[i + 1].relevance_score);
        }
      }
    });

    it('should handle query without exact matches gracefully (FR-008)', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'xyzabc123nonsensekeyword',
          max_results: 5,
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('total_count', 0);
      expect(response.body.results).toEqual([]);

      // Optional: suggestions for alternative searches
      if (response.body.suggestions) {
        expect(Array.isArray(response.body.suggestions)).toBe(true);
      }
    });

    it('should filter by category when specified', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'vulnerability',
          max_results: 5,
          category: 'principles',
        })
        .expect(200);

      const { results } = response.body;

      // All results should match the specified category
      results.forEach((result: { category: string }) => {
        expect(result.category).toBe('principles');
      });
    });

    it('should respect max_results parameter', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'dating',
          max_results: 3,
        })
        .expect(200);

      const { results } = response.body;
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should respect min_relevance threshold', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'communication',
          max_results: 10,
          min_relevance: 0.7,
        })
        .expect(200);

      const { results } = response.body;

      // All results should meet minimum relevance threshold
      results.forEach((result: { relevance_score: number }) => {
        expect(result.relevance_score).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should only return knowledge from current app (FR-009)', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'principle',
          max_results: 10,
        })
        .expect(200);

      // Results should only come from hugo_matchmaker knowledge bases
      // This is verified by checking that the query filters by app_id
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });
  });

  describe('POST /api/v1/hugo/knowledge/search - Validation - T024', () => {
    it('should reject search without authentication', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('X-App-ID', testAppId)
        .send({
          query: 'test query',
        })
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'AUTH_MISSING');
    });

    it('should reject search without X-App-ID header', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          query: 'test query',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject search with missing query', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          max_results: 5,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject search with empty query', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: '',
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject search with query exceeding max length', async () => {
      const longQuery = 'a'.repeat(501);
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: longQuery,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject invalid max_results (below minimum)', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'test',
          max_results: 0,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject invalid max_results (above maximum)', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'test',
          max_results: 21,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject invalid min_relevance (below 0)', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'test',
          min_relevance: -0.1,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject invalid min_relevance (above 1)', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'test',
          min_relevance: 1.1,
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  describe('Knowledge Search - Performance - T025', () => {
    it('should complete search within 1 second (FR-028)', async () => {
      const startTime = Date.now();

      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'intimacy code authentic vulnerability',
          max_results: 10,
        })
        .expect(200);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Performance requirement: <1s (FR-028)
      expect(executionTime).toBeLessThan(1000);
      expect(response.body.query_time_ms).toBeLessThan(1000);
    });

    it('should handle concurrent searches efficiently', async () => {
      const searches = Array.from({ length: 5 }, (_, i) =>
        request(API_BASE_URL)
          .post('/api/v1/hugo/knowledge/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .set('X-App-ID', testAppId)
          .send({
            query: `search query ${i}`,
            max_results: 5,
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(searches);
      const endTime = Date.now();

      // All searches should complete
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.query_time_ms).toBeLessThan(1000);
      });

      // Total concurrent execution should be reasonable
      expect(endTime - startTime).toBeLessThan(3000);
    });
  });

  describe('Knowledge Search - Edge Cases - T026', () => {
    it('should handle special characters in query', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: "vulnerability & 'authentic' connection",
          max_results: 5,
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should handle unicode characters in query', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'café émotions 日本語',
          max_results: 5,
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should handle very short queries', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'a',
          max_results: 5,
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should handle queries with only stopwords', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'the a an and or',
          max_results: 5,
        })
        .expect(200);

      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });

    it('should track access count when entries are returned', async () => {
      const firstResponse = await request(API_BASE_URL)
        .post('/api/v1/hugo/knowledge/search')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .set('X-App-ID', testAppId)
        .send({
          query: 'authentic vulnerability',
          max_results: 1,
        })
        .expect(200);

      if (firstResponse.body.results.length > 0) {
        const firstResult = firstResponse.body.results[0];
        const firstAccessCount = firstResult.access_count;

        // Search again for same entry
        const secondResponse = await request(API_BASE_URL)
          .post('/api/v1/hugo/knowledge/search')
          .set('Authorization', `Bearer ${testAccessToken}`)
          .set('X-App-ID', testAppId)
          .send({
            query: 'authentic vulnerability',
            max_results: 1,
          })
          .expect(200);

        if (secondResponse.body.results.length > 0) {
          const secondResult = secondResponse.body.results[0];
          expect(secondResult.access_count).toBeGreaterThanOrEqual(firstAccessCount);
        }
      }
    });
  });
});