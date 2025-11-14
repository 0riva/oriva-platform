// Rate limiting middleware for authentication and API endpoints
// Prevents brute force attacks and API abuse

import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { trackRateLimitViolation } from '../lib/metrics';

// Extend Express Request to include rate limit info
declare global {
  namespace Express {
    interface Request {
      rateLimit?: {
        limit: number;
        current: number;
        remaining: number;
        resetTime: Date;
      };
    }
  }
}

// SECURITY: Rate limiting now enabled in production using Redis
// Falls back to in-memory for development/testing
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Configure Redis store for production distributed rate limiting
let store: any = undefined;

if (isProduction && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const { Redis } = require('@upstash/redis');
    const RedisStore = require('rate-limit-redis').default;

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    store = new RedisStore({
      client: redis,
      prefix: 'rl:',
    });

    logger.info('Rate limiting enabled with Redis store');
  } catch (error) {
    logger.error('Failed to initialize Redis store for rate limiting', { error });
    logger.warn('Falling back to in-memory rate limiting (not recommended for production)');
  }
} else if (isProduction) {
  logger.warn('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured - rate limiting may not work correctly in serverless');
}

// Skip rate limiting only in development when explicitly disabled
const skipRateLimiting = isDevelopment && process.env.DISABLE_RATE_LIMIT === 'true' ? () => true : undefined;

/**
 * Rate limiter for authentication endpoints
 * SECURITY: Protects against brute force attacks
 * - 5 attempts per 15 minutes
 * - Uses distributed Redis store in production
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimiting,
  store,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for auth endpoint', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });
    trackRateLimitViolation(req.ip || 'unknown', 'auth');
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 900000) / 1000),
    });
  },
  validate: {
    trustProxy: true, // Trust Vercel's proxy
    xForwardedForHeader: false,
  },
});

/**
 * Rate limiter for general API endpoints
 * SECURITY: Protects against API abuse
 * - 100 requests per 15 minutes for unauthenticated
 * - Uses distributed Redis store in production
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimiting,
  store,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for API endpoint', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });
    trackRateLimitViolation(req.ip || 'unknown', 'api');
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 900000) / 1000),
    });
  },
  validate: {
    trustProxy: true,
    xForwardedForHeader: false,
  },
});

/**
 * Rate limiter for sensitive operations
 * SECURITY: Strict limits for critical operations (password reset, API key generation, etc.)
 * - 3 requests per hour
 * - Uses distributed Redis store in production
 */
export const sensitiveOperationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimiting,
  store,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for sensitive operation', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });
    trackRateLimitViolation(req.ip || 'unknown', 'sensitive');
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many sensitive operations. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 3600000) / 1000),
    });
  },
  validate: {
    trustProxy: true,
    xForwardedForHeader: false,
  },
});

/**
 * Per-user rate limiter
 * SECURITY: Generous limits for authenticated users
 * - 1000 requests per hour
 * - Uses distributed Redis store in production
 */
export const userRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimiting,
  store,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded for user', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('user-agent'),
    });
    trackRateLimitViolation(req.ip || 'unknown', 'user');
    res.status(429).json({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((req.rateLimit?.resetTime?.getTime() || Date.now() + 3600000) / 1000),
    });
  },
  validate: {
    trustProxy: true,
    xForwardedForHeader: false,
  },
});
