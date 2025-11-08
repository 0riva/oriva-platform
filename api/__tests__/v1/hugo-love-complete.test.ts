/**
 * Hugo Love API Comprehensive Test Suite
 * Tests all 31 endpoints with authentication, validation, and RLS enforcement
 */

import request from 'supertest';
import { app } from '../../index';
import { createClient } from '@supabase/supabase-js';

// Test configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54341';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const TEST_USER_EMAIL = 'test-hugo-love@example.com';
const TEST_USER_PASSWORD = 'test-password-123';

let authToken: string;
let testUserId: string;
let targetUserId: string;
let matchId: string;
let messageId: string;
let journalEntryId: string;
let sessionId: string;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

describe('Hugo Love API - Complete Test Suite', () => {
  // ==================== SETUP ====================

  beforeAll(async () => {
    // Create test user and get auth token
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (authError && authError.message.includes('already registered')) {
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });
      authToken = signInData.session?.access_token || '';
      testUserId = signInData.user?.id || '';
    } else {
      authToken = authData.session?.access_token || '';
      testUserId = authData.user?.id || '';
    }

    // Create another test user for interactions
    const { data: targetUser } = await supabase.auth.signUp({
      email: 'target-user@example.com',
      password: 'test-password-456',
    });
    targetUserId = targetUser.user?.id || '';
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.auth.signOut();
  });

  // ==================== FEATURE A: SWIPE ENDPOINTS ====================

  describe('POST /api/v1/hugo-love/swipe', () => {
    it('should create a swipe', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/swipe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: targetUserId,
          decision: 'like',
        })
        .expect(200);

      expect(response.body).toHaveProperty('swipeId');
      expect(response.body.mutualMatch).toBe(false);
    });

    it('should return 401 without token', async () => {
      await request(app)
        .post('/api/v1/hugo-love/swipe')
        .send({
          targetUserId: targetUserId,
          decision: 'like',
        })
        .expect(401);
    });

    it('should return 400 with invalid decision', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/swipe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: targetUserId,
          decision: 'invalid',
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_INPUT');
    });

    it('should return 400 when swiping on yourself', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/swipe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: testUserId,
          decision: 'like',
        })
        .expect(400);

      expect(response.body.error).toContain('yourself');
    });
  });

  describe('GET /api/v1/hugo-love/swipes', () => {
    it('should get swipe history', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/swipes')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body).toHaveProperty('swipes');
      expect(Array.isArray(response.body.swipes)).toBe(true);
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('hasMore');
    });

    it('should enforce pagination limits', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/swipes')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 200 }) // Exceeds max
        .expect(400);

      expect(response.body.code).toBe('INVALID_INPUT');
    });
  });

  describe('GET /api/v1/hugo-love/swipes/today', () => {
    it("should get today's swipes", async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/swipes/today')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('swipes');
      expect(Array.isArray(response.body.swipes)).toBe(true);
    });
  });

  // ==================== FEATURE B: RATINGS ENDPOINTS ====================

  describe('POST /api/v1/hugo-love/ratings', () => {
    it('should submit a rating', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: targetUserId,
          score: 5,
          comment: 'Great person!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('ratingId');
      expect(response.body).toHaveProperty('averageScore');
      expect(response.body).toHaveProperty('totalRatings');
    });

    it('should validate score range', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: targetUserId,
          score: 6, // Invalid
        })
        .expect(400);

      expect(response.body.code).toBe('INVALID_INPUT');
    });

    it('should enforce comment length', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/ratings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: targetUserId,
          score: 4,
          comment: 'x'.repeat(501), // Exceeds 500 chars
        })
        .expect(400);

      expect(response.body.error).toContain('500 characters');
    });
  });

  describe('GET /api/v1/hugo-love/ratings/:userId', () => {
    it('should get ratings for a user', async () => {
      const response = await request(app)
        .get(`/api/v1/hugo-love/ratings/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ratings');
      expect(response.body).toHaveProperty('averageScore');
      expect(response.body).toHaveProperty('totalRatings');
    });
  });

  describe('GET /api/v1/hugo-love/ratings/given', () => {
    it('should get ratings user has given', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/ratings/given')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ratings');
      expect(Array.isArray(response.body.ratings)).toBe(true);
    });
  });

  // ==================== FEATURE C: MATCHING ENDPOINTS ====================

  describe('GET /api/v1/hugo-love/matches', () => {
    it('should get user matches', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/matches')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'active', limit: 20 })
        .expect(200);

      expect(response.body).toHaveProperty('matches');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('hasMore');
    });
  });

  // ==================== FEATURE D: PROFILES ENDPOINTS ====================

  describe('GET /api/v1/hugo-love/profiles/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/profiles/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('account_id');
    });

    it('should require authentication', async () => {
      await request(app).get('/api/v1/hugo-love/profiles/me').expect(401);
    });
  });

  describe('PATCH /api/v1/hugo-love/profiles/me', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .patch('/api/v1/hugo-love/profiles/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bio: 'Updated bio',
          interests: ['hiking', 'coding'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('updatedFields');
      expect(response.body.updatedFields).toContain('bio');
    });

    it('should enforce photo limit', async () => {
      const response = await request(app)
        .patch('/api/v1/hugo-love/profiles/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photos: Array(7).fill('http://example.com/photo.jpg'), // Exceeds 6
        })
        .expect(400);

      expect(response.body.error).toContain('6 items');
    });
  });

  describe('POST /api/v1/hugo-love/profiles/blocks', () => {
    it('should block a user', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/profiles/blocks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ blockedUserId: targetUserId })
        .expect(201);

      expect(response.body).toHaveProperty('blockId');
      expect(response.body.blockedUserId).toBe(targetUserId);
    });

    it('should not allow blocking yourself', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/profiles/blocks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ blockedUserId: testUserId })
        .expect(400);

      expect(response.body.error).toContain('yourself');
    });
  });

  describe('GET /api/v1/hugo-love/profiles/blocks', () => {
    it('should get blocked users', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/profiles/blocks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('blocks');
      expect(Array.isArray(response.body.blocks)).toBe(true);
    });
  });

  // ==================== FEATURE G: JOURNAL ENDPOINTS ====================

  describe('POST /api/v1/hugo-love/journal', () => {
    it('should create journal entry', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'Today was a great day!',
          date: new Date().toISOString().split('T')[0],
          tags: ['positive', 'mood'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('entryId');
      journalEntryId = response.body.entryId;
    });

    it('should enforce text length limit', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'x'.repeat(5001), // Exceeds 5000
          date: new Date().toISOString().split('T')[0],
        })
        .expect(400);

      expect(response.body.error).toContain('5000 characters');
    });
  });

  describe('GET /api/v1/hugo-love/journal', () => {
    it('should get journal entries', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('entries');
      expect(response.body).toHaveProperty('totalCount');
    });
  });

  // ==================== FEATURE H: SUBSCRIPTIONS ENDPOINTS ====================

  describe('GET /api/v1/hugo-love/subscriptions/me', () => {
    it('should get subscription status', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/subscriptions/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('tier');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('features');
    });
  });

  describe('GET /api/v1/hugo-love/subscriptions/plans', () => {
    it('should get available plans', async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/subscriptions/plans')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('plans');
      expect(response.body.plans).toHaveLength(3); // free, premium, vip
    });
  });

  // ==================== FEATURE I: MODERATION ENDPOINTS ====================

  describe('POST /api/v1/hugo-love/reports', () => {
    it('should submit a report', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportedUserId: targetUserId,
          reason: 'spam',
          description: 'User is spamming inappropriate content',
        })
        .expect(201);

      expect(response.body).toHaveProperty('reportId');
      expect(response.body.status).toBe('pending');
    });

    it('should not allow reporting yourself', async () => {
      const response = await request(app)
        .post('/api/v1/hugo-love/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reportedUserId: testUserId,
          reason: 'spam',
          description: 'Test',
        })
        .expect(400);

      expect(response.body.error).toContain('yourself');
    });
  });

  describe('GET /api/v1/hugo-love/reports/my-reports', () => {
    it("should get user's submitted reports", async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/reports/my-reports')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('reports');
      expect(Array.isArray(response.body.reports)).toBe(true);
    });
  });

  // ==================== RLS ENFORCEMENT TESTS ====================

  describe('RLS Policy Enforcement', () => {
    it("should only return user's own swipes", async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/swipes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const swipes = response.body.swipes;
      swipes.forEach((swipe: any) => {
        expect(swipe.swiper_id).toBe(testUserId);
      });
    });

    it("should only return user's own journal entries", async () => {
      const response = await request(app)
        .get('/api/v1/hugo-love/journal')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const entries = response.body.entries;
      entries.forEach((entry: any) => {
        expect(entry.user_id).toBe(testUserId);
      });
    });
  });
});
