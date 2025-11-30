/**
 * Consolidated Marketing API (Affiliate + Advertising)
 *
 * Combines all marketing operations into a single Vercel function:
 * - Affiliate: Campaign management, commission calculation, fraud detection
 * - Advertising: Ad serving, impression tracking
 *
 * Routes:
 * - GET    /api/v1/marketing/affiliate/campaigns     - List affiliate campaigns
 * - POST   /api/v1/marketing/affiliate/campaigns     - Create affiliate campaign
 * - POST   /api/v1/marketing/affiliate/commissions   - Calculate commission
 * - POST   /api/v1/marketing/affiliate/fraud         - Detect fraud
 * - POST   /api/v1/marketing/ads/serve               - Serve an ad
 * - POST   /api/v1/marketing/ads/track               - Track impression
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

interface AdContext {
  user_id?: string;
  thread_id?: string;
  placement: 'feed' | 'sidebar' | 'thread' | 'marketplace';
  user_interests?: string[];
  thread_keywords?: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getSupabaseClient(authHeader?: string) {
  if (authHeader) {
    return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      global: {
        headers: { Authorization: authHeader },
      },
    });
  }
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// ============================================================================
// Affiliate: Campaign Management
// ============================================================================

async function listCampaigns(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabaseClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const {
      status = 'all',
      page = 0,
      limit = 20,
      sort = 'created_at',
      order = 'desc',
    } = req.query as Partial<ListCampaignsQuery>;

    const pageNum = Math.max(0, Number(page) || 0);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = pageNum * limitNum;

    let query = supabase
      .from('affiliate_campaigns')
      .select(
        `
        *,
        entries!inner(id, content, marketplace_metadata),
        affiliate_analytics(total_clicks, total_conversions, conversion_rate, total_commission_earned)
      `,
        { count: 'exact' }
      )
      .eq('affiliate_id', user.id);

    if (status === 'active') {
      query = query.eq('is_active', true);
    } else if (status === 'inactive') {
      query = query.eq('is_active', false);
    }

    const sortField = ['created_at', 'name', 'total_conversions'].includes(String(sort))
      ? String(sort)
      : 'created_at';
    query = query.order(sortField, { ascending: order === 'asc' });
    query = query.range(offset, offset + limitNum - 1);

    const { data: campaigns, error: queryError, count } = await query;

    if (queryError) {
      console.error('Campaign list error:', queryError);
      return res.status(500).json({ error: 'Failed to fetch campaigns' });
    }

    const totalPages = count ? Math.ceil(count / limitNum) : 0;

    return res.status(200).json({
      success: true,
      campaigns: campaigns || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages,
        hasNext: pageNum < totalPages - 1,
        hasPrev: pageNum > 0,
      },
    });
  } catch (error) {
    console.error('Campaign list error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function validateCampaignRequest(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

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
    errors.push({
      field: 'commission_type',
      message: 'Commission type must be "percentage" or "fixed"',
    });
  }

  if (data.commission_type === 'percentage') {
    if (data.commission_rate === undefined) {
      errors.push({
        field: 'commission_rate',
        message: 'Commission rate is required for percentage type',
      });
    } else if (data.commission_rate <= 0 || data.commission_rate > 100) {
      errors.push({
        field: 'commission_rate',
        message: 'Commission rate must be between 1 and 100',
      });
    }
  }

  if (data.commission_type === 'fixed') {
    if (data.fixed_commission_cents === undefined) {
      errors.push({
        field: 'fixed_commission_cents',
        message: 'Fixed commission amount is required for fixed type',
      });
    } else if (data.fixed_commission_cents <= 0) {
      errors.push({
        field: 'fixed_commission_cents',
        message: 'Fixed commission must be greater than 0',
      });
    }
  }

  if (data.start_date && isNaN(new Date(data.start_date).getTime())) {
    errors.push({ field: 'start_date', message: 'Invalid start date format' });
  }

  if (data.end_date && isNaN(new Date(data.end_date).getTime())) {
    errors.push({ field: 'end_date', message: 'Invalid end date format' });
  }

  if (data.start_date && data.end_date && new Date(data.end_date) <= new Date(data.start_date)) {
    errors.push({ field: 'end_date', message: 'End date must be after start date' });
  }

  if (data.max_conversions !== undefined && data.max_conversions <= 0) {
    errors.push({ field: 'max_conversions', message: 'Max conversions must be greater than 0' });
  }

  return errors;
}

async function createCampaign(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabaseClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const validationErrors = validateCampaignRequest(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }

    const campaignData: CreateCampaignRequest = req.body;

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

    if (item.user_id !== user.id) {
      return res.status(403).json({ error: 'You can only create campaigns for your own items' });
    }

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

    return res.status(201).json({ success: true, campaign });
  } catch (error) {
    console.error('Campaign creation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Affiliate: Commission Calculation
// ============================================================================

function calculateCommissionAmount(campaign: any, transactionAmount: number): number {
  if (campaign.commission_type === 'percentage') {
    return Math.round((transactionAmount * campaign.commission_rate) / 100);
  } else if (campaign.commission_type === 'fixed') {
    return campaign.fixed_commission_cents;
  }
  throw new Error('Invalid commission type');
}

async function calculateCommission(req: NextApiRequest, res: NextApiResponse) {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
      return res.status(401).json({ error: 'Invalid webhook authentication' });
    }

    const supabase = getSupabaseClient();
    const { click_id, transaction_id } = req.body as CalculateCommissionRequest;

    if (!click_id) return res.status(400).json({ error: 'click_id is required' });
    if (!transaction_id) return res.status(400).json({ error: 'transaction_id is required' });

    const { data: click, error: clickError } = await supabase
      .from('affiliate_clicks')
      .select('*, affiliate_campaigns!inner(*)')
      .eq('id', click_id)
      .single();

    if (clickError || !click) {
      return res.status(404).json({ error: 'Click not found' });
    }

    if (click.converted) {
      return res
        .status(400)
        .json({ error: 'Click already converted', conversion_id: click.conversion_id });
    }

    const campaign = click.affiliate_campaigns;
    if (!campaign || !campaign.is_active) {
      return res.status(400).json({ error: 'Campaign is not active' });
    }

    if (
      campaign.max_conversions !== null &&
      campaign.total_conversions >= campaign.max_conversions
    ) {
      return res.status(400).json({ error: 'Campaign has reached maximum conversions' });
    }

    const { data: transaction, error: txnError } = await supabase
      .from('orivapay_transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (txnError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'succeeded') {
      return res
        .status(400)
        .json({ error: 'Transaction must be completed', status: transaction.status });
    }

    const commissionAmount = calculateCommissionAmount(campaign, transaction.amount_cents);

    if (commissionAmount <= 0 || commissionAmount > transaction.amount_cents) {
      return res.status(400).json({ error: 'Invalid commission amount' });
    }

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

    await supabase
      .from('affiliate_clicks')
      .update({
        converted: true,
        conversion_id: conversion.id,
        converted_at: new Date().toISOString(),
      })
      .eq('id', click.id);

    await supabase
      .from('affiliate_campaigns')
      .update({ total_conversions: (campaign.total_conversions || 0) + 1 })
      .eq('id', campaign.id);

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
// Affiliate: Fraud Detection
// ============================================================================

function calculateFraudScore(evidence: FraudEvidence[]): number {
  const weights = { low: 0.1, medium: 0.25, high: 0.5, critical: 1.0 };
  return Math.min(
    evidence.reduce((sum, e) => sum + weights[e.severity], 0),
    1.0
  );
}

function getRecommendedAction(fraudScore: number): string {
  if (fraudScore >= 0.9) return 'block';
  if (fraudScore >= 0.7) return 'pause_campaign';
  if (fraudScore >= 0.5) return 'review';
  return 'monitor';
}

function detectRapidClicks(clicks: any[]): FraudEvidence | null {
  const ipClickTimes = new Map<string, number[]>();
  clicks.forEach((click) => {
    if (!ipClickTimes.has(click.ip)) ipClickTimes.set(click.ip, []);
    ipClickTimes.get(click.ip)!.push(new Date(click.created_at).getTime());
  });

  let rapidClickCount = 0;
  ipClickTimes.forEach((times) => {
    const sorted = times.sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] < 1000) rapidClickCount++;
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

function detectBots(clicks: any[]): FraudEvidence | null {
  const botRegex = /(bot|crawler|spider|curl|wget|python|java|scraper)/i;
  const botClicks = clicks.filter((click) => !click.user_agent || botRegex.test(click.user_agent));

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

async function detectFraud(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = getSupabaseClient(authHeader);
    const { campaign_id, lookback_hours = 24 } = req.body as FraudDetectionRequest;

    if (!campaign_id) {
      return res.status(400).json({ error: 'campaign_id is required' });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('affiliate_campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.affiliate_id !== user.id) {
      return res.status(403).json({ error: 'Unauthorized access to campaign' });
    }

    const lookbackTime = new Date(Date.now() - lookback_hours * 60 * 60 * 1000).toISOString();

    const { data: clicks } = await supabase
      .from('affiliate_clicks')
      .select('*')
      .eq('campaign_id', campaign_id)
      .gte('created_at', lookbackTime);

    const evidence: FraudEvidence[] = [];

    const rapidClicks = detectRapidClicks(clicks || []);
    if (rapidClicks) evidence.push(rapidClicks);

    const botDetection = detectBots(clicks || []);
    if (botDetection) evidence.push(botDetection);

    const fraudScore = calculateFraudScore(evidence);

    let alertId: string | null = null;
    if (fraudScore >= 0.7) {
      const { data: alert } = await supabase
        .from('fraud_alerts')
        .insert({
          campaign_id,
          fraud_score: fraudScore,
          severity: fraudScore >= 0.9 ? 'critical' : fraudScore >= 0.7 ? 'high' : 'medium',
          reasons: evidence.map((e) => `${e.type}: ${e.details || e.count}`),
          status: 'pending_review',
        })
        .select()
        .single();
      alertId = alert?.id || null;
    }

    return res.status(200).json({
      success: true,
      campaign_id,
      fraud_score: fraudScore,
      evidence,
      alert_id: alertId || undefined,
      recommended_action: getRecommendedAction(fraudScore),
    });
  } catch (error) {
    console.error('Fraud detection error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Advertising: Ad Serving
// ============================================================================

const RELEVANCE_THRESHOLD = 0.3;
const MAX_BID = 10000;

function calculateRelevanceScore(
  campaign: any,
  context: AdContext,
  userSegments: string[]
): number {
  let score = 0;

  if (userSegments.length > 0 && campaign.ad_targeting?.interest_keywords) {
    const overlap = userSegments.filter((s) =>
      campaign.ad_targeting.interest_keywords.includes(s)
    ).length;
    score += (overlap / userSegments.length) * 0.4;
  }

  if (context.thread_keywords && campaign.ad_targeting?.interest_keywords) {
    const overlap = context.thread_keywords.filter((k) =>
      campaign.ad_targeting.interest_keywords.includes(k)
    ).length;
    if (context.thread_keywords.length > 0) {
      score += (overlap / context.thread_keywords.length) * 0.4;
    }
  }

  score += (campaign.bid_amount_cents / MAX_BID) * 0.2;

  return Math.min(score, 1.0);
}

function isCampaignEligible(campaign: any): boolean {
  if (campaign.status !== 'active') return false;
  if (campaign.spent_cents >= campaign.daily_budget_cents) return false;

  const now = new Date();
  if (new Date(campaign.start_date) > now) return false;
  if (campaign.end_date && new Date(campaign.end_date) < now) return false;

  return true;
}

async function serveAd(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();

  try {
    const context = req.body as AdContext;

    if (!context.placement) {
      return res.status(400).json({ error: 'placement is required' });
    }

    const validPlacements = ['feed', 'sidebar', 'thread', 'marketplace'];
    if (!validPlacements.includes(context.placement)) {
      return res.status(400).json({ error: 'Invalid placement' });
    }

    const supabase = getSupabaseClient();

    // Get user segments (could be cached in Redis for production)
    let userSegments: string[] = [];
    if (context.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('interests')
        .eq('id', context.user_id)
        .single();
      userSegments = profile?.interests || [];
    }

    const { data: campaigns } = await supabase
      .from('ad_campaigns')
      .select('*, ad_creatives!inner(*), ad_targeting!inner(*)')
      .eq('status', 'active');

    const eligible = (campaigns || []).filter(isCampaignEligible);

    if (eligible.length === 0) {
      return res.status(200).json({ ad: null, reason: 'no_eligible_campaigns' });
    }

    const scored = eligible.map((campaign) => ({
      campaign,
      score: calculateRelevanceScore(campaign, context, userSegments),
    }));

    const qualified = scored
      .filter((s) => s.score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (qualified.length === 0) {
      return res.status(200).json({ ad: null, reason: 'no_relevant_ads' });
    }

    const selected = qualified[0];
    const duration = Date.now() - startTime;

    res.setHeader('X-Serve-Time', `${duration}ms`);

    return res.status(200).json({
      ad: {
        campaign_id: selected.campaign.id,
        creative: selected.campaign.ad_creatives[0],
        score: selected.score,
      },
      performance: {
        duration_ms: duration,
      },
    });
  } catch (error) {
    console.error('Ad serving error:', error);
    return res.status(500).json({ ad: null, reason: 'error' });
  }
}

async function trackImpression(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { campaign_id, creative_id, user_id, placement, thread_id, is_viewable } = req.body;

    if (!campaign_id || !placement) {
      return res.status(400).json({ error: 'campaign_id and placement are required' });
    }

    const supabase = getSupabaseClient();

    await supabase.from('ad_impressions').insert({
      campaign_id,
      creative_id,
      user_id,
      placement,
      thread_id,
      is_viewable,
      created_at: new Date().toISOString(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Impression tracking error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { pathname } = new URL(req.url || '', `http://${req.headers.host}`);

  // Affiliate routes
  if (pathname === '/api/v1/marketing/affiliate/campaigns') {
    if (req.method === 'GET') return listCampaigns(req, res);
    if (req.method === 'POST') return createCampaign(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (pathname === '/api/v1/marketing/affiliate/commissions') {
    if (req.method === 'POST') return calculateCommission(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (pathname === '/api/v1/marketing/affiliate/fraud') {
    if (req.method === 'POST') return detectFraud(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Advertising routes
  if (pathname === '/api/v1/marketing/ads/serve') {
    if (req.method === 'POST') return serveAd(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (pathname === '/api/v1/marketing/ads/track') {
    if (req.method === 'POST') return trackImpression(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Legacy route support (redirect old paths)
  if (pathname.startsWith('/api/affiliate/')) {
    const newPath = pathname.replace('/api/affiliate/', '/api/v1/marketing/affiliate/');
    return res.redirect(308, newPath);
  }

  if (pathname.startsWith('/api/advertising/')) {
    const newPath = pathname.replace('/api/advertising/', '/api/v1/marketing/ads/');
    return res.redirect(308, newPath);
  }

  return res.status(404).json({ error: 'Not found' });
}
