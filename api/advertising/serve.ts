/**
 * Ad Serving Edge Function (T162)
 *
 * Vercel Edge Runtime for ultra-fast ad serving (<50ms globally)
 *
 * Features:
 * - Deployed to 18+ edge locations
 * - Redis caching for user segments
 * - Real-time relevance scoring
 * - Budget validation
 * - Async impression tracking
 * - Fraud prevention
 *
 * Performance Target: <50ms globally
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Serverless Function configuration (changed from edge due to @upstash/redis compatibility)
export const config = {
  runtime: 'nodejs',
};

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Constants
const SEGMENT_CACHE_TTL = 86400; // 24 hours
const RELEVANCE_THRESHOLD = 0.3; // Minimum score to show ad
const MAX_BID = 10000; // $100.00 max bid for scoring

interface AdContext {
  user_id?: string;
  thread_id?: string;
  placement: 'feed' | 'sidebar' | 'thread' | 'marketplace';
  user_interests?: string[];
  thread_keywords?: string[];
}

/**
 * Get user segments (cached)
 */
async function getUserSegments(userId?: string): Promise<string[]> {
  if (!userId) return [];

  try {
    const cached = await redis.get<string>(`segments:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Redis get error:', error);
  }

  return [];
}

/**
 * Calculate relevance score for an ad
 */
function calculateRelevanceScore(
  campaign: any,
  context: AdContext,
  userSegments: string[]
): number {
  let score = 0;

  // Segment match (40% weight)
  if (userSegments.length > 0 && campaign.ad_targeting?.interest_keywords) {
    const segmentOverlap = userSegments.filter((s) =>
      campaign.ad_targeting.interest_keywords.includes(s)
    ).length;

    score += (segmentOverlap / userSegments.length) * 0.4;
  }

  // Keyword match (40% weight)
  if (context.thread_keywords && campaign.ad_targeting?.interest_keywords) {
    const keywordOverlap = context.thread_keywords.filter((k) =>
      campaign.ad_targeting.interest_keywords.includes(k)
    ).length;

    if (context.thread_keywords.length > 0) {
      score += (keywordOverlap / context.thread_keywords.length) * 0.4;
    }
  }

  // Bid amount (20% weight)
  score += (campaign.bid_amount_cents / MAX_BID) * 0.2;

  return Math.min(score, 1.0);
}

/**
 * Validate campaign is active and has budget
 */
function isCampaignEligible(campaign: any): boolean {
  // Check active status
  if (campaign.status !== 'active') return false;

  // Check budget
  if (campaign.spent_cents >= campaign.daily_budget_cents) return false;

  // Check date range
  const now = new Date();
  const startDate = new Date(campaign.start_date);
  if (startDate > now) return false;

  if (campaign.end_date) {
    const endDate = new Date(campaign.end_date);
    if (endDate < now) return false;
  }

  return true;
}

/**
 * Track impression (async, non-blocking)
 */
async function trackImpression(campaign: any, context: AdContext): Promise<void> {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/advertising/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaign_id: campaign.id,
        creative_id: campaign.ad_creatives?.[0]?.id,
        user_id: context.user_id,
        placement: context.placement,
        thread_id: context.thread_id,
        is_viewable: true,
      }),
    });
  } catch (error) {
    console.error('Impression tracking failed:', error);
    // Don't throw - tracking failures shouldn't block ad serving
  }
}

/**
 * Validate request (fraud prevention)
 */
function validateRequest(req: NextRequest): boolean {
  const userAgent = req.headers.get('user-agent');

  // Check for bot user agents
  if (!userAgent || /(bot|crawler|spider)/i.test(userAgent)) {
    return false;
  }

  return true;
}

/**
 * Main Edge Function handler
 */
export default async function handler(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Validate request (fraud prevention)
    if (!validateRequest(req)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Parse context
    const context = (await req.json()) as AdContext;

    // Validate required fields
    if (!context.placement) {
      return NextResponse.json({ error: 'placement is required' }, { status: 400 });
    }

    const validPlacements = ['feed', 'sidebar', 'thread', 'marketplace'];
    if (!validPlacements.includes(context.placement)) {
      return NextResponse.json({ error: 'Invalid placement' }, { status: 400 });
    }

    // Get user segments (cached)
    const userSegments = await getUserSegments(context.user_id);

    // Fetch active campaigns
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/ad_campaigns?status=eq.active&select=*,ad_creatives!inner(*),ad_targeting!inner(*)`,
      {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Database fetch failed: ${response.status}`);
    }

    const campaigns = (await response.json()) as any[];

    // Filter eligible campaigns
    const eligible = campaigns.filter((c: any) => isCampaignEligible(c));

    if (eligible.length === 0) {
      return NextResponse.json({ ad: null, reason: 'no_eligible_campaigns' });
    }

    // Score and sort campaigns
    const scored = eligible.map((campaign: any) => ({
      campaign,
      score: calculateRelevanceScore(campaign, context, userSegments),
    }));

    // Filter by threshold and sort by score
    const qualified = scored
      .filter((s) => s.score >= RELEVANCE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    if (qualified.length === 0) {
      return NextResponse.json({ ad: null, reason: 'no_relevant_ads' });
    }

    // Select top ad
    const selected = qualified[0];

    // Track impression (async, non-blocking)
    trackImpression(selected.campaign, context).catch((error) => {
      console.error('Async tracking error:', error);
    });

    const duration = Date.now() - startTime;
    console.log(
      `Ad served: ${selected.campaign.id} (score: ${selected.score.toFixed(2)}, ${duration}ms)`
    );

    // Return ad with creative
    const result = {
      ad: {
        campaign_id: selected.campaign.id,
        creative: selected.campaign.ad_creatives[0],
        score: selected.score,
      },
      performance: {
        duration_ms: duration,
        cache_hit: userSegments.length > 0,
      },
    };

    const jsonResponse = NextResponse.json(result);
    jsonResponse.headers.set('X-Serve-Time', `${duration}ms`);
    jsonResponse.headers.set('Cache-Control', 'public, max-age=60'); // 1 min cache

    return jsonResponse;
  } catch (error) {
    console.error('Ad serving error:', error);

    // Return empty response on error (graceful degradation)
    return NextResponse.json(
      {
        ad: null,
        reason: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
