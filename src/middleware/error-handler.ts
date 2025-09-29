import type { ErrorRequestHandler } from 'express';
import { createApiError, createDatabaseError, toErrorResponse } from '../types/errors';
import type { KnownApiError } from '../types/errors';

const toKnownError = (err: unknown): KnownApiError => {
  if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
    const errorObject = err as { code: string; message: string; status?: number; details?: string[] };
    return {
      code: errorObject.code,
      message: String(errorObject.message),
      status: errorObject.status ?? 500,
      details: errorObject.details ?? [],
      cause: err
    };
  }

  if (err instanceof Error) {
    return createDatabaseError(err.message, []);
  }

  return createDatabaseError('Internal server error');
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const apiError = createApiError(toKnownError(err));
  res.status(apiError.status ?? 500).json(toErrorResponse(apiError));
};
