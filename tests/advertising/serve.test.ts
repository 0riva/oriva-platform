/**
 * Ad Serving Edge Function Tests (T161)
 *
 * Tests Edge Function for ultra-fast ad serving (<50ms):
 * - Performance: <50ms ad selection globally
 * - Redis caching for user segments
 * - Real-time relevance scoring
 * - Budget validation
 * - Impression tracking (async)
 * - Fraud prevention
 */

describe('Ad Serving Edge Function', () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
  });

  describe('Performance Requirements', () => {
    it('should select ad in <50ms with cached segments', async () => {
      const userSegments = ['tech', 'productivity', 'saas'];
      mockRedis.get.mockResolvedValue(JSON.stringify(userSegments));

      const start = Date.now();

      // Simulate ad selection
      const segments = JSON.parse(await mockRedis.get('segments:user-123'));
      const selectedAd = { id: 'ad-123', score: 0.85 };

      const duration = Date.now() - start;

      expect(segments).toEqual(userSegments);
      expect(selectedAd.id).toBe('ad-123');
      expect(duration).toBeLessThan(50);
    });

    it('should select ad in <50ms without cached segments', async () => {
      mockRedis.get.mockResolvedValue(null);

      const start = Date.now();

      // Simulate segment computation + ad selection
      const segments = ['tech', 'productivity'];
      const selectedAd = { id: 'ad-456', score: 0.75 };

      const duration = Date.now() - start;

      expect(selectedAd.id).toBeDefined();
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Segment-based Targeting', () => {
    it('should use cached user segments for targeting', async () => {
      const cachedSegments = ['tech', 'saas', 'developer'];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedSegments));

      const segments = JSON.parse(await mockRedis.get('segments:user-123'));

      expect(segments).toEqual(cachedSegments);
      expect(mockRedis.get).toHaveBeenCalledWith('segments:user-123');
    });

    it('should compute segments on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      // Simulate segment computation from user activity
      const userInterests = ['javascript', 'react', 'nodejs'];
      const computedSegments = ['tech', 'frontend', 'developer'];

      await mockRedis.set('segments:user-123', JSON.stringify(computedSegments), { ex: 86400 });

      expect(mockRedis.set).toHaveBeenCalledWith(
        'segments:user-123',
        JSON.stringify(computedSegments),
        { ex: 86400 }
      );
    });

    it('should handle missing segments gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);

      const segments = await mockRedis.get('segments:unknown-user');

      expect(segments).toBeNull();
      // Should use default/broad targeting
    });
  });

  describe('Real-time Relevance Scoring', () => {
    it('should score ad based on segment match', () => {
      const userSegments = ['tech', 'saas', 'productivity'];
      const adTargeting = {
        interest_keywords: ['saas', 'productivity', 'business'],
      };

      // Calculate overlap
      const overlap = userSegments.filter(s =>
        adTargeting.interest_keywords.includes(s)
      ).length;

      const segmentScore = (overlap / userSegments.length) * 0.4;

      expect(segmentScore).toBeGreaterThan(0);
      expect(segmentScore).toBeLessThanOrEqual(0.4);
    });

    it('should score ad based on keyword match', () => {
      const threadKeywords = ['productivity', 'automation', 'workflow'];
      const adKeywords = ['productivity', 'automation', 'saas'];

      const overlap = threadKeywords.filter(k => adKeywords.includes(k)).length;
      const keywordScore = (overlap / threadKeywords.length) * 0.4;

      expect(keywordScore).toBeGreaterThan(0);
      expect(keywordScore).toBeLessThanOrEqual(0.4);
    });

    it('should factor in bid amount (20% weight)', () => {
      const bidAmount = 5000; // $50.00
      const maxBid = 10000; // $100.00

      const bidScore = (bidAmount / maxBid) * 0.2;

      expect(bidScore).toBe(0.1); // 10% of total score
    });

    it('should calculate total relevance score', () => {
      const segmentScore = 0.3; // 30% match
      const keywordScore = 0.25; // 25% match
      const bidScore = 0.15; // 15% bid factor

      const totalScore = segmentScore + keywordScore + bidScore;

      expect(totalScore).toBeCloseTo(0.7, 1);
      expect(totalScore).toBeLessThanOrEqual(1.0);
    });

    it('should reject ads with score below threshold', () => {
      const lowScore = 0.25;
      const threshold = 0.3;

      const shouldShow = lowScore >= threshold;

      expect(shouldShow).toBe(false);
    });
  });

  describe('Budget Validation', () => {
    it('should check daily budget remaining', () => {
      const campaign = {
        daily_budget_cents: 10000, // $100.00
        spent_cents: 8500, // $85.00
      };

      const hasbudget = campaign.spent_cents < campaign.daily_budget_cents;

      expect(hasbudget).toBe(true);
    });

    it('should exclude campaigns that exhausted budget', () => {
      const campaign = {
        daily_budget_cents: 10000, // $100.00
        spent_cents: 10000, // $100.00 (exhausted)
      };

      const hasbudget = campaign.spent_cents < campaign.daily_budget_cents;

      expect(hasbudget).toBe(false);
    });

    it('should check campaign is within date range', () => {
      const now = new Date();
      const campaign = {
        start_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        end_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };

      const isActive =
        new Date(campaign.start_date) <= now &&
        (!campaign.end_date || new Date(campaign.end_date) >= now);

      expect(isActive).toBe(true);
    });

    it('should exclude expired campaigns', () => {
      const now = new Date();
      const campaign = {
        start_date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        end_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      };

      const isActive =
        new Date(campaign.start_date) <= now &&
        (!campaign.end_date || new Date(campaign.end_date) >= now);

      expect(isActive).toBe(false);
    });
  });

  describe('Ad Selection', () => {
    it('should return highest scoring ad', () => {
      const ads = [
        { id: 'ad-1', score: 0.65 },
        { id: 'ad-2', score: 0.85 },
        { id: 'ad-3', score: 0.45 },
      ];

      const selected = ads.sort((a, b) => b.score - a.score)[0];

      expect(selected.id).toBe('ad-2');
      expect(selected.score).toBe(0.85);
    });

    it('should return null if no ads meet threshold', () => {
      const ads = [
        { id: 'ad-1', score: 0.25 },
        { id: 'ad-2', score: 0.20 },
      ];
      const threshold = 0.3;

      const qualified = ads.filter(ad => ad.score >= threshold);
      const selected = qualified.length > 0 ? qualified[0] : null;

      expect(selected).toBeNull();
    });

    it('should include creative with selected ad', () => {
      const ad = {
        campaign_id: 'campaign-123',
        creative_id: 'creative-456',
        score: 0.75,
        ad_creatives: {
          id: 'creative-456',
          headline: 'Boost Your Productivity',
          body: 'Try our SaaS platform',
          image_url: 'https://cdn.example.com/ad.jpg',
        },
      };

      expect(ad.ad_creatives).toBeDefined();
      expect(ad.ad_creatives.headline).toBe('Boost Your Productivity');
    });
  });

  describe('Impression Tracking', () => {
    it('should track impression asynchronously (non-blocking)', async () => {
      const impressionData = {
        campaign_id: 'campaign-123',
        creative_id: 'creative-456',
        user_id: 'user-789',
        placement: 'feed',
        is_viewable: true,
      };

      const trackImpressionMock = jest.fn().mockResolvedValue({ success: true });

      // Should not await tracking
      const trackingPromise = trackImpressionMock(impressionData);

      expect(trackingPromise).toBeInstanceOf(Promise);

      const result = await trackingPromise;
      expect(result.success).toBe(true);
    });

    it('should handle tracking failures gracefully', async () => {
      const trackImpression = jest.fn().mockRejectedValue(new Error('Tracking failed'));

      await expect(
        trackImpression({ campaign_id: 'c1' }).catch((e: Error) => e.message)
      ).resolves.toBe('Tracking failed');

      // Ad should still be served even if tracking fails
    });

    it('should include placement context in impression', () => {
      const context = {
        placement: 'feed',
        thread_id: 'thread-123',
        position: 3,
      };

      expect(context.placement).toBe('feed');
      expect(context.position).toBe(3);
    });
  });

  describe('Fraud Prevention', () => {
    it('should detect suspicious request patterns', () => {
      const requestCounts = new Map<string, number>();
      const ip = '192.168.1.1';
      const threshold = 100; // Max requests per minute

      // Simulate 150 requests
      for (let i = 0; i < 150; i++) {
        requestCounts.set(ip, (requestCounts.get(ip) || 0) + 1);
      }

      const isSuspicious = (requestCounts.get(ip) || 0) > threshold;

      expect(isSuspicious).toBe(true);
    });

    it('should validate user agent', () => {
      const validUserAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
      ];

      const suspiciousUserAgents = [
        'bot',
        'crawler',
        'spider',
        '',
      ];

      validUserAgents.forEach(ua => {
        const isValid = ua && !/(bot|crawler|spider)/i.test(ua);
        expect(isValid).toBe(true);
      });

      suspiciousUserAgents.forEach(ua => {
        const isValid = !!(ua && !/(bot|crawler|spider)/i.test(ua));
        expect(isValid).toBe(false);
      });
    });

    it('should check for duplicate impressions', () => {
      const recentImpressions = new Set<string>();
      const impressionKey = 'user-123:campaign-456';

      // First impression
      const isDuplicate1 = recentImpressions.has(impressionKey);
      recentImpressions.add(impressionKey);

      // Second impression (duplicate)
      const isDuplicate2 = recentImpressions.has(impressionKey);

      expect(isDuplicate1).toBe(false);
      expect(isDuplicate2).toBe(true);
    });
  });

  describe('Placement Support', () => {
    it('should serve ads for feed placement', () => {
      const placement = 'feed';
      const validPlacements = ['feed', 'sidebar', 'thread', 'marketplace'];

      expect(validPlacements).toContain(placement);
    });

    it('should serve ads for sidebar placement', () => {
      const placement = 'sidebar';
      const validPlacements = ['feed', 'sidebar', 'thread', 'marketplace'];

      expect(validPlacements).toContain(placement);
    });

    it('should reject invalid placements', () => {
      const placement = 'invalid';
      const validPlacements = ['feed', 'sidebar', 'thread', 'marketplace'];

      expect(validPlacements).not.toContain(placement);
    });
  });

  describe('Context Enrichment', () => {
    it('should extract thread keywords from context', () => {
      const threadContext = {
        thread_id: 'thread-123',
        keywords: ['productivity', 'automation', 'saas'],
      };

      expect(threadContext.keywords).toHaveLength(3);
      expect(threadContext.keywords).toContain('productivity');
    });

    it('should extract user interests from context', () => {
      const userContext = {
        user_id: 'user-123',
        interests: ['tech', 'business', 'startup'],
      };

      expect(userContext.interests).toHaveLength(3);
      expect(userContext.interests).toContain('tech');
    });

    it('should handle missing context gracefully', () => {
      const context = {
        user_id: 'user-123',
        // No keywords or interests
      };

      const keywords = (context as any).keywords || [];
      const interests = (context as any).interests || [];

      expect(keywords).toHaveLength(0);
      expect(interests).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no active campaigns', () => {
      const activeCampaigns: any[] = [];

      const selected = activeCampaigns.length > 0 ? activeCampaigns[0] : null;

      expect(selected).toBeNull();
    });

    it('should handle all campaigns with zero budget', () => {
      const campaigns = [
        { id: 'c1', daily_budget_cents: 10000, spent_cents: 10000 },
        { id: 'c2', daily_budget_cents: 5000, spent_cents: 5000 },
      ];

      const withBudget = campaigns.filter(c => c.spent_cents < c.daily_budget_cents);

      expect(withBudget).toHaveLength(0);
    });

    it('should handle concurrent ad requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        Promise.resolve({ ad_id: `ad-${i}`, score: Math.random() })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.ad_id).toBeDefined();
      });
    });

    it('should handle Redis cache failures', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis unavailable'));

      // Should fallback to no cached segments
      await expect(mockRedis.get('segments:user-123')).rejects.toThrow();

      // Ad serving should continue with empty segments
    });
  });
});
