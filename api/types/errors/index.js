"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDatabaseError = exports.createAuthError = exports.createValidationError = exports.toErrorResponse = exports.createApiError = void 0;
const createApiError = (error) => ({
    code: error.code,
    message: error.message,
    details: error.details,
    status: error.status,
    cause: error.cause
});
exports.createApiError = createApiError;
const toErrorResponse = (error) => {
    const response = {
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
exports.toErrorResponse = toErrorResponse;
const createValidationError = (message, details = [], fieldErrors) => ({
    code: 'VALIDATION_ERROR',
    message,
    details,
    fieldErrors,
    status: 400
});
exports.createValidationError = createValidationError;
const createAuthError = (code, message, details = []) => ({
    code,
    message,
    details,
    status: code === 'UNAUTHORIZED' ? 403 : 401
});
exports.createAuthError = createAuthError;
const createDatabaseError = (message, details = []) => ({
    code: 'DATABASE_ERROR',
    message,
    details,
    status: 500
});
exports.createDatabaseError = createDatabaseError;
