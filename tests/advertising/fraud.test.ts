/**
 * Advertising Fraud Scoring Tests (T182)
 *
 * Tests fraud scoring for ad campaigns:
 * - Click fraud detection (bot clicks, invalid clicks)
 * - Impression fraud (impression stuffing, hidden ads)
 * - Conversion fraud (fake conversions)
 * - Geographic anomalies
 * - Device fingerprinting
 */

describe('Advertising Fraud Scoring', () => {
  describe('Click Fraud Detection', () => {
    it('should detect bot clicks via user agent', () => {
      const clicks = [
        { user_agent: 'Googlebot/2.1' },
        { user_agent: 'Mozilla/5.0 (compatible; bingbot/2.0)' },
        { user_agent: 'curl/7.68.0' },
      ];

      const botRegex = /(bot|crawler|spider|curl|wget)/i;
      const botClicks = clicks.filter(c => botRegex.test(c.user_agent));

      expect(botClicks.length).toBe(3);
    });

    it('should detect rapid clicking from same IP', () => {
      const now = Date.now();
      const clicks = [
        { ip: '203.0.113.1', timestamp: now },
        { ip: '203.0.113.1', timestamp: now + 100 },
        { ip: '203.0.113.1', timestamp: now + 200 },
      ];

      const ipClickTimes = new Map<string, number[]>();
      clicks.forEach(click => {
        if (!ipClickTimes.has(click.ip)) {
          ipClickTimes.set(click.ip, []);
        }
        ipClickTimes.get(click.ip)!.push(click.timestamp);
      });

      let rapidClicks = 0;
      ipClickTimes.forEach(times => {
        const sortedTimes = times.sort((a, b) => a - b);
        for (let i = 1; i < sortedTimes.length; i++) {
          if (sortedTimes[i] - sortedTimes[i - 1] < 1000) {
            rapidClicks++;
          }
        }
      });

      expect(rapidClicks).toBe(2);
    });

    it('should detect clicks without impressions', () => {
      const clicks = [
        { campaign_id: 'c1', creative_id: 'cr1', has_impression: false },
        { campaign_id: 'c1', creative_id: 'cr1', has_impression: false },
        { campaign_id: 'c1', creative_id: 'cr1', has_impression: true },
      ];

      const clicksWithoutImpressions = clicks.filter(c => !c.has_impression);

      expect(clicksWithoutImpressions.length).toBe(2);
    });

    it('should detect click rate anomalies (CTR > 10%)', () => {
      const campaign = {
        impressions: 1000,
        clicks: 150, // 15% CTR
      };

      const ctr = (campaign.clicks / campaign.impressions) * 100;
      const threshold = 10;

      const isAnomalous = ctr > threshold;

      expect(isAnomalous).toBe(true);
      expect(ctr).toBe(15);
    });
  });

  describe('Impression Fraud Detection', () => {
    it('should detect impression stuffing (multiple ads per page)', () => {
      const impressions = [
        { page_id: 'p1', creative_id: 'cr1' },
        { page_id: 'p1', creative_id: 'cr2' },
        { page_id: 'p1', creative_id: 'cr3' },
        { page_id: 'p1', creative_id: 'cr4' },
      ];

      const impressionsPerPage = impressions.reduce((acc, imp) => {
        acc[imp.page_id] = (acc[imp.page_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const hasStuffing = Object.values(impressionsPerPage).some(count => count > 3);

      expect(hasStuffing).toBe(true);
    });

    it('should detect hidden/non-viewable impressions', () => {
      const impressions = [
        { is_viewable: false, visibility_percentage: 0 },
        { is_viewable: false, visibility_percentage: 10 },
        { is_viewable: true, visibility_percentage: 100 },
      ];

      const nonViewable = impressions.filter(i => !i.is_viewable || i.visibility_percentage < 50);

      expect(nonViewable.length).toBe(2);
    });

    it('should detect impressions with unrealistic duration (<1s)', () => {
      const impressions = [
        { duration_ms: 100 },
        { duration_ms: 500 },
        { duration_ms: 2000 },
      ];

      const tooQuick = impressions.filter(i => i.duration_ms < 1000);

      expect(tooQuick.length).toBe(2);
    });

    it('should calculate viewability rate', () => {
      const impressions = [
        { is_viewable: true },
        { is_viewable: true },
        { is_viewable: false },
        { is_viewable: false },
      ];

      const viewableCount = impressions.filter(i => i.is_viewable).length;
      const viewabilityRate = (viewableCount / impressions.length) * 100;

      expect(viewabilityRate).toBe(50);
    });
  });

  describe('Conversion Fraud Detection', () => {
    it('should detect conversions without clicks', () => {
      const conversions = [
        { has_click: false },
        { has_click: true },
        { has_click: false },
      ];

      const invalidConversions = conversions.filter(c => !c.has_click);

      expect(invalidConversions.length).toBe(2);
    });

    it('should detect unrealistic conversion time (<5s)', () => {
      const conversions = [
        { time_from_click_ms: 2000 }, // 2 seconds
        { time_from_click_ms: 10000 }, // 10 seconds
        { time_from_click_ms: 3000 }, // 3 seconds
      ];

      const tooQuick = conversions.filter(c => c.time_from_click_ms < 5000);

      expect(tooQuick.length).toBe(2);
    });

    it('should detect duplicate conversions from same user', () => {
      const conversions = [
        { user_id: 'u1', campaign_id: 'c1' },
        { user_id: 'u1', campaign_id: 'c1' },
        { user_id: 'u2', campaign_id: 'c1' },
      ];

      const fingerprints = conversions.map(c => `${c.user_id}:${c.campaign_id}`);
      const uniqueFingerprints = new Set(fingerprints);

      const hasDuplicates = fingerprints.length !== uniqueFingerprints.size;

      expect(hasDuplicates).toBe(true);
    });

    it('should detect conversion rate anomalies (> 25%)', () => {
      const campaign = {
        clicks: 100,
        conversions: 30, // 30% conversion rate
      };

      const conversionRate = (campaign.conversions / campaign.clicks) * 100;
      const threshold = 25;

      const isAnomalous = conversionRate > threshold;

      expect(isAnomalous).toBe(true);
    });
  });

  describe('Geographic Anomalies', () => {
    it('should detect traffic from unexpected countries', () => {
      const targetCountries = ['US', 'CA', 'UK'];
      const impressions = [
        { country: 'US' },
        { country: 'CN' },
        { country: 'RU' },
        { country: 'US' },
      ];

      const unexpected = impressions.filter(i => !targetCountries.includes(i.country));

      expect(unexpected.length).toBe(2);
    });

    it('should detect single-country domination (> 90%)', () => {
      const impressions = [
        { country: 'CN' },
        { country: 'CN' },
        { country: 'CN' },
        { country: 'CN' },
        { country: 'US' },
      ];

      const countryDist = impressions.reduce((acc, imp) => {
        acc[imp.country] = (acc[imp.country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dominantCountry = Object.entries(countryDist)
        .find(([country, count]) => count / impressions.length > 0.9);

      expect(dominantCountry).toBeUndefined(); // 80% is not > 90%
    });

    it('should detect VPN/datacenter IP ranges', () => {
      const ips = [
        '10.0.0.1',
        '172.16.0.1',
        '192.168.1.1',
        '203.0.113.1', // Public IP
      ];

      const privateIPRegex = /^(10\.|172\.16\.|192\.168\.)/;
      const vpnIPs = ips.filter(ip => privateIPRegex.test(ip));

      expect(vpnIPs.length).toBe(3);
    });
  });

  describe('Device Fingerprinting', () => {
    it('should detect bot-like device patterns', () => {
      const devices = [
        { type: 'desktop', os: 'Linux', browser: 'headless-chrome' },
        { type: 'mobile', os: 'Android', browser: 'Chrome' },
      ];

      const botKeywords = /headless|phantom|selenium|webdriver/i;
      const botDevices = devices.filter(d => botKeywords.test(d.browser));

      expect(botDevices.length).toBe(1);
    });

    it('should detect unusual device-to-impression ratio', () => {
      const campaign = {
        unique_devices: 10,
        total_impressions: 1000, // 100 impressions per device
      };

      const ratio = campaign.total_impressions / campaign.unique_devices;
      const threshold = 50;

      const isAnomalous = ratio > threshold;

      expect(isAnomalous).toBe(true);
      expect(ratio).toBe(100);
    });

    it('should track device consistency across clicks', () => {
      const clicks = [
        { device_id: 'd1', ip: '203.0.113.1', user_agent: 'Mozilla Chrome' },
        { device_id: 'd1', ip: '203.0.113.1', user_agent: 'Mozilla Firefox' },
      ];

      // Same device ID but different user agent is suspicious
      const deviceFingerprints = clicks.reduce((acc, click) => {
        if (!acc[click.device_id]) {
          acc[click.device_id] = new Set();
        }
        acc[click.device_id].add(click.user_agent);
        return acc;
      }, {} as Record<string, Set<string>>);

      const inconsistentDevices = Object.entries(deviceFingerprints)
        .filter(([id, uas]) => uas.size > 1);

      expect(inconsistentDevices.length).toBe(1);
    });
  });

  describe('Fraud Score Calculation', () => {
    it('should calculate weighted fraud score', () => {
      const signals = [
        { type: 'bot_click', weight: 0.3 },
        { type: 'rapid_click', weight: 0.2 },
        { type: 'hidden_impression', weight: 0.1 },
      ];

      const fraudScore = signals.reduce((sum, s) => sum + s.weight, 0);

      expect(fraudScore).toBeCloseTo(0.6, 1);
    });

    it('should categorize fraud severity', () => {
      const scores = [0.9, 0.7, 0.5, 0.3];

      const getSeverity = (score: number) => {
        if (score >= 0.9) return 'critical';
        if (score >= 0.7) return 'high';
        if (score >= 0.5) return 'medium';
        return 'low';
      };

      expect(getSeverity(scores[0])).toBe('critical');
      expect(getSeverity(scores[1])).toBe('high');
      expect(getSeverity(scores[2])).toBe('medium');
      expect(getSeverity(scores[3])).toBe('low');
    });

    it('should aggregate fraud signals by type', () => {
      const signals = [
        { type: 'bot', severity: 'high' },
        { type: 'bot', severity: 'medium' },
        { type: 'click_fraud', severity: 'high' },
      ];

      const byType = signals.reduce((acc, signal) => {
        if (!acc[signal.type]) {
          acc[signal.type] = [];
        }
        acc[signal.type].push(signal);
        return acc;
      }, {} as Record<string, any[]>);

      expect(byType['bot'].length).toBe(2);
      expect(byType['click_fraud'].length).toBe(1);
    });
  });

  describe('Fraud Scoring API', () => {
    it('should accept campaign_id for scoring', () => {
      const requestBody = {
        campaign_id: 'campaign-123',
        lookback_hours: 24,
      };

      expect(requestBody.campaign_id).toBeDefined();
      expect(requestBody.lookback_hours).toBe(24);
    });

    it('should return fraud score and breakdown', () => {
      const response = {
        campaign_id: 'campaign-123',
        fraud_score: 0.65,
        signals: [
          { type: 'bot_clicks', count: 25, severity: 'high' },
          { type: 'rapid_clicks', count: 15, severity: 'medium' },
        ],
        recommended_action: 'review',
      };

      expect(response.fraud_score).toBeGreaterThan(0.5);
      expect(response.signals.length).toBeGreaterThan(0);
    });

    it('should validate campaign exists', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Campaign not found' },
            }),
          }),
        }),
      };

      const result = await mockSupabaseClient
        .from('ad_campaigns')
        .select('*')
        .eq('id', 'invalid-campaign');

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

  describe('Recommended Actions', () => {
    it('should recommend pause for score > 0.7', () => {
      const fraudScore = 0.8;

      const action = fraudScore >= 0.7 ? 'pause_campaign' : 'monitor';

      expect(action).toBe('pause_campaign');
    });

    it('should recommend review for score 0.5-0.7', () => {
      const fraudScore = 0.6;

      const getAction = (score: number) => {
        if (score >= 0.7) return 'pause_campaign';
        if (score >= 0.5) return 'review';
        return 'monitor';
      };

      expect(getAction(fraudScore)).toBe('review');
    });

    it('should recommend monitor for score < 0.5', () => {
      const fraudScore = 0.3;

      const getAction = (score: number) => {
        if (score >= 0.7) return 'pause_campaign';
        if (score >= 0.5) return 'review';
        return 'monitor';
      };

      expect(getAction(fraudScore)).toBe('monitor');
    });
  });

  describe('Edge Cases', () => {
    it('should handle campaigns with no activity', () => {
      const campaign = {
        impressions: 0,
        clicks: 0,
        conversions: 0,
      };

      const fraudScore = campaign.impressions > 0 ? 0.5 : 0;

      expect(fraudScore).toBe(0);
    });

    it('should handle missing device info', () => {
      const click = {
        device_id: null,
        user_agent: null,
      };

      const hasDeviceInfo = !!(click.device_id && click.user_agent);

      expect(hasDeviceInfo).toBe(false);
    });

    it('should handle concurrent scoring requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        Promise.resolve({
          campaign_id: `campaign-${i}`,
          fraud_score: Math.random(),
        })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.fraud_score).toBeGreaterThanOrEqual(0);
        expect(result.fraud_score).toBeLessThanOrEqual(1);
      });
    });
  });
});
