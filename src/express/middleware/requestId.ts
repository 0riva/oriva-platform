/**
 * Request ID Middleware
 * OBSERVABILITY: Adds unique request IDs for distributed tracing
 *
 * Generates or accepts X-Request-ID headers to enable:
 * - Request correlation across services
 * - Distributed tracing in logs
 * - Debugging multi-service flows
 */

import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Generate a unique request ID
 * Format: 16 bytes hex = 32 characters
 */
const generateRequestId = (): string => {
  return randomBytes(16).toString('hex');
};

/**
 * Validate request ID format (must be alphanumeric, length 8-64)
 */
const isValidRequestId = (id: string): boolean => {
  return /^[a-zA-Z0-9-_]{8,64}$/.test(id);
};

/**
 * Request ID middleware
 *
 * Behavior:
 * 1. If client sends X-Request-ID header (valid format), use it
 * 2. Otherwise, generate a new request ID
 * 3. Attach to req.requestId for use in handlers and logs
 * 4. Return in X-Request-ID response header
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check if client provided a request ID
  const clientRequestId = req.get('X-Request-ID') || req.get('x-request-id');

  // Use client ID if valid, otherwise generate new one
  const requestId =
    clientRequestId && isValidRequestId(clientRequestId)
      ? clientRequestId
      : generateRequestId();

  // Attach to request object
  req.requestId = requestId;

  // Add to response headers
  res.setHeader('X-Request-ID', requestId);

  next();
};

/**
 * Get request ID from request
 * Returns empty string if not found (for safety)
 */
export const getRequestId = (req: Request): string => {
  return req.requestId || '';
};
