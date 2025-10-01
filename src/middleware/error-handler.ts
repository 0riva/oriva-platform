// Task: T015 - Error handling middleware
// Description: Centralized error handling with logging and monitoring

import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Standard error response format
 */
export interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
  request_id?: string;
}

/**
 * Application error class with status code and error code
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Global error handler middleware
 * Catches all errors and formats them consistently
 */
export function errorHandler(error: Error | AppError, req: VercelRequest, res: VercelResponse): void {
  // Generate request ID for tracing
  const requestId = generateRequestId();

  // Sanitize headers to prevent sensitive data logging
  const sanitizedHeaders = { ...req.headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders.cookie;

  // Log error details
  console.error('Error handler caught:', {
    requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    headers: sanitizedHeaders,
  });

  // Determine status code and error code
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let details: unknown = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: error.message || 'An unexpected error occurred',
    code: errorCode,
    request_id: requestId,
  };

  // Include details in development mode
  if (process.env.NODE_ENV === 'development' && details) {
    errorResponse.details = details;
  }

  // Send response
  res.status(statusCode).json(errorResponse);

  // Send to monitoring service (Sentry, Datadog, etc.)
  if (statusCode >= 500) {
    sendErrorToMonitoring(error, {
      requestId,
      method: req.method,
      url: req.url,
      statusCode,
    });
  }
}

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error handler
 */
export function asyncHandler(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<void>,
): (req: VercelRequest, res: VercelResponse) => Promise<void> {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      errorHandler(error as Error, req, res);
    }
  };
}

/**
 * Validation error helper
 */
export function validationError(message: string, details?: unknown): AppError {
  return new AppError(400, 'VALIDATION_ERROR', message, details);
}

/**
 * Not found error helper
 */
export function notFoundError(resource: string): AppError {
  return new AppError(404, 'NOT_FOUND', `${resource} not found`);
}

/**
 * Forbidden error helper
 */
export function forbiddenError(message: string = 'Access forbidden'): AppError {
  return new AppError(403, 'FORBIDDEN', message);
}

/**
 * Unauthorized error helper
 */
export function unauthorizedError(message: string = 'Unauthorized'): AppError {
  return new AppError(401, 'UNAUTHORIZED', message);
}

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Send error to monitoring service
 * TODO: Integrate with Sentry/Datadog
 */
function sendErrorToMonitoring(error: Error, context: Record<string, unknown>): void {
  // Placeholder for monitoring integration
  console.error('MONITORING:', {
    error: error.message,
    stack: error.stack,
    context,
  });

  // Example Sentry integration:
  // Sentry.captureException(error, { contexts: { custom: context } });
}