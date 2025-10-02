/**
 * Affiliate Fraud Detection Endpoint (T156)
 *
 * POST /api/affiliate/fraud/detect
 *
 * Automated fraud detection and alerting for affiliate campaigns:
 * - Analyzes click patterns and conversion anomalies
 * - Detects bots, suspicious IPs, and geographic patterns
 * - Generates fraud alerts with severity ratings
 * - Recommends actions (pause, review, etc.)
 *
 * Request Body:
 * - campaign_id: UUID of affiliate campaign to analyze
 * - lookback_hours?: number (default: 24)
 *
 * Authorization: Required (campaign owner or admin)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface FraudDetectionRequest {
  campaign_id: string;
  lookback_hours?: number;
}

interface FraudEvidence {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count?: number;
  details?: string;
}

interface FraudDetectionResult {
  campaign_id: string;
  fraud_score: number;
  evidence: FraudEvidence[];
  alert_id?: string;
  recommended_action: 'monitor' | 'review' | 'pause_campaign' | 'block';
}

/**
 * Calculate fraud score based on evidence
 */
function calculateFraudScore(evidence: FraudEvidence[]): number {
  const weights = {
    low: 0.1,
    medium: 0.25,
    high: 0.5,
    critical: 1.0,
  };

  let score = 0;
  evidence.forEach(e => {
    score += weights[e.severity];
  });

  return Math.min(score, 1.0);
}

/**
 * Determine recommended action based on fraud score
 */
function getRecommendedAction(fraudScore: number): string {
  if (fraudScore >= 0.9) return 'block';
  if (fraudScore >= 0.7) return 'pause_campaign';
  if (fraudScore >= 0.5) return 'review';
  return 'monitor';
}

/**
 * Detect rapid clicks from same IP
 */
function detectRapidClicks(clicks: any[]): FraudEvidence | null {
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
      severity: rapidClickCount >= 10 ? 'critical' : 'high',
      count: rapidClickCount,
      details: `${rapidClickCount} clicks within 1 second intervals`,
    };
  }

  return null;
}

/**
 * Detect bot user agents
 */
function detectBots(clicks: any[]): FraudEvidence | null {
  const botRegex = /(bot|crawler|spider|curl|wget|python|java|scraper)/i;
  const botClicks = clicks.filter(
    click => !click.user_agent || botRegex.test(click.user_agent)
  );

  if (botClicks.length >= 3) {
    return {
      type: 'bot_detection',
      severity: botClicks.length >= 10 ? 'critical' : 'medium',
      count: botClicks.length,
      details: `${botClicks.length} bot user agents detected`,
    };
  }

  return null;
}

/**
 * Detect conversion rate anomalies
 */
function detectConversionAnomalies(
  campaign: any,
  baselineRate: number
): FraudEvidence | null {
  if (campaign.total_clicks === 0) return null;

  const conversionRate = (campaign.total_conversions / campaign.total_clicks) * 100;

  // Too high conversion rate
  if (conversionRate > 50) {
    return {
      type: 'conversion_anomaly',
      severity: 'critical',
      details: `Conversion rate ${conversionRate.toFixed(2)}% is suspiciously high`,
    };
  }

  // Deviation from baseline
  if (baselineRate > 0) {
    const deviation = conversionRate / baselineRate;
    if (deviation > 3) {
      return {
        type: 'conversion_anomaly',
        severity: 'high',
        details: `Conversion rate ${(deviation).toFixed(1)}x above baseline`,
      };
    }
  }

  // Too low (click fraud)
  if (campaign.total_clicks >= 100 && conversionRate < 0.1) {
    return {
      type: 'click_fraud',
      severity: 'high',
      details: `Conversion rate ${conversionRate.toFixed(3)}% suggests click fraud`,
    };
  }

  return null;
}

/**
 * Detect suspicious IP patterns
 */
function detectIPPatterns(clicks: any[]): FraudEvidence | null {
  // Check for single IP domination
  const ipCounts = new Map<string, number>();
  clicks.forEach(click => {
    ipCounts.set(click.ip, (ipCounts.get(click.ip) || 0) + 1);
  });

  const sortedIPs = Array.from(ipCounts.entries()).sort((a, b) => b[1] - a[1]);
  const topIP = sortedIPs[0];

  if (topIP && clicks.length >= 10 && topIP[1] / clicks.length > 0.7) {
    return {
      type: 'ip_domination',
      severity: 'high',
      count: topIP[1],
      details: `${topIP[1]} clicks (${((topIP[1] / clicks.length) * 100).toFixed(1)}%) from single IP`,
    };
  }

  // Check for private/VPN IPs
  const privateIPRegex = /^(10\.|172\.16\.|192\.168\.)/;
  const privateIPClicks = clicks.filter(click => privateIPRegex.test(click.ip));

  if (privateIPClicks.length >= 5) {
    return {
      type: 'vpn_detection',
      severity: 'medium',
      count: privateIPClicks.length,
      details: `${privateIPClicks.length} clicks from VPN/private IP ranges`,
    };
  }

  return null;
}

/**
 * Create fraud alert record
 */
async function createFraudAlert(
  supabase: any,
  campaignId: string,
  fraudScore: number,
  evidence: FraudEvidence[]
): Promise<string | null> {
  const severity =
    fraudScore >= 0.9 ? 'critical' :
    fraudScore >= 0.7 ? 'high' :
    fraudScore >= 0.5 ? 'medium' : 'low';

  const { data: alert, error } = await supabase
    .from('fraud_alerts')
    .insert({
      campaign_id: campaignId,
      fraud_score: fraudScore,
      severity,
      reasons: evidence.map(e => `${e.type}: ${e.details || e.count}`),
      status: 'pending_review',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create fraud alert:', error);
    return null;
  }

  return alert.id;
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
    // Initialize Supabase client with user's auth token
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

    // Validate request body
    const { campaign_id, lookback_hours = 24 } = req.body as FraudDetectionRequest;

    if (!campaign_id) {
      return res.status(400).json({ error: 'campaign_id is required' });
    }

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Get campaign with ownership verification
    const { data: campaign, error: campaignError } = await supabase
      .from('affiliate_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Verify campaign ownership
    if (campaign.affiliate_id !== user.id) {
      return res.status(403).json({ error: 'Unauthorized access to campaign' });
    }

    // Calculate lookback timestamp
    const lookbackMs = lookback_hours * 60 * 60 * 1000;
    const lookbackTime = new Date(Date.now() - lookbackMs).toISOString();

    // Get recent clicks
    const { data: clicks, error: clicksError } = await supabase
      .from('affiliate_clicks')
      .select('*')
      .eq('campaign_id', campaign_id)
      .gte('created_at', lookbackTime);

    if (clicksError) {
      console.error('Failed to fetch clicks:', clicksError);
      return res.status(500).json({ error: 'Failed to analyze campaign' });
    }

    // Calculate baseline conversion rate from all campaigns
    const { data: allCampaigns } = await supabase
      .from('affiliate_campaigns')
      .select('total_clicks, total_conversions')
      .eq('affiliate_id', campaign.affiliate_id);

    let baselineRate = 0;
    if (allCampaigns && allCampaigns.length > 0) {
      const totalClicks = allCampaigns.reduce((sum, c) => sum + (c.total_clicks || 0), 0);
      const totalConversions = allCampaigns.reduce((sum, c) => sum + (c.total_conversions || 0), 0);
      if (totalClicks > 0) {
        baselineRate = (totalConversions / totalClicks) * 100;
      }
    }

    // Run fraud detection algorithms
    const evidence: FraudEvidence[] = [];

    const rapidClicks = detectRapidClicks(clicks || []);
    if (rapidClicks) evidence.push(rapidClicks);

    const botDetection = detectBots(clicks || []);
    if (botDetection) evidence.push(botDetection);

    const conversionAnomaly = detectConversionAnomalies(campaign, baselineRate);
    if (conversionAnomaly) evidence.push(conversionAnomaly);

    const ipPattern = detectIPPatterns(clicks || []);
    if (ipPattern) evidence.push(ipPattern);

    // Calculate fraud score
    const fraudScore = calculateFraudScore(evidence);

    // Create alert if fraud score exceeds threshold
    let alertId: string | null = null;
    if (fraudScore >= 0.7) {
      alertId = await createFraudAlert(supabase, campaign_id, fraudScore, evidence);
    }

    // Determine recommended action
    const recommendedAction = getRecommendedAction(fraudScore);

    const result: FraudDetectionResult = {
      campaign_id,
      fraud_score: fraudScore,
      evidence,
      alert_id: alertId || undefined,
      recommended_action: recommendedAction as any,
    };

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Fraud detection error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
