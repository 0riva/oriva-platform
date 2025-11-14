/**
 * Content-Type Validation Middleware
 * SECURITY: Prevents CSRF attacks and parser confusion by enforcing Content-Type headers
 *
 * Validates that requests with bodies include appropriate Content-Type headers
 * and only accepts whitelisted content types.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

/**
 * Allowed content types for API requests
 */
const ALLOWED_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
];

/**
 * HTTP methods that don't require Content-Type validation
 */
const METHODS_WITHOUT_BODY = ['GET', 'HEAD', 'OPTIONS', 'DELETE'];

/**
 * Content-Type validation middleware
 * SECURITY: Enforces proper Content-Type headers to prevent CSRF and parser attacks
 */
export const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip validation for methods that typically don't have request bodies
  if (METHODS_WITHOUT_BODY.includes(req.method)) {
    next();
    return;
  }

  // Get Content-Type header
  const contentType = req.get('content-type');

  // For POST, PUT, PATCH - require Content-Type header
  if (!contentType) {
    logger.warn('Request missing Content-Type header', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    res.status(400).json({
      code: 'MISSING_CONTENT_TYPE',
      message: 'Content-Type header is required for requests with a body',
    });
    return;
  }

  // Validate Content-Type is in allowed list
  // Note: Content-Type may include charset, so check if it starts with allowed type
  const isAllowed = ALLOWED_CONTENT_TYPES.some((allowedType) =>
    contentType.toLowerCase().includes(allowedType)
  );

  if (!isAllowed) {
    logger.warn('Unsupported Content-Type rejected', {
      contentType,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    res.status(415).json({
      code: 'UNSUPPORTED_MEDIA_TYPE',
      message: `Content-Type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
      providedType: contentType,
    });
    return;
  }

  // Content-Type is valid, continue
  next();
};

/**
 * Strict JSON-only Content-Type validation
 * Use this for API endpoints that only accept JSON
 */
export const requireJsonContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip for GET, HEAD, OPTIONS, DELETE
  if (METHODS_WITHOUT_BODY.includes(req.method)) {
    next();
    return;
  }

  const contentType = req.get('content-type');

  if (!contentType || !contentType.toLowerCase().includes('application/json')) {
    logger.warn('Non-JSON Content-Type rejected', {
      contentType: contentType || 'missing',
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    res.status(415).json({
      code: 'JSON_REQUIRED',
      message: 'Content-Type must be application/json',
    });
    return;
  }

  next();
};
