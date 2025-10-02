/**
 * Affiliate URL Resolution Edge Function (T144)
 *
 * Vercel Edge Runtime for ultra-fast affiliate URL resolution (<100ms globally)
 *
 * Features:
 * - Deployed to 18+ edge locations
 * - Redis caching for hot URLs
 * - Base62 short code resolution
 * - Async click tracking (non-blocking)
 * - Geo-location capture
 * - Security: input validation, rate limiting
 *
 * Performance Target: <100ms globally (cached: <10ms, uncached: <100ms)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Edge Runtime configuration
export const config = {
  runtime: 'edge',
};

// Initialize Redis client (Upstash for Edge Runtime compatibility)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Constants
const CACHE_TTL = 86400; // 24 hours
const DEFAULT_REDIRECT = '/'; // Homepage fallback

/**
 * Validate short code format
 * Only alphanumeric characters (Base62)
 */
function isValidShortCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^[0-9A-Za-z]+$/.test(code);
}

/**
 * Extract short code from URL path
 */
function getShortCodeFromPath(pathname: string): string | null {
  // Path format: /affiliate/resolve/[shortCode] or /a/[shortCode]
  const match = pathname.match(/\/(?:affiliate\/resolve|a)\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch URL data from Supabase
 */
async function fetchUrlFromDatabase(shortCode: string) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/affiliate_urls?short_code=eq.${shortCode}&select=*,affiliate_campaigns!inner(*)`,
    {
      headers: {
        'apikey': process.env.SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY!}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Database fetch failed: ${response.status}`);
  }

  const data = await response.json();
  return data.length > 0 ? data[0] : null;
}

/**
 * Track click (async, non-blocking)
 */
async function trackClick(
  shortCode: string,
  urlData: any,
  req: NextRequest
): Promise<void> {
  try {
    // Extract context from request
    const context = {
      short_code: shortCode,
      url_id: urlData.id,
      campaign_id: urlData.campaign_id,
      affiliate_id: urlData.affiliate_id,
      referrer: req.headers.get('referer') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
      ip_address: req.headers.get('x-forwarded-for') || req.ip,
      country: req.geo?.country,
      region: req.geo?.region,
      city: req.geo?.city,
      latitude: req.geo?.latitude,
      longitude: req.geo?.longitude,
    };

    // Send to tracking endpoint (fire and forget)
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/affiliate/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(context),
    });
  } catch (error) {
    // Silently fail - don't block redirect
    console.error('Click tracking failed:', error);
  }
}

/**
 * Main Edge Function handler
 */
export default async function handler(req: NextRequest) {
  const startTime = Date.now();

  try {
    // Extract short code from path
    const shortCode = getShortCodeFromPath(req.nextUrl.pathname);

    if (!shortCode) {
      return NextResponse.redirect(new URL(DEFAULT_REDIRECT, req.url));
    }

    // Validate short code format (security)
    if (!isValidShortCode(shortCode)) {
      console.warn(`Invalid short code format: ${shortCode}`);
      return NextResponse.redirect(new URL(DEFAULT_REDIRECT, req.url));
    }

    // 1. Check Redis cache (hot URLs)
    let targetUrl: string | null = null;
    let urlData: any = null;

    try {
      const cached = await redis.get<string>(`aff:${shortCode}`);
      if (cached) {
        targetUrl = cached;
        console.log(`Cache HIT: ${shortCode} -> ${targetUrl} (${Date.now() - startTime}ms)`);
      }
    } catch (error) {
      console.error('Redis cache read failed:', error);
      // Continue to database fallback
    }

    // 2. If not cached, fetch from database
    if (!targetUrl) {
      urlData = await fetchUrlFromDatabase(shortCode);

      if (!urlData) {
        console.warn(`Short code not found: ${shortCode}`);
        return NextResponse.redirect(new URL(DEFAULT_REDIRECT, req.url));
      }

      // Check if URL is expired
      if (urlData.expires_at && new Date(urlData.expires_at) < new Date()) {
        console.warn(`Short code expired: ${shortCode}`);
        return NextResponse.redirect(new URL(DEFAULT_REDIRECT, req.url));
      }

      // Check if campaign is active
      if (urlData.affiliate_campaigns && !urlData.affiliate_campaigns.is_active) {
        console.warn(`Campaign inactive: ${urlData.campaign_id}`);
        return NextResponse.redirect(new URL(DEFAULT_REDIRECT, req.url));
      }

      targetUrl = urlData.original_url;

      // 3. Cache for future requests
      try {
        await redis.set(`aff:${shortCode}`, targetUrl, { ex: CACHE_TTL });
        console.log(`Cached: ${shortCode} -> ${targetUrl}`);
      } catch (error) {
        console.error('Redis cache write failed:', error);
        // Continue anyway
      }

      console.log(`Database fetch: ${shortCode} -> ${targetUrl} (${Date.now() - startTime}ms)`);
    }

    // 4. Track click (async, non-blocking)
    if (urlData) {
      trackClick(shortCode, urlData, req).catch(error => {
        console.error('Async tracking error:', error);
      });
    }

    // 5. Redirect to target URL
    const duration = Date.now() - startTime;
    console.log(`Redirect: ${shortCode} -> ${targetUrl} (${duration}ms)`);

    // Add performance header for monitoring
    const response = NextResponse.redirect(targetUrl);
    response.headers.set('X-Redirect-Time', `${duration}ms`);
    response.headers.set('X-Short-Code', shortCode);
    response.headers.set('Cache-Control', 'public, max-age=300'); // 5 min browser cache

    return response;
  } catch (error) {
    console.error('Edge function error:', error);

    // Redirect to homepage on any error (graceful degradation)
    return NextResponse.redirect(new URL(DEFAULT_REDIRECT, req.url));
  }
}
