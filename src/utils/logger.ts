// Shared Winston logger for platform services
import winston from 'winston';
import crypto from 'crypto';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' })
    ] : [])
  ]
});

/**
 * SECURITY: Sanitization helpers to prevent PII exposure in logs
 */

/**
 * Sanitize user ID for logging
 * Returns first 8 characters + hash suffix to prevent PII exposure
 */
export function sanitizeUserId(userId: string | undefined | null): string {
  if (!userId) return 'unknown';

  // In development, show full ID for debugging
  if (process.env.NODE_ENV === 'development') {
    return userId;
  }

  // In production, truncate and hash
  const prefix = userId.substring(0, 8);
  const hash = crypto.createHash('sha256').update(userId).digest('hex').substring(0, 8);
  return `${prefix}...${hash}`;
}

/**
 * Sanitize connection ID for logging
 * Returns truncated version to prevent correlation attacks
 */
export function sanitizeConnectionId(connectionId: string | undefined | null): string {
  if (!connectionId) return 'unknown';

  // In development, show full ID
  if (process.env.NODE_ENV === 'development') {
    return connectionId;
  }

  // In production, show only first 12 chars
  return `${connectionId.substring(0, 12)}...`;
}

/**
 * Sanitize error for logging
 * Removes sensitive details while preserving debugging information
 */
export function sanitizeError(error: unknown): {
  message: string;
  code?: string;
  type?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: (error as any).code,
      type: error.constructor.name,
    };
  }

  if (typeof error === 'object' && error !== null) {
    return {
      message: (error as any).message || 'Unknown error',
      code: (error as any).code,
      type: typeof error,
    };
  }

  return {
    message: String(error),
    type: typeof error,
  };
}

/**
 * Sanitize object for logging
 * Removes common sensitive fields
 */
export function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'password',
    'token',
    'api_key',
    'apiKey',
    'secret',
    'authorization',
    'cookie',
    'session',
    'jwt',
    'bearer',
    'credit_card',
    'ssn',
    'private_key',
  ];

  const sanitized = { ...obj };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();

    // Redact sensitive fields
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    // Recursively sanitize nested objects
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  }

  return sanitized;
}

export default logger;
