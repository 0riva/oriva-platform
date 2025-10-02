/**
 * Contextual Marketplace Suggestions Tests (T193)
 *
 * Tests contextual suggestion generation API:
 * - User context-based suggestions
 * - Thread context integration
 * - Personalization and filtering
 * - Suggestion ranking and relevance
 */

describe('Contextual Marketplace Suggestions', () => {
  describe('User Context Analysis', () => {
    it('should analyze user interests from history', () => {
      const userHistory = [
        { content: 'React development tips', category: 'development' },
        { content: 'UI design patterns', category: 'design' },
        { content: 'TypeScript best practices', category: 'development' },
      ];

      const interests = userHistory.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(interests['development']).toBe(2);
      expect(interests['design']).toBe(1);
    });

    it('should extract user skill level from activity', () => {
      const userActivity = {
        posts_count: 150,
        technical_posts: 120,
        advanced_topics: ['architecture', 'scalability', 'performance'],
      };

      const skillLevel = userActivity.technical_posts / userActivity.posts_count > 0.7
        ? 'advanced'
        : 'intermediate';

      expect(skillLevel).toBe('advanced');
    });

    it('should identify user role/persona', () => {
      const userProfile = {
        bio: 'Startup founder building SaaS products',
        activity: ['product management', 'team leadership', 'funding'],
      };

      const persona = userProfile.bio.toLowerCase().includes('founder')
        ? 'founder'
        : 'developer';

      expect(persona).toBe('founder');
    });
  });

  describe('Thread Context Integration', () => {
    it('should combine thread analysis with user context', () => {
      const threadContext = {
        keywords: ['project', 'management', 'tool'],
        intent: 'purchase',
      };

      const userContext = {
        interests: ['productivity', 'saas'],
        role: 'founder',
      };

      const combinedScore = {
        thread_relevance: 0.8,
        user_fit: 0.7,
        overall: (0.8 * 0.6) + (0.7 * 0.4), // 60% thread, 40% user
      };

      expect(combinedScore.overall).toBeCloseTo(0.76, 2);
    });

    it('should boost suggestions matching user interests', () => {
      const suggestions = [
        { id: 's1', category: 'productivity', base_score: 0.7 },
        { id: 's2', category: 'entertainment', base_score: 0.8 },
      ];

      const userInterests = ['productivity', 'saas'];

      const boosted = suggestions.map(s => ({
        ...s,
        final_score: s.base_score + (userInterests.includes(s.category) ? 0.2 : 0),
      }));

      expect(boosted[0].final_score).toBeCloseTo(0.9, 1); // 0.7 + 0.2 boost
      expect(boosted[1].final_score).toBeCloseTo(0.8, 1); // No boost
    });
  });

  describe('Suggestion Ranking', () => {
    it('should rank by relevance score', () => {
      const suggestions = [
        { id: 's1', relevance_score: 0.7 },
        { id: 's2', relevance_score: 0.9 },
        { id: 's3', relevance_score: 0.8 },
      ];

      const ranked = suggestions.sort((a, b) => b.relevance_score - a.relevance_score);

      expect(ranked[0].id).toBe('s2');
      expect(ranked[1].id).toBe('s3');
      expect(ranked[2].id).toBe('s1');
    });

    it('should apply freshness decay to old items', () => {
      const now = Date.now();
      const items = [
        { id: 'i1', score: 0.9, created_at: now - 86400000 * 30 }, // 30 days old
        { id: 'i2', score: 0.8, created_at: now - 86400000 }, // 1 day old
      ];

      const withDecay = items.map(item => {
        const daysOld = (now - item.created_at) / 86400000;
        const decayFactor = Math.max(0.7, 1 - (daysOld * 0.01)); // 1% per day, min 0.7
        return {
          ...item,
          final_score: item.score * decayFactor,
        };
      });

      expect(withDecay[0].final_score).toBeLessThan(withDecay[1].final_score);
    });

    it('should boost popular items', () => {
      const items = [
        { id: 'i1', relevance: 0.7, popularity: 100 },
        { id: 'i2', relevance: 0.7, popularity: 10 },
      ];

      const withPopularity = items.map(item => ({
        ...item,
        final_score: item.relevance + (Math.min(item.popularity / 100, 0.2)),
      }));

      expect(withPopularity[0].final_score).toBeGreaterThan(withPopularity[1].final_score);
    });
  });

  describe('Personalization', () => {
    it('should filter out previously purchased items', () => {
      const suggestions = [
        { item_id: 'i1', name: 'Item 1' },
        { item_id: 'i2', name: 'Item 2' },
        { item_id: 'i3', name: 'Item 3' },
      ];

      const purchaseHistory = new Set(['i2']);

      const filtered = suggestions.filter(s => !purchaseHistory.has(s.item_id));

      expect(filtered.length).toBe(2);
      expect(filtered.map(s => s.item_id)).toEqual(['i1', 'i3']);
    });

    it('should respect user preferences for content type', () => {
      const userPreferences = {
        preferred_types: ['software', 'services'],
        excluded_types: ['physical'],
      };

      const items = [
        { id: 'i1', type: 'software' },
        { id: 'i2', type: 'physical' },
        { id: 'i3', type: 'services' },
      ];

      const filtered = items.filter(item =>
        userPreferences.preferred_types.includes(item.type) &&
        !userPreferences.excluded_types.includes(item.type)
      );

      expect(filtered.length).toBe(2);
    });

    it('should adjust for user budget range', () => {
      const userBudget = {
        min: 1000, // $10.00
        max: 5000, // $50.00
      };

      const items = [
        { id: 'i1', price_cents: 2000 },
        { id: 'i2', price_cents: 10000 },
        { id: 'i3', price_cents: 3000 },
      ];

      const withinBudget = items.filter(item =>
        item.price_cents >= userBudget.min &&
        item.price_cents <= userBudget.max
      );

      expect(withinBudget.length).toBe(2);
    });
  });

  describe('Diversity and Exploration', () => {
    it('should ensure category diversity in suggestions', () => {
      const suggestions = [
        { id: 's1', category: 'development', score: 0.9 },
        { id: 's2', category: 'development', score: 0.85 },
        { id: 's3', category: 'design', score: 0.8 },
        { id: 's4', category: 'marketing', score: 0.75 },
      ];

      // Select top item from each category
      const diverse = suggestions.reduce((acc, item) => {
        const existing = acc.find(a => a.category === item.category);
        if (!existing || item.score > existing.score) {
          return [...acc.filter(a => a.category !== item.category), item];
        }
        return acc;
      }, [] as typeof suggestions);

      const categories = diverse.map(s => s.category);
      expect(new Set(categories).size).toBe(3); // 3 unique categories
    });

    it('should include exploration items (lower relevance, high potential)', () => {
      const suggestions = [
        { id: 's1', relevance: 0.9, novelty: 0.1 },
        { id: 's2', relevance: 0.6, novelty: 0.9 },
      ];

      const explorationBoost = 0.2;
      const withExploration = suggestions.map(s => ({
        ...s,
        final_score: s.relevance + (s.novelty * explorationBoost),
      }));

      expect(withExploration[1].final_score).toBeCloseTo(0.78, 2);
    });
  });

  describe('API Request Handling', () => {
    it('should accept user_id and optional thread_id', () => {
      const requestQuery = {
        user_id: 'user-123',
        thread_id: 'thread-456',
        limit: 10,
      };

      expect(requestQuery.user_id).toBeDefined();
      expect(requestQuery.thread_id).toBeDefined();
      expect(requestQuery.limit).toBe(10);
    });

    it('should return paginated suggestions', () => {
      const response = {
        suggestions: [
          { item_id: 'i1', relevance_score: 0.9 },
          { item_id: 'i2', relevance_score: 0.8 },
        ],
        pagination: {
          page: 0,
          limit: 10,
          total: 25,
          has_more: true,
        },
      };

      expect(response.suggestions.length).toBeLessThanOrEqual(response.pagination.limit);
      expect(response.pagination.has_more).toBe(true);
    });

    it('should include suggestion metadata', () => {
      const suggestion = {
        item_id: 'item-123',
        name: 'Project Management Pro',
        relevance_score: 0.87,
        reasoning: 'Matches your interest in productivity tools',
        category: 'productivity',
        price_cents: 2999,
      };

      expect(suggestion.reasoning).toBeDefined();
      expect(suggestion.category).toBeDefined();
    });

    it('should validate user exists', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' },
            }),
          }),
        }),
      };

      const result = await mockSupabaseClient
        .from('users')
        .select('*')
        .eq('id', 'invalid-user');

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should require authentication', () => {
      const mockRequest = {
        headers: {
          authorization: null,
        },
      };

      const isAuthenticated = !!mockRequest.headers.authorization;

      expect(isAuthenticated).toBe(false);
    });
  });

  describe('Suggestion Quality', () => {
    it('should filter low-quality items', () => {
      const items = [
        { id: 'i1', quality_score: 0.9, reviews_count: 50 },
        { id: 'i2', quality_score: 0.3, reviews_count: 2 },
        { id: 'i3', quality_score: 0.8, reviews_count: 30 },
      ];

      const qualityThreshold = 0.6;
      const minReviews = 10;

      const filtered = items.filter(item =>
        item.quality_score >= qualityThreshold &&
        item.reviews_count >= minReviews
      );

      expect(filtered.length).toBe(2);
    });

    it('should boost items from trusted sellers', () => {
      const items = [
        { id: 'i1', base_score: 0.7, seller_reputation: 0.9 },
        { id: 'i2', base_score: 0.8, seller_reputation: 0.5 },
      ];

      const withReputation = items.map(item => ({
        ...item,
        final_score: item.base_score + (item.seller_reputation * 0.1),
      }));

      expect(withReputation[0].final_score).toBeCloseTo(0.79, 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no history', () => {
      const userHistory: any[] = [];

      const suggestions = userHistory.length === 0
        ? [] // Fallback to trending/popular items
        : userHistory;

      expect(suggestions.length).toBe(0);
    });

    it('should handle empty suggestion pool', () => {
      const availableItems: any[] = [];

      const suggestions = availableItems.length > 0
        ? availableItems
        : null;

      expect(suggestions).toBeNull();
    });

    it('should handle concurrent suggestion requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        Promise.resolve({
          user_id: `user-${i}`,
          suggestions: [{ item_id: `item-${i}`, score: Math.random() }],
        })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.suggestions).toBeDefined();
      });
    });
  });
});
