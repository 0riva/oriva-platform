"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLegacyApiKeyMiddleware = exports.createAuthMiddleware = void 0;
const errors_1 = require("../types/errors");
const database_1 = require("../services/database");
const LEGACY_PERMISSION_MAPPING = {
    profiles: ['user:read', 'profiles:read', 'profiles:write'],
    groups: ['groups:read', 'groups:write'],
    marketplace: ['marketplace:read'],
    entries: ['entries:read', 'entries:write'],
    templates: ['templates:read', 'templates:write']
};
const expandPermissions = (permissions) => {
    if (!Array.isArray(permissions)) {
        return [];
    }
    const expanded = new Set();
    permissions.forEach(permission => {
        const legacy = LEGACY_PERMISSION_MAPPING[String(permission)];
        if (legacy) {
            legacy.forEach(scope => expanded.add(scope));
        }
        else {
            expanded.add(String(permission));
        }
    });
    return Array.from(expanded);
};
const toApiKeyInfo = (record) => ({
    id: record.id,
    userId: record.user_id,
    name: record.name,
    permissions: expandPermissions(record.permissions),
    usageCount: record.usage_count,
    isActive: record.is_active,
    authType: 'api_key'
});
const validateApiKey = async (supabase, keyHash) => (0, database_1.runSingle)(supabase
    .from('developer_api_keys')
    .select('id, user_id, name, permissions, usage_count, is_active, created_at')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle());
const handleApiKeyPath = async (req, res, next, options, token) => {
    try {
        const keyHash = await options.hashApiKey(token);
        const { data, error } = await validateApiKey(options.supabase, keyHash);
        if (error || !data) {
            options.logger.warn('API key validation failed', {
                error: error?.message,
                hasKey: Boolean(data)
            });
            const authError = (0, errors_1.createAuthError)('INVALID_API_KEY', 'Invalid API key');
            res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
            return;
        }
        const keyRecord = data;
        options.logger.info('API key validation succeeded', {
            keyId: keyRecord.id,
            userId: keyRecord.user_id,
            name: keyRecord.name
        });
        req.apiKey = token;
        req.keyInfo = toApiKeyInfo(keyRecord);
        (0, database_1.incrementUsage)(options.supabase, keyRecord.id, keyRecord.usage_count).catch(err => {
            options.logger.warn('Failed to update API key usage', {
                keyId: keyRecord.id,
                message: err.message
            });
        });
        next();
    }
    catch (error) {
        options.logger.error('API key validation error', { error });
        const authError = (0, errors_1.createAuthError)('INVALID_API_KEY', 'Invalid API key');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
    }
};
const createAuthMiddleware = ({ supabase, logger, hashApiKey }) => async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const authError = (0, errors_1.createAuthError)('AUTH_REQUIRED', 'API key required');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
        return;
    }
    const token = authHeader.substring(7).trim();
    if (!token) {
        const authError = (0, errors_1.createAuthError)('AUTH_REQUIRED', 'API key required');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
        return;
    }
    const validPrefixes = ['oriva_pk_live_', 'oriva_pk_test_'];
    const isApiKey = validPrefixes.some(prefix => token.startsWith(prefix));
    if (isApiKey) {
        await handleApiKeyPath(req, res, next, { supabase, logger, hashApiKey }, token);
        return;
    }
    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) {
            const authError = (0, errors_1.createAuthError)('INVALID_API_KEY', 'Invalid API key');
            res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
            return;
        }
        const user = data.user;
        req.apiKey = token;
        req.keyInfo = {
            id: user.id,
            userId: user.id,
            name: user.email || user.user_metadata?.name || 'User',
            permissions: ['read', 'write'],
            usageCount: 0,
            isActive: true,
            authType: 'supabase_auth'
        };
        next();
    }
    catch (error) {
        logger.error('Supabase auth validation error', { error });
        const authError = (0, errors_1.createAuthError)('INVALID_API_KEY', 'Invalid API key');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
    }
};
exports.createAuthMiddleware = createAuthMiddleware;
const createLegacyApiKeyMiddleware = ({ supabase, logger, hashApiKey }) => async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const authError = (0, errors_1.createAuthError)('AUTH_REQUIRED', 'API key required');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
        return;
    }
    const apiKey = authHeader.substring(7);
    if (!apiKey || typeof apiKey !== 'string') {
        const authError = (0, errors_1.createAuthError)('INVALID_API_KEY', 'Invalid API key');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
        return;
    }
    const validPrefixes = ['oriva_pk_live_', 'oriva_pk_test_'];
    const hasValidPrefix = validPrefixes.some(prefix => apiKey.startsWith(prefix));
    if (!hasValidPrefix) {
        const authError = (0, errors_1.createAuthError)('INVALID_API_KEY', 'Invalid API key');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
        return;
    }
    try {
        const keyHash = await hashApiKey(apiKey);
        const { data, error } = await validateApiKey(supabase, keyHash);
        if (error || !data) {
            const authError = (0, errors_1.createAuthError)('INVALID_API_KEY', 'Invalid API key');
            res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
            return;
        }
        const keyRecord = data;
        req.apiKey = apiKey;
        req.keyInfo = toApiKeyInfo(keyRecord);
        next();
    }
    catch (error) {
        logger.error('API key validation error', { error });
        const authError = (0, errors_1.createAuthError)('INVALID_API_KEY', 'Invalid API key');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
    }
};
exports.createLegacyApiKeyMiddleware = createLegacyApiKeyMiddleware;
