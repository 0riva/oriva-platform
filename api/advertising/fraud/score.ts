/**
 * Advertising Fraud Scoring Endpoint (T182)
 *
 * POST /api/advertising/fraud/score
 *
 * Comprehensive fraud scoring for ad campaigns:
 * - Click fraud detection (bots, rapid clicks, invalid clicks)
 * - Impression fraud (stuffing, hidden ads, non-viewable)
 * - Conversion fraud (fake conversions, unrealistic timing)
 * - Geographic anomalies and device fingerprinting
 * - Weighted fraud score with recommended actions
 *
 * Request Body:
 * - campaign_id: UUID of ad campaign to analyze
 * - lookback_hours?: number (default: 24)
 *
 * Authorization: Required (campaign owner or admin)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface FraudScoringRequest {
  campaign_id: string;
  lookback_hours?: number;
}

interface FraudSignal {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count?: number;
  details?: string;
}

interface FraudScoringResult {
  campaign_id: string;
  fraud_score: number;
  signals: FraudSignal[];
  recommended_action: 'monitor' | 'review' | 'pause_campaign' | 'block';
}

/**
 * Calculate weighted fraud score
 */
function calculateFraudScore(signals: FraudSignal[]): number {
  const weights = {
    low: 0.1,
    medium: 0.25,
    high: 0.5,
    critical: 1.0,
  };

  let score = 0;
  signals.forEach(s => {
    score += weights[s.severity];
  });

  return Math.min(score, 1.0);
}

/**
 * Get recommended action based on fraud score
 */
function getRecommendedAction(fraudScore: number): string {
  if (fraudScore >= 0.9) return 'block';
  if (fraudScore >= 0.7) return 'pause_campaign';
  if (fraudScore >= 0.5) return 'review';
  return 'monitor';
}

/**
 * Detect bot clicks via user agent
 */
function detectBotClicks(clicks: any[]): FraudSignal | null {
  const botRegex = /(bot|crawler|spider|curl|wget|python|java|scraper)/i;
  const botClicks = clicks.filter(
    click => !click.user_agent || botRegex.test(click.user_agent)
  );

  if (botClicks.length >= 3) {
    return {
      type: 'bot_clicks',
      severity: botClicks.length >= 10 ? 'critical' : 'high',
      count: botClicks.length,
      details: `${botClicks.length} bot user agents detected`,
    };
  }

  return null;
}

/**
 * Detect rapid clicking from same IP
 */
function detectRapidClicks(clicks: any[]): FraudSignal | null {
  const ipClickTimes = new Map<string, number[]>();

  clicks.forEach(click => {
    if (!ipClickTimes.has(click.ip)) {
      ipClickTimes.set(click.ip, []);
    }
    ipClickTimes.get(click.ip)!.push(new Date(click.created_at).getTime());
  });

  let rapidClickCount = 0;
  ipClickTimes.forEach((times, ip) => {
    const sortedTimes = times.sort((a, b) => a - b);
    for (let i = 1; i < sortedTimes.length; i++) {
      if (sortedTimes[i] - sortedTimes[i - 1] < 1000) {
        rapidClickCount++;
      }
    }
  });

  if (rapidClickCount >= 5) {
    return {
      type: 'rapid_clicks',
      severity: rapidClickCount >= 15 ? 'critical' : 'high',
      count: rapidClickCount,
      details: `${rapidClickCount} clicks within 1 second intervals`,
    };
  }

  return null;
}

/**
 * Detect clicks without impressions
 */
function detectClicksWithoutImpressions(
  clicks: any[],
  impressions: any[]
): FraudSignal | null {
  const impressionSet = new Set(
    impressions.map(imp => `${imp.creative_id}:${imp.user_id}`)
  );

  const invalidClicks = clicks.filter(click => {
    const key = `${click.creative_id}:${click.user_id}`;
    return !impressionSet.has(key);
  });

  if (invalidClicks.length >= 5) {
    return {
      type: 'clicks_without_impressions',
      severity: 'high',
      count: invalidClicks.length,
      details: `${invalidClicks.length} clicks without corresponding impressions`,
    };
  }

  return null;
}

/**
 * Detect CTR anomalies
 */
function detectCTRAnomalies(
  impressionCount: number,
  clickCount: number
): FraudSignal | null {
  if (impressionCount === 0) return null;

  const ctr = (clickCount / impressionCount) * 100;

  if (ctr > 10) {
    return {
      type: 'ctr_anomaly',
      severity: ctr > 20 ? 'critical' : 'high',
      details: `CTR of ${ctr.toFixed(2)}% is suspiciously high`,
    };
  }

  return null;
}

/**
 * Detect impression stuffing
 */
function detectImpressionStuffing(impressions: any[]): FraudSignal | null {
  const impressionsPerPage = impressions.reduce((acc, imp) => {
    const key = imp.page_id || imp.session_id;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stuffedPages = Object.values(impressionsPerPage).filter((count: number) => count > 3);

  if (stuffedPages.length >= 3) {
    return {
      type: 'impression_stuffing',
      severity: 'high',
      count: stuffedPages.length,
      details: `${stuffedPages.length} pages with >3 impressions`,
    };
  }

  return null;
}

/**
 * Detect non-viewable impressions
 */
function detectNonViewableImpressions(impressions: any[]): FraudSignal | null {
  const nonViewable = impressions.filter(
    imp => !imp.is_viewable || (imp.visibility_percentage || 0) < 50
  );

  const nonViewableRate = (nonViewable.length / impressions.length) * 100;

  if (nonViewableRate > 30) {
    return {
      type: 'non_viewable_impressions',
      severity: nonViewableRate > 50 ? 'critical' : 'medium',
      count: nonViewable.length,
      details: `${nonViewableRate.toFixed(1)}% impressions not viewable`,
    };
  }

  return null;
}

/**
 * Detect conversion fraud
 */
function detectConversionFraud(
  conversions: any[],
  clicks: any[]
): FraudSignal[] {
  const signals: FraudSignal[] = [];

  // Conversions without clicks
  const clickSet = new Set(clicks.map(c => c.id));
  const invalidConversions = conversions.filter(conv => !clickSet.has(conv.click_id));

  if (invalidConversions.length >= 3) {
    signals.push({
      type: 'conversions_without_clicks',
      severity: 'critical',
      count: invalidConversions.length,
      details: `${invalidConversions.length} conversions without clicks`,
    });
  }

  // Unrealistic conversion time
  const quickConversions = conversions.filter(conv => {
    if (!conv.time_from_click_ms) return false;
    return conv.time_from_click_ms < 5000; // < 5 seconds
  });

  if (quickConversions.length >= 3) {
    signals.push({
      type: 'unrealistic_conversion_time',
      severity: 'high',
      count: quickConversions.length,
      details: `${quickConversions.length} conversions < 5 seconds`,
    });
  }

  // Duplicate conversions
  const conversionFingerprints = conversions.map(
    c => `${c.user_id}:${c.campaign_id}`
  );
  const uniqueFingerprints = new Set(conversionFingerprints);

  if (conversionFingerprints.length !== uniqueFingerprints.size) {
    const duplicateCount = conversionFingerprints.length - uniqueFingerprints.size;
    signals.push({
      type: 'duplicate_conversions',
      severity: 'high',
      count: duplicateCount,
      details: `${duplicateCount} duplicate conversions detected`,
    });
  }

  return signals;
}

/**
 * Detect geographic anomalies
 */
function detectGeographicAnomalies(
  campaign: any,
  impressions: any[]
): FraudSignal | null {
  const targetCountries = campaign.ad_targeting?.countries || [];

  if (targetCountries.length === 0) return null;

  const unexpectedCountries = impressions.filter(
    imp => !targetCountries.includes(imp.country)
  );

  const unexpectedRate = (unexpectedCountries.length / impressions.length) * 100;

  if (unexpectedRate > 20) {
    return {
      type: 'geographic_anomaly',
      severity: unexpectedRate > 50 ? 'critical' : 'medium',
      count: unexpectedCountries.length,
      details: `${unexpectedRate.toFixed(1)}% traffic from unexpected countries`,
    };
  }

  return null;
}

/**
 * Detect device/bot patterns
 */
function detectDeviceAnomalies(
  impressionCount: number,
  uniqueDevices: number
): FraudSignal | null {
  if (uniqueDevices === 0) return null;

  const ratio = impressionCount / uniqueDevices;

  if (ratio > 50) {
    return {
      type: 'device_anomaly',
      severity: ratio > 100 ? 'critical' : 'high',
      details: `${ratio.toFixed(1)} impressions per device (suspicious)`,
    };
  }

  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Validate request
    const { campaign_id, lookback_hours = 24 } = req.body as FraudScoringRequest;

    if (!campaign_id) {
      return res.status(400).json({ error: 'campaign_id is required' });
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Get campaign with targeting
    const { data: campaign, error: campaignError } = await supabase
      .from('ad_campaigns')
      .select('*, ad_targeting!inner(*)')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Verify campaign ownership
    if (campaign.user_id !== user.id) {
      return res.status(403).json({ error: 'Unauthorized access to campaign' });
    }

    // Calculate lookback timestamp
    const lookbackMs = lookback_hours * 60 * 60 * 1000;
    const lookbackTime = new Date(Date.now() - lookbackMs).toISOString();

    // Fetch campaign data
    const [impressionsResult, clicksResult, conversionsResult] = await Promise.all([
      supabase
        .from('ad_impressions')
        .select('*')
        .eq('campaign_id', campaign_id)
        .gte('created_at', lookbackTime),
      supabase
        .from('ad_clicks')
        .select('*')
        .eq('campaign_id', campaign_id)
        .gte('created_at', lookbackTime),
      supabase
        .from('ad_conversions')
        .select('*')
        .eq('campaign_id', campaign_id)
        .gte('created_at', lookbackTime),
    ]);

    const impressions = impressionsResult.data || [];
    const clicks = clicksResult.data || [];
    const conversions = conversionsResult.data || [];

    // Run fraud detection algorithms
    const signals: FraudSignal[] = [];

    const botClicks = detectBotClicks(clicks);
    if (botClicks) signals.push(botClicks);

    const rapidClicks = detectRapidClicks(clicks);
    if (rapidClicks) signals.push(rapidClicks);

    const clicksWithoutImp = detectClicksWithoutImpressions(clicks, impressions);
    if (clicksWithoutImp) signals.push(clicksWithoutImp);

    const ctrAnomaly = detectCTRAnomalies(impressions.length, clicks.length);
    if (ctrAnomaly) signals.push(ctrAnomaly);

    const impStuffing = detectImpressionStuffing(impressions);
    if (impStuffing) signals.push(impStuffing);

    const nonViewable = detectNonViewableImpressions(impressions);
    if (nonViewable) signals.push(nonViewable);

    const conversionFraud = detectConversionFraud(conversions, clicks);
    signals.push(...conversionFraud);

    const geoAnomaly = detectGeographicAnomalies(campaign, impressions);
    if (geoAnomaly) signals.push(geoAnomaly);

    const uniqueDevices = new Set(impressions.map(i => i.device_id)).size;
    const deviceAnomaly = detectDeviceAnomalies(impressions.length, uniqueDevices);
    if (deviceAnomaly) signals.push(deviceAnomaly);

    // Calculate fraud score
    const fraudScore = calculateFraudScore(signals);

    // Get recommended action
    const recommendedAction = getRecommendedAction(fraudScore);

    const result: FraudScoringResult = {
      campaign_id,
      fraud_score: fraudScore,
      signals,
      recommended_action: recommendedAction as any,
    };

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Fraud scoring error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
