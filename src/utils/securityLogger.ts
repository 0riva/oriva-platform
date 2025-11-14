/**
 * Security Event Logger
 * SECURITY MONITORING: Centralized logging for security-related events
 *
 * All security events are logged with consistent structure for:
 * - SIEM integration
 * - Alert triggering
 * - Audit trails
 * - Incident investigation
 */

import { logger, sanitizeUserId } from './logger';

/**
 * Security event types
 */
export enum SecurityEventType {
  // Authentication & Authorization
  AUTH_FAILED = 'auth_failed',
  AUTH_SUCCESS = 'auth_success',
  TOKEN_EXPIRED = 'token_expired',
  TOKEN_REFRESH_REQUIRED = 'token_refresh_required',
  INVALID_API_KEY = 'invalid_api_key',
  API_KEY_USED = 'api_key_used',
  PRIVILEGED_OPERATION = 'privileged_operation',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  RATE_LIMIT_WARNING = 'rate_limit_warning',

  // Request Validation
  CORS_VIOLATION = 'cors_violation',
  CONTENT_TYPE_REJECTED = 'content_type_rejected',
  HTTPS_REQUIRED = 'https_required',
  INVALID_INPUT = 'invalid_input',

  // Access Control
  FORBIDDEN_ACCESS = 'forbidden_access',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SCHEMA_ACCESS_DENIED = 'schema_access_denied',
}

/**
 * Base security event interface
 */
interface SecurityEvent {
  event: SecurityEventType;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  path?: string;
  method?: string;
  timestamp: string;
}

/**
 * Security event logger
 */
export const securityEvents = {
  /**
   * Authentication failure
   */
  authFailed: (
    reason: string,
    metadata: {
      requestId?: string;
      ip?: string;
      userAgent?: string;
      path?: string;
    }
  ) => {
    logger.warn('Security: Authentication failed', {
      event: SecurityEventType.AUTH_FAILED,
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Successful authentication
   */
  authSuccess: (
    userId: string,
    method: 'jwt' | 'api_key',
    metadata: {
      requestId?: string;
      ip?: string;
    }
  ) => {
    logger.info('Security: Authentication successful', {
      event: SecurityEventType.AUTH_SUCCESS,
      userId: sanitizeUserId(userId),
      method,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Expired JWT token
   */
  expiredToken: (
    userId: string,
    expiresAt: string,
    metadata: {
      requestId?: string;
      ip?: string;
    }
  ) => {
    logger.warn('Security: Expired token rejected', {
      event: SecurityEventType.TOKEN_EXPIRED,
      userId: sanitizeUserId(userId),
      expiresAt,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Token expiring soon (refresh needed)
   */
  tokenRefreshRequired: (
    userId: string,
    expiresIn: number,
    metadata: {
      requestId?: string;
    }
  ) => {
    logger.info('Security: Token refresh required', {
      event: SecurityEventType.TOKEN_REFRESH_REQUIRED,
      userId: sanitizeUserId(userId),
      expiresInSeconds: expiresIn,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Invalid API key
   */
  invalidApiKey: (
    keyPrefix: string,
    metadata: {
      requestId?: string;
      ip?: string;
      path?: string;
    }
  ) => {
    logger.warn('Security: Invalid API key', {
      event: SecurityEventType.INVALID_API_KEY,
      keyPrefix,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Successful API key usage
   */
  apiKeyUsed: (
    keyId: string,
    appId: string,
    metadata: {
      requestId?: string;
      ip?: string;
      path?: string;
    }
  ) => {
    logger.info('Security: API key used', {
      event: SecurityEventType.API_KEY_USED,
      keyId,
      appId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Rate limit exceeded
   */
  rateLimitExceeded: (
    metadata: {
      ip: string;
      path: string;
      limit: number;
      current: number;
      requestId?: string;
    }
  ) => {
    logger.warn('Security: Rate limit exceeded', {
      event: SecurityEventType.RATE_LIMIT_EXCEEDED,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Rate limit warning (approaching limit)
   */
  rateLimitWarning: (
    metadata: {
      ip: string;
      path: string;
      limit: number;
      current: number;
      remaining: number;
      requestId?: string;
    }
  ) => {
    logger.info('Security: Rate limit warning', {
      event: SecurityEventType.RATE_LIMIT_WARNING,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * CORS violation
   */
  corsViolation: (
    origin: string | undefined,
    reason: string,
    metadata: {
      requestId?: string;
      ip?: string;
      path?: string;
      method?: string;
    }
  ) => {
    logger.warn('Security: CORS violation', {
      event: SecurityEventType.CORS_VIOLATION,
      origin: origin || 'missing',
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Content-Type validation failure
   */
  contentTypeRejected: (
    contentType: string | undefined,
    metadata: {
      requestId?: string;
      ip?: string;
      path?: string;
      method?: string;
    }
  ) => {
    logger.warn('Security: Invalid Content-Type', {
      event: SecurityEventType.CONTENT_TYPE_REJECTED,
      contentType: contentType || 'missing',
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * HTTPS required but HTTP used
   */
  httpsRequired: (
    metadata: {
      requestId?: string;
      ip?: string;
      path?: string;
    }
  ) => {
    logger.warn('Security: HTTPS required', {
      event: SecurityEventType.HTTPS_REQUIRED,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Invalid input data
   */
  invalidInput: (
    field: string,
    reason: string,
    metadata: {
      requestId?: string;
      ip?: string;
      path?: string;
    }
  ) => {
    logger.warn('Security: Invalid input', {
      event: SecurityEventType.INVALID_INPUT,
      field,
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Forbidden access (authenticated but not authorized)
   */
  forbiddenAccess: (
    userId: string,
    resource: string,
    action: string,
    metadata: {
      requestId?: string;
      ip?: string;
      path?: string;
    }
  ) => {
    logger.warn('Security: Forbidden access', {
      event: SecurityEventType.FORBIDDEN_ACCESS,
      userId: sanitizeUserId(userId),
      resource,
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Unauthorized access (not authenticated)
   */
  unauthorizedAccess: (
    reason: string,
    metadata: {
      requestId?: string;
      ip?: string;
      path?: string;
    }
  ) => {
    logger.warn('Security: Unauthorized access', {
      event: SecurityEventType.UNAUTHORIZED_ACCESS,
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * Schema access denied (multi-tenant isolation)
   */
  schemaAccessDenied: (
    userId: string,
    appId: string,
    metadata: {
      requestId?: string;
      ip?: string;
    }
  ) => {
    logger.warn('Security: Schema access denied', {
      event: SecurityEventType.SCHEMA_ACCESS_DENIED,
      userId: sanitizeUserId(userId),
      appId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },

  /**
   * High-privilege operation (admin actions)
   */
  privilegedOperation: (
    userId: string,
    operation: string,
    resource: string,
    metadata: {
      requestId?: string;
      ip?: string;
      result: 'success' | 'failure';
    }
  ) => {
    const level = metadata.result === 'success' ? 'info' : 'warn';
    logger[level]('Security: Privileged operation', {
      event: SecurityEventType.PRIVILEGED_OPERATION,
      userId: sanitizeUserId(userId),
      operation,
      resource,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  },
};

/**
 * Helper to extract common metadata from Express request
 */
export const extractSecurityMetadata = (req: any) => ({
  requestId: req.requestId,
  ip: req.ip || req.connection?.remoteAddress,
  userAgent: req.get?.('user-agent'),
  path: req.path,
  method: req.method,
});
