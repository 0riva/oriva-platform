import type { ApiErrorResponse } from '../http';

export interface ApiError {
  code: string;
  message: string;
  details?: string[];
  status?: number;
  cause?: unknown;
}

export interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  details: string[];
  fieldErrors?: Record<string, string[]>;
}

export interface AuthenticationError extends ApiError {
  code: 'AUTH_REQUIRED' | 'INVALID_API_KEY' | 'UNAUTHORIZED';
  status: 400 | 401 | 403;
}

export interface DatabaseError extends ApiError {
  code: 'DATABASE_ERROR';
  status: 500;
}

export type KnownApiError = ValidationError | AuthenticationError | DatabaseError | ApiError;

export const createApiError = (error: KnownApiError): ApiError => ({
  code: error.code,
  message: error.message,
  details: error.details,
  status: error.status,
  cause: error.cause
});

export const toErrorResponse = (error: KnownApiError): ApiErrorResponse => {
  const response: ApiErrorResponse = {
    ok: false,
    success: false,
    error: error.message,
    message: error.message,
    code: error.code
  };

  // Only include details for structured errors that have meaningful details
  if (error.code === 'VALIDATION_ERROR' ||
      (error.details && error.details.length > 0 &&
       (error.code === 'AUTH_REQUIRED' ||
        error.code === 'INVALID_API_KEY' ||
        error.code === 'UNAUTHORIZED'))) {
    response.details = error.details;
  }

  return response;
};

export const createValidationError = (
  message: string,
  details: string[] = [],
  fieldErrors?: Record<string, string[]>
): ValidationError => ({
  code: 'VALIDATION_ERROR',
  message,
  details,
  fieldErrors,
  status: 400
});

export const createAuthError = (
  code: AuthenticationError['code'],
  message: string,
  details: string[] = []
): AuthenticationError => ({
  code,
  message,
  details,
  status: code === 'UNAUTHORIZED' ? 403 : 401
});

export const createDatabaseError = (
  message: string,
  details: string[] = []
): DatabaseError => ({
  code: 'DATABASE_ERROR',
  message,
  details,
  status: 500
});
