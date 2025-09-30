// Task: T071 - Per-user rate limiting
// Description: Rate limiting middleware with per-user quotas

import { VercelRequest, VercelResponse } from '@vercel/node';

interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  burstSize: number;
}

interface UserRateLimitInfo {
  userId: string;
  requestTimestamps: number[];
  lastCleanup: number;
}

// In-memory store for rate limiting (use Redis/Upstash in production)
const rateLimitStore = new Map<string, UserRateLimitInfo>();

// Cleanup interval (remove old entries every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastGlobalCleanup = Date.now();

// Rate limit configurations by tier
const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  free: {
    requestsPerSecond: 5,
    requestsPerMinute: 100,
    requestsPerHour: 1000,
    burstSize: 10,
  },
  premium: {
    requestsPerSecond: 20,
    requestsPerMinute: 500,
    requestsPerHour: 10000,
    burstSize: 40,
  },
  enterprise: {
    requestsPerSecond: 100,
    requestsPerMinute: 5000,
    requestsPerHour: 100000,
    burstSize: 200,
  },
};

/**
 * Per-user rate limiting middleware
 * Enforces request limits based on user subscription tier
 */
export async function userRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  next: () => Promise<void>
): Promise<void> {
  // Extract user ID from auth context (set by auth middleware)
  const userId = (req as any).authContext?.userId;
  const subscriptionTier = (req as any).authContext?.subscriptionTier || 'free';

  if (!userId) {
    // No user ID means auth middleware hasn't run or user is not authenticated
    // Let it pass through (auth middleware will handle it)
    return next();
  }

  // Get rate limit config for user's tier
  const config = RATE_LIMIT_TIERS[subscriptionTier] || RATE_LIMIT_TIERS.free;

  // Check rate limits
  const now = Date.now();
  const result = checkRateLimit(userId, config, now);

  if (!result.allowed) {
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', String(config.requestsPerMinute));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(result.resetTime));
    res.setHeader('Retry-After', String(Math.ceil(result.retryAfter / 1000)));

    res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfter / 1000)} seconds.`,
      limit: config.requestsPerMinute,
      remaining: result.remaining,
      resetTime: result.resetTime,
    });
    return;
  }

  // Set rate limit headers for successful requests
  res.setHeader('X-RateLimit-Limit', String(config.requestsPerMinute));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(result.resetTime));

  // Record request
  recordRequest(userId, now);

  // Periodic cleanup
  if (now - lastGlobalCleanup > CLEANUP_INTERVAL) {
    cleanupOldEntries(now);
    lastGlobalCleanup = now;
  }

  return next();
}

/**
 * Check if user is within rate limits
 */
function checkRateLimit(
  userId: string,
  config: RateLimitConfig,
  now: number
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number;
} {
  const userInfo = rateLimitStore.get(userId) || {
    userId,
    requestTimestamps: [],
    lastCleanup: now,
  };

  // Clean up old timestamps
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneMinuteAgo = now - 60 * 1000;
  const oneSecondAgo = now - 1000;

  userInfo.requestTimestamps = userInfo.requestTimestamps.filter(
    (timestamp) => timestamp > oneHourAgo
  );

  // Count requests in different time windows
  const requestsLastSecond = userInfo.requestTimestamps.filter(
    (timestamp) => timestamp > oneSecondAgo
  ).length;

  const requestsLastMinute = userInfo.requestTimestamps.filter(
    (timestamp) => timestamp > oneMinuteAgo
  ).length;

  const requestsLastHour = userInfo.requestTimestamps.length;

  // Check against limits
  let allowed = true;
  let limitType = 'minute';
  let remaining = config.requestsPerMinute - requestsLastMinute;
  let resetTime = oneMinuteAgo + 60 * 1000;
  let retryAfter = 0;

  // Check per-second limit
  if (requestsLastSecond >= config.requestsPerSecond) {
    allowed = false;
    limitType = 'second';
    remaining = Math.max(0, config.requestsPerSecond - requestsLastSecond);
    resetTime = oneSecondAgo + 1000;
    retryAfter = resetTime - now;
  }

  // Check per-minute limit
  if (allowed && requestsLastMinute >= config.requestsPerMinute) {
    allowed = false;
    limitType = 'minute';
    remaining = Math.max(0, config.requestsPerMinute - requestsLastMinute);
    resetTime = oneMinuteAgo + 60 * 1000;
    retryAfter = resetTime - now;
  }

  // Check per-hour limit
  if (allowed && requestsLastHour >= config.requestsPerHour) {
    allowed = false;
    limitType = 'hour';
    remaining = Math.max(0, config.requestsPerHour - requestsLastHour);
    resetTime = oneHourAgo + 60 * 60 * 1000;
    retryAfter = resetTime - now;
  }

  // Check burst size (max requests in a very short time)
  const recentBurst = userInfo.requestTimestamps.filter(
    (timestamp) => timestamp > now - 100 // Last 100ms
  ).length;

  if (allowed && recentBurst >= config.burstSize) {
    allowed = false;
    limitType = 'burst';
    remaining = 0;
    resetTime = now + 1000;
    retryAfter = 1000;
  }

  return {
    allowed,
    remaining,
    resetTime,
    retryAfter,
  };
}

/**
 * Record a request for a user
 */
function recordRequest(userId: string, timestamp: number): void {
  const userInfo = rateLimitStore.get(userId) || {
    userId,
    requestTimestamps: [],
    lastCleanup: timestamp,
  };

  userInfo.requestTimestamps.push(timestamp);
  userInfo.lastCleanup = timestamp;

  rateLimitStore.set(userId, userInfo);
}

/**
 * Clean up old entries from rate limit store
 */
function cleanupOldEntries(now: number): void {
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;

  for (const [userId, userInfo] of rateLimitStore.entries()) {
    // Remove users with no recent requests
    if (userInfo.lastCleanup < twoHoursAgo) {
      rateLimitStore.delete(userId);
      continue;
    }

    // Clean up old timestamps
    const oneHourAgo = now - 60 * 60 * 1000;
    userInfo.requestTimestamps = userInfo.requestTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    );

    if (userInfo.requestTimestamps.length === 0) {
      rateLimitStore.delete(userId);
    }
  }
}

/**
 * Get rate limit statistics (for monitoring/debugging)
 */
export function getRateLimitStats(): {
  totalUsers: number;
  totalRequests: number;
  storeSize: number;
} {
  let totalRequests = 0;

  for (const userInfo of rateLimitStore.values()) {
    totalRequests += userInfo.requestTimestamps.length;
  }

  return {
    totalUsers: rateLimitStore.size,
    totalRequests,
    storeSize: rateLimitStore.size,
  };
}

/**
 * Clear rate limit store (for testing)
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
  lastGlobalCleanup = Date.now();
}