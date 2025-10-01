// Rate limiting middleware for authentication and API endpoints
// Prevents brute force attacks and API abuse

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { trackRateLimitViolation } from '../lib/metrics';

// Disable rate limiting in production serverless AND development
// In-memory rate limiting doesn't work in stateless serverless functions
// TODO: Implement distributed rate limiting with Vercel KV
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const skipRateLimiting = (isProduction || isDevelopment) ? () => true : undefined;

/**
 * Rate limiter for authentication endpoints
 * Currently disabled in production/dev - see TODO above
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimiting,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Rate limiter for general API endpoints
 * Currently disabled in production/dev - see TODO above
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimiting,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Rate limiter for sensitive operations
 * Currently disabled in production/dev - see TODO above
 */
export const sensitiveOperationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimiting,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});

/**
 * Per-user rate limiter
 * Currently disabled in production/dev - see TODO above
 */
export const userRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimiting,
  validate: {
    trustProxy: false,
    xForwardedForHeader: false,
  },
});
