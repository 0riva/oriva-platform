/**
 * Error Handling Middleware
 * Task: T025
 *
 * Centralized error handling for multi-tenant API.
 * Converts all errors to consistent JSON format.
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ValidationError } from '../utils/validation';
import { DatabaseError } from '../utils/database';

/**
 * Standard error response format
 */
interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

/**
 * Error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  error: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Log error for debugging
  console.error('Error occurred:', {
    name: error.name,
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
  });

  // Handle specific error types
  if (error instanceof ValidationError) {
    res.status(400).json({
      code: error.code,
      message: error.message,
      details: error.details,
    } as ErrorResponse);
    return;
  }

  if (error instanceof DatabaseError) {
    const statusCode = getStatusCodeForDatabaseError(error.code);
    res.status(statusCode).json({
      code: error.code,
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined,
    } as ErrorResponse);
    return;
  }

  // Default to 500 Internal Server Error
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  } as ErrorResponse);
};

/**
 * Map database error codes to HTTP status codes
 */
const getStatusCodeForDatabaseError = (code: string): number => {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'DUPLICATE_RECORD':
      return 409;
    case 'FOREIGN_KEY_VIOLATION':
    case 'MISSING_REQUIRED_FIELD':
      return 400;
    default:
      return 500;
  }
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route not found: ${req.method} ${req.path}`,
  } as ErrorResponse);
};

/**
 * Async route handler wrapper
 * Catches async errors and passes to error middleware
 */
export const asyncHandler =
  (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ): ((req: Request, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Create standard error response
 */
export const createErrorResponse = (
  code: string,
  message: string,
  details?: unknown
): ErrorResponse => {
  return {
    code,
    message,
    details,
  };
};

/**
 * Create standard success response
 */
export const createSuccessResponse = <T>(data: T): T => {
  return data;
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (timeoutMs = 30000): ((
  req: Request,
  res: Response,
  next: NextFunction
) => void) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timeout = setTimeout(() => {
      res.status(504).json({
        code: 'TIMEOUT',
        message: 'Request timeout',
      } as ErrorResponse);
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

/**
 * Rate limiting error response
 */
export const rateLimitHandler = (req: Request, res: Response): void => {
  res.status(429).json({
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
  } as ErrorResponse);
};
