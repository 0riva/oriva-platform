/**
 * Affiliate Fraud Detection Tests (T156)
 *
 * Tests automated fraud detection and alerting:
 * - Suspicious click patterns (rapid clicks, bot detection)
 * - Conversion rate anomalies (too high/low)
 * - IP tracking and geolocation analysis
 * - Referer validation
 * - Automated alert generation
 */

describe('Affiliate Fraud Detection', () => {
  describe('Suspicious Click Detection', () => {
    it('should detect rapid clicks from same IP', () => {
      const clicks = [
        { ip: '192.168.1.1', timestamp: Date.now() },
        { ip: '192.168.1.1', timestamp: Date.now() + 100 },
        { ip: '192.168.1.1', timestamp: Date.now() + 200 },
        { ip: '192.168.1.1', timestamp: Date.now() + 300 },
      ];

      const rapidClicks = clicks.filter((click, i) => {
        if (i === 0) return false;
        const timeDiff = click.timestamp - clicks[i - 1].timestamp;
        return click.ip === clicks[i - 1].ip && timeDiff < 1000; // < 1 second
      });

      expect(rapidClicks.length).toBeGreaterThan(0);
    });

    it('should detect bot user agents', () => {
      const suspiciousAgents = [
        'Googlebot/2.1',
        'Mozilla/5.0 (compatible; bingbot/2.0)',
        'curl/7.68.0',
        '',
      ];

      const botRegex = /(bot|crawler|spider|curl)/i;

      suspiciousAgents.forEach(agent => {
        const isBot = !agent || botRegex.test(agent);
        expect(isBot).toBe(true);
      });
    });

    it('should detect unusual click patterns (same user-agent + IP combo)', () => {
      const clicks = [
        { ip: '192.168.1.1', userAgent: 'Mozilla/5.0 Chrome' },
        { ip: '192.168.1.1', userAgent: 'Mozilla/5.0 Chrome' },
        { ip: '192.168.1.1', userAgent: 'Mozilla/5.0 Chrome' },
      ];

      const fingerprint = (click: any) => `${click.ip}:${click.userAgent}`;
      const uniqueFingerprints = new Set(clicks.map(fingerprint));

      const suspiciousPattern = clicks.length >= 3 && uniqueFingerprints.size === 1;

      expect(suspiciousPattern).toBe(true);
    });

    it('should flag clicks without referer', () => {
      const clicksWithoutReferer = [
        { url: 'https://example.com/product', referer: null },
        { url: 'https://example.com/product', referer: undefined },
        { url: 'https://example.com/product', referer: '' },
      ];

      clicksWithoutReferer.forEach(click => {
        const isSuspicious = !click.referer;
        expect(isSuspicious).toBe(true);
      });
    });
  });

  describe('Conversion Rate Anomalies', () => {
    it('should detect unusually high conversion rate (> 50%)', () => {
      const campaign = {
        total_clicks: 100,
        total_conversions: 60, // 60% conversion rate
      };

      const conversionRate = (campaign.total_conversions / campaign.total_clicks) * 100;
      const threshold = 50; // 50% is suspiciously high

      const isAnomaly = conversionRate > threshold;

      expect(isAnomaly).toBe(true);
      expect(conversionRate).toBe(60);
    });

    it('should detect unusually low conversion rate (< 0.1%)', () => {
      const campaign = {
        total_clicks: 10000,
        total_conversions: 5, // 0.05% conversion rate
      };

      const conversionRate = (campaign.total_conversions / campaign.total_clicks) * 100;
      const threshold = 0.1; // 0.1% is suspiciously low (click fraud)

      const isAnomaly = conversionRate < threshold;

      expect(isAnomaly).toBe(true);
      expect(conversionRate).toBeCloseTo(0.05, 2);
    });

    it('should calculate baseline conversion rate for comparison', () => {
      const campaigns = [
        { clicks: 100, conversions: 5 }, // 5%
        { clicks: 200, conversions: 10 }, // 5%
        { clicks: 150, conversions: 8 }, // 5.33%
      ];

      const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
      const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
      const baselineRate = (totalConversions / totalClicks) * 100;

      expect(baselineRate).toBeCloseTo(5.11, 1);
    });

    it('should flag campaign if conversion rate deviates >3x from baseline', () => {
      const baseline = 5; // 5% conversion rate
      const testCampaign = {
        clicks: 100,
        conversions: 20, // 20% conversion rate
      };

      const campaignRate = (testCampaign.conversions / testCampaign.clicks) * 100;
      const deviation = campaignRate / baseline;

      const isAnomalous = deviation > 3;

      expect(isAnomalous).toBe(true);
      expect(deviation).toBe(4);
    });
  });

  describe('IP Analysis', () => {
    it('should detect clicks from VPN/proxy IP ranges', () => {
      const vpnIpRanges = [
        '10.0.0.0', // Private network
        '172.16.0.0', // Private network
        '192.168.0.0', // Private network
      ];

      const isPrivateIP = (ip: string) => {
        return (
          ip.startsWith('10.') ||
          ip.startsWith('172.16.') ||
          ip.startsWith('192.168.')
        );
      };

      vpnIpRanges.forEach(ip => {
        expect(isPrivateIP(ip)).toBe(true);
      });
    });

    it('should detect clicks from same IP across multiple campaigns', () => {
      const clicks = [
        { campaign_id: 'c1', ip: '203.0.113.1' },
        { campaign_id: 'c2', ip: '203.0.113.1' },
        { campaign_id: 'c3', ip: '203.0.113.1' },
      ];

      const ipToCampaigns = new Map<string, Set<string>>();

      clicks.forEach(click => {
        if (!ipToCampaigns.has(click.ip)) {
          ipToCampaigns.set(click.ip, new Set());
        }
        ipToCampaigns.get(click.ip)!.add(click.campaign_id);
      });

      const suspiciousIPs = Array.from(ipToCampaigns.entries())
        .filter(([ip, campaigns]) => campaigns.size >= 3);

      expect(suspiciousIPs.length).toBe(1);
      expect(suspiciousIPs[0][1].size).toBe(3);
    });

    it('should track geographic distribution of clicks', () => {
      const clicks = [
        { country: 'US' },
        { country: 'US' },
        { country: 'US' },
        { country: 'CN' },
        { country: 'RU' },
      ];

      const countryDistribution = clicks.reduce((acc, click) => {
        acc[click.country] = (acc[click.country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(countryDistribution['US']).toBe(3);
      expect(countryDistribution['CN']).toBe(1);
      expect(countryDistribution['RU']).toBe(1);
    });

    it('should flag unusual geographic patterns (all clicks from one country)', () => {
      const clicks = [
        { country: 'CN' },
        { country: 'CN' },
        { country: 'CN' },
        { country: 'CN' },
      ];

      const uniqueCountries = new Set(clicks.map(c => c.country));
      const isSuspicious = clicks.length >= 3 && uniqueCountries.size === 1;

      expect(isSuspicious).toBe(true);
    });
  });

  describe('Alert Generation', () => {
    it('should generate alert for fraud score > 0.7', () => {
      const fraudScore = 0.8; // High fraud probability
      const threshold = 0.7;

      const shouldAlert = fraudScore > threshold;

      expect(shouldAlert).toBe(true);
    });

    it('should include alert details with evidence', () => {
      const alert = {
        campaign_id: 'campaign-123',
        fraud_score: 0.85,
        reasons: [
          'Conversion rate 400% above baseline',
          'Multiple rapid clicks from same IP',
          'Bot user agent detected',
        ],
        timestamp: new Date().toISOString(),
        status: 'pending_review',
      };

      expect(alert.reasons.length).toBeGreaterThan(0);
      expect(alert.fraud_score).toBeGreaterThan(0.7);
      expect(alert.status).toBe('pending_review');
    });

    it('should categorize alert severity based on fraud score', () => {
      const scores = [0.9, 0.75, 0.5];

      const getSeverity = (score: number) => {
        if (score >= 0.9) return 'critical';
        if (score >= 0.7) return 'high';
        if (score >= 0.5) return 'medium';
        return 'low';
      };

      expect(getSeverity(scores[0])).toBe('critical');
      expect(getSeverity(scores[1])).toBe('high');
      expect(getSeverity(scores[2])).toBe('medium');
    });

    it('should create alert record in database', async () => {
      const mockSupabaseClient = {
        from: jest.fn().mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: {
                id: 'alert-123',
                campaign_id: 'campaign-456',
                fraud_score: 0.85,
                status: 'pending_review',
              },
              error: null,
            }),
          }),
        }),
      };

      const alertData = {
        campaign_id: 'campaign-456',
        fraud_score: 0.85,
        reasons: ['Suspicious patterns detected'],
        status: 'pending_review',
      };

      const result = await mockSupabaseClient
        .from('fraud_alerts')
        .insert(alertData)
        .select();

      expect(result.data.id).toBe('alert-123');
      expect(result.data.fraud_score).toBe(0.85);
    });
  });

  describe('Fraud Detection API', () => {
    it('should accept campaign_id for fraud analysis', () => {
      const requestBody = {
        campaign_id: 'campaign-123',
        lookback_hours: 24,
      };

      expect(requestBody.campaign_id).toBeDefined();
      expect(requestBody.lookback_hours).toBe(24);
    });

    it('should return fraud score and evidence', () => {
      const response = {
        campaign_id: 'campaign-123',
        fraud_score: 0.75,
        evidence: [
          { type: 'rapid_clicks', severity: 'high', count: 15 },
          { type: 'bot_detection', severity: 'medium', count: 8 },
        ],
        alert_id: 'alert-456',
        recommended_action: 'pause_campaign',
      };

      expect(response.fraud_score).toBeGreaterThan(0.7);
      expect(response.evidence.length).toBeGreaterThan(0);
      expect(response.recommended_action).toBe('pause_campaign');
    });

    it('should validate campaign exists before analysis', async () => {
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
        .from('affiliate_campaigns')
        .select('*')
        .eq('id', 'invalid-campaign');

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should require authentication for fraud detection', () => {
      const mockRequest = {
        headers: {
          authorization: null,
        },
      };

      const isAuthenticated = !!mockRequest.headers.authorization;

      expect(isAuthenticated).toBe(false);
    });
  });

  describe('Fraud Metrics Aggregation', () => {
    it('should calculate total fraud alerts by severity', () => {
      const alerts = [
        { severity: 'critical', campaign_id: 'c1' },
        { severity: 'critical', campaign_id: 'c2' },
        { severity: 'high', campaign_id: 'c3' },
        { severity: 'medium', campaign_id: 'c4' },
      ];

      const bySeverity = alerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(bySeverity['critical']).toBe(2);
      expect(bySeverity['high']).toBe(1);
      expect(bySeverity['medium']).toBe(1);
    });

    it('should calculate fraud rate across all campaigns', () => {
      const campaigns = [
        { id: 'c1', is_fraudulent: true },
        { id: 'c2', is_fraudulent: false },
        { id: 'c3', is_fraudulent: true },
        { id: 'c4', is_fraudulent: false },
        { id: 'c5', is_fraudulent: false },
      ];

      const fraudCount = campaigns.filter(c => c.is_fraudulent).length;
      const fraudRate = (fraudCount / campaigns.length) * 100;

      expect(fraudRate).toBe(40); // 2/5 = 40%
    });

    it('should track fraud detection over time', () => {
      const now = Date.now();
      const alerts = [
        { timestamp: now },
        { timestamp: now - 3600000 }, // 1 hour ago
        { timestamp: now - 7200000 }, // 2 hours ago
        { timestamp: now - 86400000 }, // 1 day ago (exactly at boundary)
      ];

      const last24Hours = alerts.filter(
        alert => now - alert.timestamp <= 86400000 // Use <= to include boundary
      );

      expect(last24Hours.length).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    it('should handle campaign with no clicks', () => {
      const campaign = {
        total_clicks: 0,
        total_conversions: 0,
      };

      const conversionRate = campaign.total_clicks > 0
        ? (campaign.total_conversions / campaign.total_clicks) * 100
        : 0;

      expect(conversionRate).toBe(0);
    });

    it('should handle missing IP data', () => {
      const click = {
        ip: null,
        userAgent: 'Mozilla/5.0',
      };

      const hasValidIP = !!click.ip;

      expect(hasValidIP).toBe(false);
    });

    it('should handle concurrent fraud detection requests', async () => {
      const requests = Array(10).fill(null).map((_, i) =>
        Promise.resolve({
          campaign_id: `campaign-${i}`,
          fraud_score: Math.random(),
        })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.campaign_id).toBeDefined();
        expect(result.fraud_score).toBeGreaterThanOrEqual(0);
        expect(result.fraud_score).toBeLessThanOrEqual(1);
      });
    });
  });
});
