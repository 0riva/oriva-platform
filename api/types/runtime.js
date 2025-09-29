"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseQueryResultRuntime = exports.AuthenticatedRequestRuntime = exports.ApiResponseRuntime = void 0;
exports.ApiResponseRuntime = {
    success(data, meta) {
        return {
            ok: true,
            success: true,
            data,
            ...(meta ? { meta } : {})
        };
    },
    error(message, options = {}) {
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
exports.AuthenticatedRequestRuntime = {
    isAuthenticated(req) {
        return Boolean(req.keyInfo);
    }
};
exports.DatabaseQueryResultRuntime = {
    success(data, count) {
        return {
            data,
            error: null,
            count: count ?? null,
            status: 200
        };
    },
    failure(error, status = 500) {
        return {
            data: null,
            error,
            count: null,
            status
        };
    }
};
