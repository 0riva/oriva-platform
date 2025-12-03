/**
 * Response Utility Functions
 * Standardized response helpers for Express routes
 */

import { Response } from 'express';

/**
 * Send a success response
 */
export function sendSuccess(
  res: Response,
  data: Record<string, unknown>,
  statusCode: number = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    ...data,
  });
}

/**
 * Send an error response
 */
export function sendError(res: Response, message: string, statusCode: number = 400): Response {
  return res.status(statusCode).json({
    success: false,
    error: message,
  });
}

/**
 * Send a not found response
 */
export function sendNotFound(res: Response, message: string = 'Resource not found'): Response {
  return res.status(404).json({
    success: false,
    error: message,
  });
}
