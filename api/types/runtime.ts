import type { ApiErrorResponse, ApiSuccessResponse } from './api/responses';
import type { AuthenticatedRequest } from './middleware/auth';
import type { DatabaseQueryResult } from './database/entities';
import type { Request } from 'express';

export const ApiResponseRuntime = {
  success<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
    return {
      ok: true,
      success: true,
      data,
      ...(meta ? { meta } : {})
    };
  },
  error(message: string, options: { code?: string; details?: string[] } = {}): ApiErrorResponse {
    const { code, details } = options;
    return {
      ok: false,
      success: false,
      error: message,
      message,
      ...(code ? { code } : {}),
      ...(details !== undefined ? { details } : {})
    };
  }
};

export const AuthenticatedRequestRuntime = {
  isAuthenticated(req: Request): req is AuthenticatedRequest {
    return Boolean((req as AuthenticatedRequest).keyInfo);
  }
};

export const DatabaseQueryResultRuntime = {
  success<T>(data: T, count?: number | null): DatabaseQueryResult<T> {
    return {
      data,
      error: null,
      count: count ?? null,
      status: 200
    };
  },
  failure<T>(error: DatabaseQueryResult<T>['error'], status = 500): DatabaseQueryResult<T> {
    return {
      data: null,
      error,
      count: null,
      status
    };
  }
};
