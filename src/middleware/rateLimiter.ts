// Rate limiting middleware for authentication and API endpoints
// Prevents brute force attacks and API abuse

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { trackRateLimitViolation } from '../lib/metrics';

/**
 * Rate limiter for authentication endpoints
 * Stricter limits to prevent brute force attacks on login/auth
 *
 * Limits:
 * - 5 requests per 15 minutes per IP
 * - Resets after successful authentication
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    ok: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers

  // Custom handler for rate limit exceeded
  handler: (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).authContext?.userId || 'anonymous';

    logger.warn('Authentication rate limit exceeded', {
      ip,
      userId,
      path: req.path,
      userAgent: req.headers['user-agent'],
    });

    // Track rate limit violation in metrics
    trackRateLimitViolation(userId, 'auth');

    res.status(429).json({
      ok: false,
      error: 'Too many authentication attempts, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes',
    });
  },

  // Skip rate limiting for successful requests (optional)
  skip: (req: Request) => {
    // Skip if request has valid auth context (already authenticated)
    return !!(req as any).authContext;
  },

  // Key generator - use IP address by default
  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Rate limiter for general API endpoints
 * Less strict than auth limiter but prevents API abuse
 *
 * Limits:
 * - 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    ok: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).authContext?.userId || 'anonymous';

    logger.warn('API rate limit exceeded', {
      ip,
      userId,
      path: req.path,
      userAgent: req.headers['user-agent'],
    });

    trackRateLimitViolation(userId, 'api');

    res.status(429).json({
      ok: false,
      error: 'Too many requests, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes',
    });
  },

  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Stricter rate limiter for sensitive operations
 * Used for operations like password reset, account deletion, etc.
 *
 * Limits:
 * - 3 requests per hour per IP
 */
export const sensitiveOperationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    ok: false,
    error: 'Too many sensitive operation attempts, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const userId = (req as any).authContext?.userId || 'anonymous';

    logger.warn('Sensitive operation rate limit exceeded', {
      ip,
      userId,
      path: req.path,
      userAgent: req.headers['user-agent'],
    });

    trackRateLimitViolation(userId, 'sensitive');

    res.status(429).json({
      ok: false,
      error: 'Too many sensitive operation attempts, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour',
    });
  },

  keyGenerator: (req: Request) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

/**
 * Per-user rate limiter
 * Tracks rate limits per authenticated user rather than IP
 * Useful for preventing authenticated user abuse
 *
 * Limits:
 * - 1000 requests per hour per user
 */
export const userRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // Limit each user to 1000 requests per hour
  message: {
    ok: false,
    error: 'User request quota exceeded, please try again later',
    code: 'USER_RATE_LIMIT_EXCEEDED',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req: Request, res: Response) => {
    const userId = (req as any).authContext?.userId || 'anonymous';

    logger.warn('User rate limit exceeded', {
      userId,
      path: req.path,
    });

    trackRateLimitViolation(userId, 'user');

    res.status(429).json({
      ok: false,
      error: 'User request quota exceeded, please try again later',
      code: 'USER_RATE_LIMIT_EXCEEDED',
      retryAfter: '1 hour',
    });
  },

  // Key by user ID instead of IP
  keyGenerator: (req: Request) => {
    const userId = (req as any).authContext?.userId;
    if (!userId) {
      // Fall back to IP if no user context
      return req.ip || req.socket.remoteAddress || 'unknown';
    }
    return `user:${userId}`;
  },

  // Skip for unauthenticated requests (they'll be caught by IP rate limiter)
  skip: (req: Request) => {
    return !(req as any).authContext;
  },
});
