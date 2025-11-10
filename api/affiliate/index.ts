/**
 * Consolidated Affiliate Marketing API (T146-T149, T156)
 *
 * Handles all affiliate marketing operations:
 * - Campaign management (create, list)
 * - Commission calculation
 * - Fraud detection
 *
 * Routes:
 * - GET    /api/affiliate/campaigns          - List campaigns
 * - POST   /api/affiliate/campaigns          - Create campaign
 * - POST   /api/affiliate/commissions        - Calculate commission
 * - POST   /api/affiliate/fraud              - Detect fraud
 *
 * Note: URL resolution is handled by separate Edge function:
 *       /api/affiliate/resolve/[shortCode].ts (Edge Runtime)
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

interface ListCampaignsQuery {
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  limit?: number;
  sort?: 'created_at' | 'name' | 'total_conversions';
  order?: 'asc' | 'desc';
}

interface CreateCampaignRequest {
  item_id: string;
  name: string;
  commission_type: 'percentage' | 'fixed';
  commission_rate?: number;
  fixed_commission_cents?: number;
  start_date?: string;
  end_date?: string;
  max_conversions?: number;
}

interface CalculateCommissionRequest {
  click_id: string;
  transaction_id: string;
}

interface FraudDetectionRequest {
  campaign_id: string;
  lookback_hours?: number;
}

interface ValidationError {
  field: string;
  message: string;
}

interface FraudEvidence {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count?: number;
  details?: string;
}

// ============================================================================
// Campaign Management
// ============================================================================

/**
 * List affiliate campaigns
 * GET /api/affiliate/campaigns
 */
async function listCampaigns(req: NextApiRequest, res: NextApiResponse) {
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

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Parse query parameters
    const {
      status = 'all',
      page = 0,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
    } = req.query as Partial<ListCampaignsQuery>;

    // Validate and sanitize pagination
    const pageNum = Math.max(0, Number(page) || 0);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = pageNum * limitNum;

    // Build query
    let query = supabase
      .from('affiliate_campaigns')
      .select(`
        *,
        entries!inner(
          id,
          content,
          marketplace_metadata
        ),
        affiliate_analytics(
          total_clicks,
          total_conversions,
          conversion_rate,
          total_commission_earned
        )
      `, { count: 'exact' })
      .eq('affiliate_id', user.id);

    // Filter by status
    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    // Sort
    const sortField = ['created_at', 'name', 'total_conversions'].includes(String(sort))
      ? String(sort)
      : 'created_at';
    const sortOrder = order === 'asc' ? { ascending: true } : { ascending: false };

    query = query.order(sortField, sortOrder);

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    // Execute query
    const { data: campaigns, error: queryError, count } = await query;

    if (queryError) {
      console.error('Campaign list error:', queryError);
      return res.status(500).json({ error: 'Failed to fetch campaigns' });
    }

    // Calculate pagination metadata
    const totalPages = count ? Math.ceil(count / limitNum) : 0;
    const hasNext = pageNum < totalPages - 1;
    const hasPrev = pageNum > 0;

    // Return success with campaigns and pagination
    return res.status(200).json({
      success: true,
      campaigns: campaigns || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages,
        hasNext,
        hasPrev,
      },
    });
  } catch (error) {
    console.error('Campaign list error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Validate campaign creation request
 */
function validateCampaignRequest(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.item_id) {
    errors.push({ field: 'item_id', message: 'Item ID is required' });
  }

  if (!data.name) {
    errors.push({ field: 'name', message: 'Campaign name is required' });
  } else if (data.name.length < 3) {
    errors.push({ field: 'name', message: 'Campaign name must be at least 3 characters' });
  } else if (data.name.length > 200) {
    errors.push({ field: 'name', message: 'Campaign name must not exceed 200 characters' });
  }

  if (!data.commission_type) {
    errors.push({ field: 'commission_type', message: 'Commission type is required' });
  } else if (!['percentage', 'fixed'].includes(data.commission_type)) {
    errors.push({ field: 'commission_type', message: 'Commission type must be "percentage" or "fixed"' });
  }

  // Commission type-specific validation
  if (data.commission_type === 'percentage') {
    if (data.commission_rate === undefined) {
      errors.push({ field: 'commission_rate', message: 'Commission rate is required for percentage type' });
    } else if (data.commission_rate <= 0 || data.commission_rate > 100) {
      errors.push({ field: 'commission_rate', message: 'Commission rate must be between 1 and 100' });
    }
  }

  if (data.commission_type === 'fixed') {
    if (data.fixed_commission_cents === undefined) {
      errors.push({ field: 'fixed_commission_cents', message: 'Fixed commission amount is required for fixed type' });
    } else if (data.fixed_commission_cents <= 0) {
      errors.push({ field: 'fixed_commission_cents', message: 'Fixed commission must be greater than 0' });
    }
  }

  // Date validation
  if (data.start_date && isNaN(new Date(data.start_date).getTime())) {
    errors.push({ field: 'start_date', message: 'Invalid start date format' });
  }

  if (data.end_date && isNaN(new Date(data.end_date).getTime())) {
    errors.push({ field: 'end_date', message: 'Invalid end date format' });
  }

  if (data.start_date && data.end_date && new Date(data.end_date) <= new Date(data.start_date)) {
    errors.push({ field: 'end_date', message: 'End date must be after start date' });
  }

  // Max conversions validation
  if (data.max_conversions !== undefined && data.max_conversions <= 0) {
    errors.push({ field: 'max_conversions', message: 'Max conversions must be greater than 0' });
  }

  return errors;
}

/**
 * Create affiliate campaign
 * POST /api/affiliate/campaigns
 */
async function createCampaign(req: NextApiRequest, res: NextApiResponse) {
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

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Validate request body
    const validationErrors = validateCampaignRequest(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const campaignData: CreateCampaignRequest = req.body;

    // Verify item exists and is a marketplace item
    const { data: item, error: itemError } = await supabase
      .from('entries')
      .select('id, user_id, entry_type, marketplace_metadata')
      .eq('id', campaignData.item_id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.entry_type !== 'marketplace_item') {
      return res.status(400).json({ error: 'Item is not a marketplace item' });
    }

    // Verify user owns the item
    if (item.user_id !== user.id) {
      return res.status(403).json({ error: 'You can only create campaigns for your own items' });
    }

    // Create campaign
    const { data: campaign, error: createError } = await supabase
      .from('affiliate_campaigns')
      .insert({
        affiliate_id: user.id,
        item_id: campaignData.item_id,
        name: campaignData.name,
        commission_type: campaignData.commission_type,
        commission_rate: campaignData.commission_rate || null,
        fixed_commission_cents: campaignData.fixed_commission_cents || null,
        start_date: campaignData.start_date || new Date().toISOString(),
        end_date: campaignData.end_date || null,
        max_conversions: campaignData.max_conversions || null,
        is_active: true,
        total_clicks: 0,
        total_conversions: 0,
      })
      .select('*, entries!inner(*)')
      .single();

    if (createError) {
      console.error('Campaign creation error:', createError);
      return res.status(500).json({ error: 'Failed to create campaign' });
    }

    // Return success with campaign data
    return res.status(201).json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error('Campaign creation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Commission Calculation
// ============================================================================

/**
 * Calculate commission amount based on campaign type
 */
function calculateCommissionAmount(
  campaign: any,
  transactionAmount: number
): number {
  if (campaign.commission_type === 'percentage') {
    return Math.round((transactionAmount * campaign.commission_rate) / 100);
  } else if (campaign.commission_type === 'fixed') {
    return campaign.fixed_commission_cents;
  }

  throw new Error('Invalid commission type');
}

/**
 * Validate commission doesn't exceed transaction amount
 */
function validateCommission(
  commissionAmount: number,
  transactionAmount: number
): boolean {
  return commissionAmount > 0 && commissionAmount <= transactionAmount;
}

/**
 * Calculate and record affiliate commission
 * POST /api/affiliate/commissions
 */
async function calculateCommission(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Validate webhook signature
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
      return res.status(401).json({ error: 'Invalid webhook authentication' });
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Validate request body
    const { click_id, transaction_id } = req.body as CalculateCommissionRequest;

    if (!click_id) {
      return res.status(400).json({ error: 'click_id is required' });
    }

    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id is required' });
    }

    // Get click details with campaign
    const { data: click, error: clickError } = await supabase
      .from('affiliate_clicks')
      .select('*, affiliate_campaigns!inner(*)')
      .eq('id', click_id)
      .single();

    if (clickError || !click) {
      return res.status(404).json({ error: 'Click not found' });
    }

    // Check if already converted
    if (click.converted) {
      return res.status(400).json({
        error: 'Click already converted',
        conversion_id: click.conversion_id,
      });
    }

    // Verify campaign is active
    const campaign = click.affiliate_campaigns;
    if (!campaign || !campaign.is_active) {
      return res.status(400).json({ error: 'Campaign is not active' });
    }

    // Check if campaign has reached max conversions
    if (
      campaign.max_conversions !== null &&
      campaign.total_conversions >= campaign.max_conversions
    ) {
      return res.status(400).json({ error: 'Campaign has reached maximum conversions' });
    }

    // Get transaction details
    const { data: transaction, error: txnError } = await supabase
      .from('orivapay_transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (txnError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Verify transaction is successful
    if (transaction.status !== 'succeeded') {
      return res.status(400).json({
        error: 'Transaction must be completed',
        status: transaction.status,
      });
    }

    // Calculate commission
    const commissionAmount = calculateCommissionAmount(
      campaign,
      transaction.amount_cents
    );

    // Validate commission
    if (!validateCommission(commissionAmount, transaction.amount_cents)) {
      return res.status(400).json({
        error: 'Invalid commission amount',
        commission: commissionAmount,
        transaction_amount: transaction.amount_cents,
      });
    }

    // Create conversion record
    const { data: conversion, error: conversionError } = await supabase
      .from('affiliate_conversions')
      .insert({
        click_id: click.id,
        campaign_id: click.campaign_id,
        affiliate_id: click.affiliate_id,
        transaction_id: transaction.id,
        commission_amount_cents: commissionAmount,
        commission_rate: campaign.commission_rate,
        currency: transaction.currency,
        payout_status: 'pending',
      })
      .select()
      .single();

    if (conversionError) {
      console.error('Conversion creation error:', conversionError);
      return res.status(500).json({ error: 'Failed to create conversion' });
    }

    // Update click as converted
    await supabase
      .from('affiliate_clicks')
      .update({
        converted: true,
        conversion_id: conversion.id,
        converted_at: new Date().toISOString(),
      })
      .eq('id', click.id);

    // Update campaign analytics
    await supabase
      .from('affiliate_campaigns')
      .update({
        total_conversions: (campaign.total_conversions || 0) + 1,
      })
      .eq('id', campaign.id);

    // Return success
    return res.status(201).json({
      success: true,
      conversion_id: conversion.id,
      commission_amount_cents: commissionAmount,
      commission_rate: campaign.commission_rate,
      currency: transaction.currency,
      payout_status: 'pending',
    });
  } catch (error) {
    console.error('Commission calculation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Fraud Detection
// ============================================================================

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
  ipClickTimes.forEach((times) => {
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

/**
 * Detect fraud in affiliate campaign
 * POST /api/affiliate/fraud
 */
async function detectFraud(req: NextApiRequest, res: NextApiResponse) {
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

    // Calculate baseline conversion rate
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

    return res.status(200).json({
      success: true,
      campaign_id,
      fraud_score: fraudScore,
      evidence,
      alert_id: alertId || undefined,
      recommended_action: recommendedAction,
    });
  } catch (error) {
    console.error('Fraud detection error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { pathname } = new URL(req.url || '', `http://${req.headers.host}`);

  // Route: /api/affiliate/campaigns
  if (pathname === '/api/affiliate/campaigns') {
    if (req.method === 'GET') {
      return listCampaigns(req, res);
    }
    if (req.method === 'POST') {
      return createCampaign(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Route: /api/affiliate/commissions
  if (pathname.startsWith('/api/affiliate/commissions')) {
    if (req.method === 'POST') {
      return calculateCommission(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Route: /api/affiliate/fraud
  if (pathname.startsWith('/api/affiliate/fraud')) {
    if (req.method === 'POST') {
      return detectFraud(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Unknown route
  return res.status(404).json({ error: 'Not found' });
}
