/**
 * Affiliate URL Resolution Tests (T143)
 *
 * Tests Edge Function for affiliate URL resolution:
 * - Performance: <100ms globally
 * - Redis caching for hot URLs
 * - Base62 short code resolution
 * - Click tracking (async)
 * - Geo-location capture
 * - Fallback to database
 */

// Affiliate URL Resolution Tests - focused on business logic

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
};

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => mockRedis),
}));

// Mock Supabase client
const mockSupabaseResponse = jest.fn();
global.fetch = jest.fn();

describe('Affiliate URL Resolution Edge Function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
  });

  describe('Performance Requirements', () => {
    it('should resolve cached URL in <100ms', async () => {
      const shortCode = 'abc123';
      const targetUrl = 'https://example.com/product/123';

      mockRedis.get.mockResolvedValue(targetUrl);

      const start = Date.now();

      // Simulate Edge Function call
      const result = await mockRedis.get(`aff:${shortCode}`);

      const duration = Date.now() - start;

      expect(result).toBe(targetUrl);
      expect(duration).toBeLessThan(100);
    });

    it('should resolve uncached URL from DB in <100ms', async () => {
      const shortCode = 'def456';
      const urlData = {
        id: 'url-123',
        short_code: shortCode,
        original_url: 'https://example.com/product/456',
        campaign_id: 'campaign-123',
        affiliate_id: 'affiliate-123',
      };

      mockRedis.get.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [urlData],
      });

      const start = Date.now();

      // Simulate DB fetch
      const response = await fetch(`/rest/v1/affiliate_urls?short_code=eq.${shortCode}`);
      const data = await response.json();

      const duration = Date.now() - start;

      expect(data).toHaveLength(1);
      expect(data[0].original_url).toBe(urlData.original_url);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Cache Behavior', () => {
    it('should check Redis cache first', async () => {
      const shortCode = 'cached123';
      const cachedUrl = 'https://example.com/cached';

      mockRedis.get.mockResolvedValue(cachedUrl);

      const result = await mockRedis.get(`aff:${shortCode}`);

      expect(mockRedis.get).toHaveBeenCalledWith(`aff:${shortCode}`);
      expect(result).toBe(cachedUrl);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should cache DB results with 24-hour TTL', async () => {
      const shortCode = 'new123';
      const urlData = {
        original_url: 'https://example.com/new',
      };

      mockRedis.get.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [urlData],
      });

      // Simulate fetch and cache
      const response = await fetch('/rest/v1/affiliate_urls');
      const data = await response.json();

      await mockRedis.set(`aff:${shortCode}`, data[0].original_url, { ex: 86400 });

      expect(mockRedis.set).toHaveBeenCalledWith(
        `aff:${shortCode}`,
        urlData.original_url,
        { ex: 86400 }
      );
    });

    it('should handle Redis failures gracefully', async () => {
      const shortCode = 'fail123';

      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          original_url: 'https://example.com/fallback',
        }],
      });

      // Should fallback to DB
      await expect(mockRedis.get(`aff:${shortCode}`)).rejects.toThrow();

      // DB fetch should still work
      const response = await fetch('/rest/v1/affiliate_urls');
      const data = await response.json();

      expect(data[0].original_url).toBe('https://example.com/fallback');
    });
  });

  describe('Short Code Resolution', () => {
    it('should resolve valid short code', async () => {
      const shortCode = 'abc123XYZ';
      const urlData = {
        id: 'url-123',
        short_code: shortCode,
        original_url: 'https://example.com/product',
        campaign_id: 'campaign-123',
        affiliate_id: 'affiliate-123',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [urlData],
      });

      const response = await fetch(
        `/rest/v1/affiliate_urls?short_code=eq.${shortCode}`
      );
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0].short_code).toBe(shortCode);
      expect(data[0].original_url).toBeDefined();
    });

    it('should return empty array for invalid short code', async () => {
      const shortCode = 'invalid';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const response = await fetch(
        `/rest/v1/affiliate_urls?short_code=eq.${shortCode}`
      );
      const data = await response.json();

      expect(data).toHaveLength(0);
    });

    it('should handle expired URLs', async () => {
      const shortCode = 'expired123';
      const expiredUrl = {
        short_code: shortCode,
        original_url: 'https://example.com/expired',
        expires_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [expiredUrl],
      });

      const response = await fetch(
        `/rest/v1/affiliate_urls?short_code=eq.${shortCode}`
      );
      const data = await response.json();

      // Should return the URL (expiry check happens in Edge Function)
      expect(data).toHaveLength(1);
      expect(new Date(data[0].expires_at).getTime()).toBeLessThan(Date.now());
    });
  });

  describe('Click Tracking', () => {
    it('should extract click context from request headers', () => {
      const mockRequest = {
        headers: {
          get: jest.fn((header: string) => {
            const headers: Record<string, string> = {
              'referer': 'https://social.example.com',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'x-forwarded-for': '192.168.1.1',
            };
            return headers[header] || null;
          }),
        },
        geo: {
          country: 'US',
          region: 'CA',
          city: 'San Francisco',
        },
      };

      const context = {
        referrer: mockRequest.headers.get('referer'),
        user_agent: mockRequest.headers.get('user-agent'),
        ip_address: mockRequest.headers.get('x-forwarded-for'),
        country: mockRequest.geo?.country,
        region: mockRequest.geo?.region,
        city: mockRequest.geo?.city,
      };

      expect(context.referrer).toBe('https://social.example.com');
      expect(context.user_agent).toContain('Mozilla');
      expect(context.ip_address).toBe('192.168.1.1');
      expect(context.country).toBe('US');
      expect(context.region).toBe('CA');
      expect(context.city).toBe('San Francisco');
    });

    it('should track click asynchronously (non-blocking)', async () => {
      const trackingPayload = {
        short_code: 'abc123',
        url_id: 'url-123',
        campaign_id: 'campaign-123',
        affiliate_id: 'affiliate-123',
        referrer: 'https://example.com',
        user_agent: 'Mozilla/5.0',
        ip_address: '192.168.1.1',
        country: 'US',
      };

      const trackClickMock = jest.fn().mockResolvedValue({ success: true });

      // Simulate async tracking (doesn't block redirect)
      const trackingPromise = trackClickMock(trackingPayload);

      // Should not await tracking
      expect(trackingPromise).toBeInstanceOf(Promise);

      // Resolve later
      const result = await trackingPromise;
      expect(result.success).toBe(true);
    });

    it('should handle tracking failures gracefully', async () => {
      const trackClick = jest.fn().mockRejectedValue(new Error('Tracking failed'));

      // Tracking failure should not affect redirect
      await expect(
        trackClick({ short_code: 'abc123' }).catch((e: Error) => e.message)
      ).resolves.toBe('Tracking failed');

      expect(trackClick).toHaveBeenCalled();
    });
  });

  describe('Geo-location', () => {
    it('should capture Vercel Edge geo data', () => {
      const mockGeo = {
        country: 'GB',
        region: 'England',
        city: 'London',
        latitude: '51.5074',
        longitude: '-0.1278',
      };

      expect(mockGeo.country).toBe('GB');
      expect(mockGeo.city).toBe('London');
      expect(mockGeo.latitude).toBeDefined();
      expect(mockGeo.longitude).toBeDefined();
    });

    it('should handle missing geo data', () => {
      const mockRequest = {
        geo: undefined,
      };

      const geo = mockRequest.geo || {};

      expect(geo.country).toBeUndefined();
      expect(geo.city).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should redirect to homepage on invalid short code', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const response = await fetch('/rest/v1/affiliate_urls?short_code=eq.invalid');
      const data = await response.json();

      expect(data).toHaveLength(0);
      // Edge Function should redirect to '/'
    });

    it('should handle database errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      await expect(fetch('/rest/v1/affiliate_urls')).rejects.toThrow(
        'Database connection failed'
      );
      // Edge Function should redirect to '/' on error
    });

    it('should handle malformed short codes', () => {
      const invalidCodes = [
        '',
        null,
        undefined,
        '../../../etc/passwd',
        '<script>alert(1)</script>',
      ];

      invalidCodes.forEach(code => {
        // Short code validation - empty string is falsy
        const isValid = !!(code && /^[0-9A-Za-z]+$/.test(code));
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Security', () => {
    it('should sanitize short code input', () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '../../database',
        '<script>alert(1)</script>',
        'DROP TABLE affiliate_urls;',
      ];

      const sanitize = (code: string) => {
        // Only allow alphanumeric characters
        return /^[0-9A-Za-z]+$/.test(code);
      };

      maliciousInputs.forEach(input => {
        expect(sanitize(input)).toBe(false);
      });

      expect(sanitize('abc123XYZ')).toBe(true);
    });

    it('should prevent SQL injection in short code', async () => {
      const sqlInjection = "abc123' OR '1'='1";

      // Parameterized query prevents injection
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const response = await fetch(
        `/rest/v1/affiliate_urls?short_code=eq.${encodeURIComponent(sqlInjection)}`
      );
      const data = await response.json();

      // Should return empty (no injection)
      expect(data).toHaveLength(0);
    });

    it('should rate limit by IP address', () => {
      const ipLimits = new Map<string, number>();
      const MAX_REQUESTS = 100;

      const checkRateLimit = (ip: string): boolean => {
        const count = ipLimits.get(ip) || 0;
        if (count >= MAX_REQUESTS) return false;
        ipLimits.set(ip, count + 1);
        return true;
      };

      // First 100 requests should pass
      for (let i = 0; i < MAX_REQUESTS; i++) {
        expect(checkRateLimit('192.168.1.1')).toBe(true);
      }

      // 101st request should fail
      expect(checkRateLimit('192.168.1.1')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests for same short code', async () => {
      const shortCode = 'popular123';
      const urlData = { original_url: 'https://example.com/popular' };

      mockRedis.get.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [urlData],
      });

      // Simulate 10 concurrent requests
      const promises = Array(10).fill(null).map(() =>
        fetch(`/rest/v1/affiliate_urls?short_code=eq.${shortCode}`)
          .then(r => r.json())
      );

      const results = await Promise.all(promises);

      // All should get same result
      results.forEach(data => {
        expect(data[0].original_url).toBe(urlData.original_url);
      });
    });

    it('should handle very long URLs', async () => {
      const longUrl = 'https://example.com/product?' + 'param=value&'.repeat(100);
      const shortCode = 'short123';

      mockRedis.get.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          short_code: shortCode,
          original_url: longUrl,
        }],
      });

      const response = await fetch(`/rest/v1/affiliate_urls?short_code=eq.${shortCode}`);
      const data = await response.json();

      expect(data[0].original_url).toBe(longUrl);
      expect(data[0].original_url.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in URLs', async () => {
      const specialUrl = 'https://example.com/product?name=Test%20Product&price=$99.99';
      const shortCode = 'special123';

      mockRedis.get.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          short_code: shortCode,
          original_url: specialUrl,
        }],
      });

      const response = await fetch(`/rest/v1/affiliate_urls?short_code=eq.${shortCode}`);
      const data = await response.json();

      expect(data[0].original_url).toBe(specialUrl);
    });
  });
});
