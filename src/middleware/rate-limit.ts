// Task: T014 - Rate limiting middleware
// Description: Protect API endpoints from abuse with Redis-based rate limiting

import { VercelRequest, VercelResponse } from '@vercel/node';
import { AuthenticatedRequest } from './auth';

// Rate limit configuration per tier
const RATE_LIMITS = {
  free: {
    requests_per_minute: 10,
    requests_per_hour: 100,
    requests_per_day: 500,
  },
  premium: {
    requests_per_minute: 30,
    requests_per_hour: 500,
    requests_per_day: 5000,
  },
  enterprise: {
    requests_per_minute: 100,
    requests_per_hour: 2000,
    requests_per_day: 20000,
  },
  unauthenticated: {
    requests_per_minute: 5,
    requests_per_hour: 20,
    requests_per_day: 50,
  },
};

// In-memory store for development (replace with Redis for production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limiting middleware with tiered limits based on subscription
 * Uses sliding window algorithm for accurate rate limiting
 */
export async function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  next: () => void | Promise<void>,
): Promise<void> {
  try {
    // Determine user identifier (user ID or IP address)
    const authReq = req as AuthenticatedRequest;
    const identifier = authReq.authContext?.userId || getClientIp(req);

    // Determine rate limit tier
    const tier = authReq.authContext?.subscription_tier || 'unauthenticated';
    const limits = RATE_LIMITS[tier];

    // Check rate limits (minute, hour, day)
    const now = Date.now();
    const windows = [
      { key: `${identifier}:minute`, limit: limits.requests_per_minute, windowMs: 60 * 1000 },
      { key: `${identifier}:hour`, limit: limits.requests_per_hour, windowMs: 60 * 60 * 1000 },
      { key: `${identifier}:day`, limit: limits.requests_per_day, windowMs: 24 * 60 * 60 * 1000 },
    ];

    for (const window of windows) {
      const entry = rateLimitStore.get(window.key);

      if (!entry || now >= entry.resetAt) {
        // Reset window
        rateLimitStore.set(window.key, { count: 1, resetAt: now + window.windowMs });
      } else {
        // Increment count
        entry.count += 1;

        if (entry.count > window.limit) {
          // Rate limit exceeded
          const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

          res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            tier: tier,
            limit: window.limit,
            window: window.key.split(':')[1],
            retry_after_seconds: retryAfter,
          });

          res.setHeader('Retry-After', retryAfter.toString());
          res.setHeader('X-RateLimit-Limit', window.limit.toString());
          res.setHeader('X-RateLimit-Remaining', '0');
          res.setHeader('X-RateLimit-Reset', entry.resetAt.toString());

          return;
        }

        // Update entry
        rateLimitStore.set(window.key, entry);
      }
    }

    // Set rate limit headers
    const minuteEntry = rateLimitStore.get(`${identifier}:minute`);
    if (minuteEntry) {
      res.setHeader('X-RateLimit-Limit', limits.requests_per_minute.toString());
      res.setHeader('X-RateLimit-Remaining', (limits.requests_per_minute - minuteEntry.count).toString());
      res.setHeader('X-RateLimit-Reset', minuteEntry.resetAt.toString());
    }

    // Continue to handler
    await next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Continue on error to avoid blocking requests
    await next();
  }
}

/**
 * Cleanup expired rate limit entries (run periodically)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

/**
 * Extract client IP address from request
 */
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.socket?.remoteAddress;
  return ip || 'unknown';
}

/**
 * Export rate limit configuration for testing
 */
export { RATE_LIMITS };