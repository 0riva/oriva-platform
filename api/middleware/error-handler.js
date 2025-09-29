"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const errors_1 = require("../types/errors");
const toKnownError = (err) => {
    if (typeof err === 'object' && err !== null && 'code' in err && 'message' in err) {
        const errorObject = err;
        return {
            code: errorObject.code,
            message: String(errorObject.message),
            status: errorObject.status ?? 500,
            details: errorObject.details ?? [],
            cause: err
        };
    }
    if (err instanceof Error) {
        return (0, errors_1.createDatabaseError)(err.message, []);
    }
    return (0, errors_1.createDatabaseError)('Internal server error');
};
const errorHandler = (err, _req, res, next) => {
    if (res.headersSent) {
        next(err);
        return;
    }
    const apiError = (0, errors_1.createApiError)(toKnownError(err));
    res.status(apiError.status ?? 500).json((0, errors_1.toErrorResponse)(apiError));
};
exports.errorHandler = errorHandler;
