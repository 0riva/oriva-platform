"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.handler = exports.app = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const supabase_js_1 = require("@supabase/supabase-js");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const winston_1 = __importDefault(require("winston"));
const entities_1 = require("./types/database/entities");
const errors_1 = require("./types/errors");
const auth_1 = require("./middleware/auth");
const error_handler_1 = require("./middleware/error-handler");
dotenv_1.default.config();
const webcrypto = globalThis.crypto ?? node_crypto_1.default.webcrypto;
exports.app = (0, express_1.default)();
// Production logging setup
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.Console(),
        ...(process.env.NODE_ENV === 'production' ? [
            new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
            new winston_1.default.transports.File({ filename: 'combined.log' })
        ] : [])
    ]
});
const respondWithError = (res, status, code, message, details = []) => {
    res.status(status).json({
        ok: false,
        success: false,
        error: message,
        message,
        code,
        details
    });
};
const asAuthRequest = (req) => req;
const API_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 1000);
const toNumber = (value, fallback) => {
    const parsed = typeof value === 'string' ? Number(value) : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const toStringParam = (value, fallback = '') => typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? fallback : fallback;
const getLimit = (value, fallback, max) => {
    const parsed = toNumber(value, fallback);
    const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    return max ? Math.min(normalized, max) : normalized;
};
const getOffset = (value, fallback) => {
    const parsed = toNumber(value, fallback);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const getErrorMessage = (error) => error instanceof Error ? error.message : String(error);
const normalizeAudienceType = (value) => entities_1.AUDIENCE_TYPES.includes(value) ? value : 'public';
const getProfileParams = (req) => req.params;
const getGroupParams = (req) => req.params;
const getAppParams = (req) => req.params;
const getAuthContext = (req, res) => {
    const authReq = asAuthRequest(req);
    if (!authReq.keyInfo) {
        const authError = (0, errors_1.createAuthError)('AUTH_REQUIRED', 'API key required');
        res.status(authError.status).json((0, errors_1.toErrorResponse)(authError));
        return undefined;
    }
    return { authReq, keyInfo: authReq.keyInfo };
};
const withAuthContext = (handler) => async (req, res) => {
    const context = getAuthContext(req, res);
    if (!context) {
        return;
    }
    await handler(context.authReq, res, context.keyInfo);
};
// Helper function to refresh CORS cache
async function refreshCorsCache() {
    try {
        const { data: apps, error } = await supabase
            .from('plugin_marketplace_apps')
            .select('execution_url')
            .eq('status', 'approved')
            .not('execution_url', 'is', null);
        if (error) {
            logger.error('CORS: Failed to refresh app origins cache', { error });
            return false;
        }
        // Extract domains from execution URLs
        const appDomains = apps
            .map(app => {
            try {
                const url = new globalThis.URL(app.execution_url);
                return url.origin;
            }
            catch {
                return null;
            }
        })
            .filter(Boolean);
        // Update cache
        corsOriginCache.data = new Set([
            // Core Oriva domains
            ...process.env.CORS_ORIGIN?.split(',') || [
                'https://oriva.io',
                'https://www.oriva.io',
                'https://app.oriva.io'
            ],
            // Registered 3rd party app domains
            ...appDomains
        ]);
        corsOriginCache.lastUpdated = Date.now();
        logger.info('CORS: Cache refreshed', {
            totalOrigins: corsOriginCache.data.size,
            appOrigins: appDomains.length
        });
        return true;
    }
    catch (error) {
        logger.error('CORS: Error refreshing cache', { error });
        return false;
    }
}
// Core origins that must always work (high-trust domains)
// Currently using dynamic CORS from database
// CORS cache for marketplace apps (loaded at startup)
const corsOriginCache = {
    data: new Set(),
    lastUpdated: 0,
    CACHE_TTL: 5 * 60 * 1000 // 5 minutes
};
// Initialize CORS cache on startup
refreshCorsCache().then(() => {
    console.log('✅ CORS cache initialized with registered app domains');
}).catch(error => {
    console.warn('⚠️ Failed to initialize CORS cache:', error.message);
});
// Dynamic CORS for marketplace applications
exports.app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin)
            return callback(null, true);
        // Development: Allow localhost
        if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
            return callback(null, true);
        }
        // Check against registered marketplace applications
        if (corsOriginCache.data.has(origin)) {
            console.log('✅ CORS: Registered marketplace origin allowed:', origin);
            return callback(null, true);
        }
        // Other core origins - ALWAYS allowed (static, no dependencies)
        const coreOrigins = [
            'https://oriva.io',
            'https://www.oriva.io',
            'https://app.oriva.io'
        ];
        if (coreOrigins.includes(origin)) {
            console.log('✅ CORS: Core origin allowed:', origin);
            return callback(null, true);
        }
        // Check marketplace cache (synchronous only) - with safety checks
        try {
            if (corsOriginCache && corsOriginCache.data && corsOriginCache.data.has && corsOriginCache.data.has(origin)) {
                console.log('✅ CORS: Marketplace origin allowed:', origin);
                return callback(null, true);
            }
        }
        catch (error) {
            console.error('❌ CORS: Cache check failed:', getErrorMessage(error));
        }
        // Log rejected origins for debugging
        console.warn('❌ CORS: Origin rejected:', {
            origin,
            cacheExists: !!corsOriginCache,
            cacheDataExists: !!corsOriginCache?.data,
            cacheSize: corsOriginCache?.data?.size || 0,
            cacheAge: corsOriginCache?.lastUpdated ? Date.now() - corsOriginCache.lastUpdated : 'unknown'
        });
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Extension-ID',
        'X-Client-ID',
        'X-API-Key',
        'User-Agent',
        'X-User-ID',
        'X-Request-ID'
    ],
    credentials: true
}));
// Ensure responses include both legacy and new contract fields
exports.app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (body && typeof body === 'object') {
            const payload = body;
            if (typeof payload.success === 'boolean' && payload.ok === undefined) {
                payload.ok = payload.success;
            }
            if (payload.success === false) {
                const message = typeof payload.message === 'string' ? payload.message : undefined;
                const error = typeof payload.error === 'string' ? payload.error : undefined;
                if (message && !error) {
                    payload.error = message;
                }
                if (error && !message) {
                    payload.message = error;
                }
            }
        }
        return originalJson(body);
    };
    next();
});
// CORS Monitoring Middleware - Track blocked headers for developer support
exports.app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        const requestedHeaders = req.headers['access-control-request-headers'];
        const origin = req.headers.origin;
        if (requestedHeaders && origin) {
            const currentAllowedHeaders = [
                'content-type', 'authorization', 'x-extension-id', 'x-client-id',
                'x-api-key', 'user-agent', 'x-user-id', 'x-request-id'
            ];
            const requestedHeadersArray = requestedHeaders.toLowerCase().split(',').map(h => h.trim());
            const blockedHeaders = requestedHeadersArray.filter(header => !currentAllowedHeaders.includes(header));
            if (blockedHeaders.length > 0) {
                logger.warn('CORS: Blocked headers detected', {
                    origin,
                    requestedHeaders: requestedHeadersArray,
                    blockedHeaders,
                    timestamp: new Date().toISOString(),
                    userAgent: req.headers['user-agent']
                });
            }
        }
    }
    next();
});
exports.app.use(express_1.default.json());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: API_RATE_LIMIT_MAX,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});
exports.app.use('/api/', limiter);
// Request logging middleware
exports.app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('API Request', {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
    });
    next();
});
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// DEBUG: Log environment variable status
console.log('🔍 Environment Variables Debug:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasServiceKey: !!supabaseServiceKey,
    supabaseUrlSource: process.env.SUPABASE_URL ? 'SUPABASE_URL' : (process.env.EXPO_PUBLIC_SUPABASE_URL ? 'EXPO_PUBLIC_SUPABASE_URL' : 'MISSING'),
    nodeEnv: process.env.NODE_ENV,
    supabaseUrlValue: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING'
});
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration. Required environment variables:');
    console.error('   - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('🚨 API cannot start without database connection');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
console.log('✅ Supabase client initialized for API key validation');
// CORS cache defined above
// Admin token from environment (used to protect dev-only endpoints)
const ADMIN_TOKEN = process.env.ORIVA_ADMIN_TOKEN || '';
// Very small in-memory rate limiter for dev endpoints (per IP)
const rateLimitState = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP for dev endpoints
const devRateLimiter = (req, res, next) => {
    const now = Date.now();
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const state = rateLimitState.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    if (now > state.resetAt) {
        state.count = 0;
        state.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }
    state.count += 1;
    rateLimitState.set(ip, state);
    if (state.count > RATE_LIMIT_MAX) {
        respondWithError(res, 429, 'RATE_LIMITED', 'Rate limit exceeded');
        return;
    }
    next();
};
// Guard for dev/admin endpoints
const requireAdminToken = (req, res, next) => {
    // Only enforce when an admin token is configured
    if (!ADMIN_TOKEN) {
        respondWithError(res, 503, 'ADMIN_TOKEN_NOT_CONFIGURED', 'Admin token not configured');
        return;
    }
    const token = req.headers['x-admin-token'];
    if (!token || token !== ADMIN_TOKEN) {
        respondWithError(res, 401, 'UNAUTHORIZED', 'Unauthorized');
        return;
    }
    req.keyInfo = req.keyInfo || {
        id: 'admin-token',
        userId: 'admin',
        name: 'Admin',
        permissions: ['admin:full'],
        usageCount: 0,
        isActive: true,
        authType: 'api_key'
    };
    next();
};
// API Key validation using Supabase
const hashAPIKey = async (key) => {
    try {
        console.log('🔐 DEBUG: Starting hashAPIKey', { keyLength: key.length, keyPrefix: key.substring(0, 20) });
        // Check if crypto.subtle is available
        if (!webcrypto?.subtle) {
            console.error('❌ crypto.subtle not available');
            throw new Error('crypto.subtle not available');
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(key);
        const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        const hash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
        console.log('✅ DEBUG: hashAPIKey success', { hashLength: hash.length, hashPrefix: hash.substring(0, 16) });
        return hash;
    }
    catch (error) {
        console.error('❌ DEBUG: hashAPIKey failed', { error: getErrorMessage(error) });
        throw error instanceof Error ? error : new Error(getErrorMessage(error));
    }
};
const validateAuth = (0, auth_1.createAuthMiddleware)({
    supabase,
    logger,
    hashApiKey: hashAPIKey
});
const validateApiKey = (0, auth_1.createLegacyApiKeyMiddleware)({
    supabase,
    logger,
    hashApiKey: hashAPIKey
});
// Health endpoint (no auth required)
exports.app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            profiles: '/api/v1/profiles/*',
            groups: '/api/v1/groups/*',
            user: '/api/v1/user/*',
            entries: '/api/v1/entries/*',
            templates: '/api/v1/templates/*'
        }
    });
});
// Legacy health endpoint
exports.app.get('/api/v1/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.4',
        features: ['marketplace', 'profiles', 'groups', 'privacy-first'],
        deployment: 'fixed-routing',
        test: 'routing-fix'
    });
});
// Test endpoint to verify routing
exports.app.get('/api/v1/test', (req, res) => {
    res.json({
        ok: true,
        success: true,
        message: 'API routing is working!',
        timestamp: new Date().toISOString()
    });
});
// Debug endpoint to check CORS cache state (admin only)
exports.app.get('/api/v1/debug/cors', requireAdminToken, async (req, res) => {
    try {
        // Test Supabase connection
        const { error: testError } = await supabase
            .from('plugin_marketplace_apps')
            .select('count')
            .limit(1);
        // Get cache info
        const cacheAge = Date.now() - corsOriginCache.lastUpdated;
        const cacheOrigins = Array.from(corsOriginCache.data);
        // Test marketplace apps
        const { data: marketplaceApps, error: marketplaceError } = await supabase
            .from('plugin_marketplace_apps')
            .select('name, execution_url, status')
            .eq('is_active', true);
        res.json({
            ok: true,
            success: true,
            timestamp: new Date().toISOString(),
            supabase: {
                connected: !testError,
                error: testError?.message || null
            },
            corsCache: {
                size: corsOriginCache.data.size,
                lastUpdated: new Date(corsOriginCache.lastUpdated).toISOString(),
                ageMs: cacheAge,
                origins: cacheOrigins
            },
            marketplace: {
                totalApps: marketplaceApps?.length || 0,
                apps: marketplaceApps || [],
                error: marketplaceError?.message || null
            },
            environment: {
                hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.EXPO_PUBLIC_SUPABASE_URL,
                hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                nodeEnv: process.env.NODE_ENV
            }
        });
    }
    catch (error) {
        logger.error('CORS debug endpoint error', { error });
        respondWithError(res, 500, 'DEBUG_ERROR', 'Failed to fetch debug information');
    }
});
// =============================================================================
// INPUT VALIDATION MIDDLEWARE
// =============================================================================
const validateRequest = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const details = errors
            .array()
            .map(error => `${'param' in error ? error.param : 'unknown'}: ${error.msg}`);
        const validationError = (0, errors_1.createValidationError)('Validation failed', details);
        const status = validationError.status ?? 400;
        res.status(status).json((0, errors_1.toErrorResponse)(validationError));
        return;
    }
    next();
};
// Helper function to generate API keys
const generateAPIKey = (prefix = 'oriva_pk_live_') => {
    const randomBytes = node_crypto_1.default.randomBytes(32);
    const keyString = randomBytes.toString('hex');
    return prefix + keyString;
};
// Backward compatibility mapping for old permission format
const LEGACY_PERMISSION_MAPPING = {
    'profiles': ['user:read', 'profiles:read', 'profiles:write'],
    'groups': ['groups:read', 'groups:write'],
    'marketplace': ['marketplace:read'],
    'entries': ['entries:read', 'entries:write'],
    'templates': ['templates:read', 'templates:write']
};
// Helper function to expand legacy permissions to granular permissions
const expandPermissions = (permissions) => {
    const expandedPerms = new Set();
    if (!Array.isArray(permissions)) {
        return [];
    }
    permissions.forEach(permission => {
        const key = String(permission);
        const legacyScopes = LEGACY_PERMISSION_MAPPING[key];
        if (legacyScopes) {
            legacyScopes.forEach((scope) => {
                expandedPerms.add(scope);
            });
        }
        else {
            expandedPerms.add(key);
        }
    });
    return Array.from(expandedPerms);
};
// Available permissions list for developer UI
const AVAILABLE_PERMISSIONS = [
    // User permissions
    { scope: 'user:read', description: 'Read user profile information', category: 'User' },
    { scope: 'user:write', description: 'Update user information', category: 'User' },
    // Profile permissions
    { scope: 'profiles:read', description: 'Read authorized user profiles', category: 'Profiles' },
    { scope: 'profiles:write', description: 'Switch between authorized profiles', category: 'Profiles' },
    // Group permissions
    { scope: 'groups:read', description: 'Read user group memberships', category: 'Groups' },
    { scope: 'groups:write', description: 'Access group member information', category: 'Groups' },
    // Entry permissions
    { scope: 'entries:read', description: 'Read entries', category: 'Content' },
    { scope: 'entries:write', description: 'Create and update entries', category: 'Content' },
    { scope: 'entries:delete', description: 'Delete entries', category: 'Content' },
    // Template permissions
    { scope: 'templates:read', description: 'Read templates', category: 'Templates' },
    { scope: 'templates:write', description: 'Create and update templates', category: 'Templates' },
    // Marketplace permissions
    { scope: 'marketplace:read', description: 'Browse public marketplace apps', category: 'Marketplace' },
    // Storage permissions
    { scope: 'storage:read', description: 'Read app-specific data only', category: 'Storage' },
    { scope: 'storage:write', description: 'Write app-specific data only', category: 'Storage' },
    // UI permissions
    { scope: 'ui:notifications', description: 'Show notifications to user', category: 'UI' },
    { scope: 'ui:modals', description: 'Display modals', category: 'UI' },
    { scope: 'ui:navigation', description: 'Navigate between screens', category: 'UI' }
];
// Get available permissions for developer UI
exports.app.get('/api/v1/dev/permissions', (req, res) => {
    res.json({
        ok: true,
        success: true,
        data: AVAILABLE_PERMISSIONS
    });
});
// API Key Management endpoints (for developer dashboard)
// Generate live API key endpoint - fixes confusing test key naming
exports.app.post('/api/v1/dev/generate-live-key', devRateLimiter, requireAdminToken, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { name = 'Live API Key', permissions = null } = req.body;
        const userId = keyInfo.userId || req.headers['x-user-id']?.toString() || null;
        // Validate permissions if provided
        if (permissions) {
            const validScopes = AVAILABLE_PERMISSIONS.map(p => p.scope);
            const invalidPermissions = permissions.filter(p => !validScopes.includes(p));
            if (invalidPermissions.length > 0) {
                respondWithError(res, 400, 'INVALID_PERMISSIONS', `Invalid permissions: ${invalidPermissions.join(', ')}`);
                return;
            }
        }
        if (!userId) {
            respondWithError(res, 401, 'UNAUTHORIZED', 'User authentication required');
            return;
        }
        // Generate live API key
        const apiKey = generateAPIKey('oriva_pk_live_');
        const keyHash = await hashAPIKey(apiKey);
        const keyPrefix = apiKey.substring(0, 20); // Store first 20 chars for display
        // Store in database
        const { data: keyData, error } = await supabase
            .from('developer_api_keys')
            .insert({
            user_id: userId,
            name,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            is_active: true,
            permissions: permissions || [
                'user:read', 'profiles:read', 'profiles:write', 'groups:read',
                'entries:read', 'templates:read', 'marketplace:read', 'storage:read', 'storage:write'
            ],
            created_at: new Date().toISOString()
        })
            .select()
            .single();
        if (error) {
            logger.error('Failed to store API key', { error, userId });
            respondWithError(res, 500, 'DEV_KEYS_ERROR', 'Failed to create API key');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: {
                id: keyData.id,
                name: keyData.name,
                key: apiKey, // Return full key only once
                keyPrefix: keyPrefix,
                type: 'live',
                permissions: expandPermissions(keyData.permissions),
                createdAt: keyData.created_at
            },
            message: 'Live API key generated successfully. Store this key securely - it will not be shown again.'
        });
    }
    catch (error) {
        logger.error('API key generation error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEV_KEYS_ERROR', 'Internal server error during key generation');
    }
}));
// Legacy endpoint - now redirects to live key generation
exports.app.post('/api/v1/dev/generate-key', devRateLimiter, requireAdminToken, (req, res) => {
    res.status(501).json({
        ok: false,
        success: false,
        error: 'This endpoint has been deprecated. Use /api/v1/dev/generate-live-key for production keys.',
        message: 'This endpoint has been deprecated. Use /api/v1/dev/generate-live-key for production keys.',
        code: 'ENDPOINT_DEPRECATED',
        details: [],
        redirect: '/api/v1/dev/generate-live-key'
    });
});
exports.app.get('/api/v1/dev/keys', devRateLimiter, requireAdminToken, async (_req, res) => {
    try {
        const { data: keys, error } = await supabase
            .from('developer_api_keys')
            .select('id, name, key_prefix, is_active, usage_count, last_used_at, created_at')
            .order('created_at', { ascending: false });
        if (error) {
            logger.error('Failed to fetch API keys', { error });
            respondWithError(res, 500, 'DEV_KEYS_ERROR', 'Failed to retrieve API keys');
            return;
        }
        const keyRows = (keys ?? []);
        const formattedKeys = keyRows.map(key => ({
            id: key.id,
            key: `${key.key_prefix}${'•'.repeat(24)}••••`, // Show prefix and masked key
            name: key.name,
            type: key.key_prefix.includes('_live_') ? 'live' : 'test',
            createdAt: key.created_at,
            lastUsed: key.last_used_at,
            usageCount: key.usage_count || 0,
            isActive: key.is_active
        }));
        res.json({
            ok: true,
            success: true,
            data: formattedKeys
        });
    }
    catch (error) {
        logger.error('Dev keys endpoint error', { error });
        respondWithError(res, 500, 'DEV_KEYS_ERROR', 'Failed to retrieve API keys');
    }
});
exports.app.post('/api/v1/dev/revoke-key', devRateLimiter, requireAdminToken, withAuthContext(async (req, res) => {
    try {
        const { keyId } = req.body;
        if (!keyId) {
            respondWithError(res, 400, 'INVALID_REQUEST', 'Key ID is required');
            return;
        }
        const { data, error } = await supabase
            .from('developer_api_keys')
            .update({ is_active: false })
            .eq('id', keyId)
            .select()
            .single();
        if (error || !data) {
            logger.error('Failed to revoke API key', { error, keyId });
            respondWithError(res, 404, 'DEV_KEY_NOT_FOUND', 'API key not found');
            return;
        }
        res.json({
            ok: true,
            success: true,
            message: 'API key revoked successfully'
        });
    }
    catch (error) {
        logger.error('Revoke key endpoint error', { error });
        respondWithError(res, 500, 'DEV_KEYS_ERROR', 'Failed to revoke API key');
    }
}));
// API keys are now managed through Supabase database
console.log('🔑 API keys will be validated against Supabase database');
// User endpoints
exports.app.get('/api/v1/user/me', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id')
            .eq('account_id', keyInfo.userId)
            .eq('is_active', true)
            .eq('is_default', true)
            .single();
        if (error || !profile) {
            logger.error('Failed to fetch user profile', { error });
            respondWithError(res, 500, 'USER_PROFILE_ERROR', 'Failed to fetch user profile');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: {
                id: profile.account_id,
                username: profile.username,
                displayName: profile.display_name || profile.username,
                email: keyInfo.authType === 'supabase_auth' ? keyInfo.name : null,
                bio: profile.bio,
                location: profile.location,
                website: profile.website_url,
                avatar: profile.avatar_url,
                createdAt: profile.created_at,
                updatedAt: profile.updated_at,
                apiKeyInfo: {
                    keyId: keyInfo.id,
                    name: keyInfo.name,
                    userId: keyInfo.userId,
                    permissions: keyInfo.permissions,
                    usageCount: keyInfo.usageCount
                }
            }
        });
    }
    catch (error) {
        logger.error('User profile endpoint error', { error });
        respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
}));
// Alternative plural endpoint for compatibility
exports.app.get('/api/v1/users/me', validateApiKey, async (req, res) => {
    // Redirect to the main endpoint
    req.url = '/api/v1/user/me';
    return exports.app._router.handle(req, res);
});
// =============================================================================
// SESSION ENDPOINTS
// =============================================================================
// Get user's sessions
exports.app.get('/api/v1/sessions', validateApiKey, async (req, res) => {
    try {
        // Sessions are not implemented in the current Oriva Core schema
        // Return empty array until sessions feature is added
        res.json({
            ok: true,
            success: true,
            data: [],
            meta: {
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 0,
                    totalPages: 0
                }
            },
            message: 'Sessions feature not yet implemented'
        });
    }
    catch (error) {
        logger.error('Failed to fetch sessions', { error });
        respondWithError(res, 500, 'SESSIONS_ERROR', 'Failed to fetch sessions');
    }
});
// Get upcoming sessions
exports.app.get('/api/v1/sessions/upcoming', validateApiKey, async (req, res) => {
    try {
        // Sessions are not implemented in the current Oriva Core schema
        res.json({
            ok: true,
            success: true,
            data: [],
            message: 'Sessions feature not yet implemented'
        });
    }
    catch (error) {
        logger.error('Failed to fetch upcoming sessions', { error });
        respondWithError(res, 500, 'SESSIONS_ERROR', 'Failed to fetch upcoming sessions');
    }
});
// =============================================================================
// TEAM ENDPOINTS
// =============================================================================
// Get team members
exports.app.get('/api/v1/team/members', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
    try {
        // Team concept maps to groups in Oriva Core
        // Return user's group memberships as "team members"
        const { data: groupMemberships, error } = await supabase
            .from('group_members')
            .select(`
        groups!inner (
          id,
          name
        ),
        profiles!inner (
          id,
          display_name,
          username,
          avatar_url
        ),
        role,
        joined_at
      `)
            .eq('profile_id', keyInfo.userId)
            .eq('is_active', true);
        if (error) {
            logger.error('Failed to fetch team members', { error, userId: keyInfo.userId });
            res.json({
                ok: true,
                success: true,
                data: [],
                meta: {
                    total: 0,
                    roles: []
                },
                message: 'No team memberships found'
            });
            return;
        }
        const memberships = (groupMemberships ?? []);
        const teamMembers = memberships.map(member => ({
            memberId: member.profiles.id,
            name: member.profiles.display_name || member.profiles.username,
            email: null,
            role: member.role,
            avatar: member.profiles.avatar_url,
            status: 'active',
            joinedAt: member.joined_at,
            groupName: member.groups.name
        }));
        const roles = [...new Set(teamMembers.map(member => member.role))];
        res.json({
            ok: true,
            success: true,
            data: teamMembers,
            meta: {
                total: teamMembers.length,
                roles
            }
        });
    }
    catch (error) {
        logger.error('Failed to fetch team members', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'TEAM_MEMBERS_ERROR', 'Failed to fetch team members');
    }
}));
// =============================================================================
// ANALYTICS ENDPOINTS
// =============================================================================
// Get analytics summary
exports.app.get('/api/v1/analytics/summary', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
    try {
        // Get real analytics from database
        const [entriesCount, responsesCount, groupsCount, installedAppsCount] = await Promise.all([
            supabase.from('entries').select('*', { count: 'exact', head: true }).eq('profile_id', keyInfo.userId),
            supabase.from('responses').select('*', { count: 'exact', head: true }).eq('profile_id', keyInfo.userId),
            supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('profile_id', keyInfo.userId).eq('is_active', true),
            supabase.from('user_app_installs').select('*', { count: 'exact', head: true }).eq('user_id', keyInfo.userId).eq('is_active', true)
        ]);
        const analytics = {
            overview: {
                totalEntries: entriesCount.count || 0,
                totalResponses: responsesCount.count || 0,
                totalGroups: groupsCount.count || 0,
                installedApps: installedAppsCount.count || 0
            },
            metrics: {
                entriesGrowth: 'N/A', // Would need historical data
                responseGrowth: 'N/A',
                groupActivity: 'N/A',
                appUsage: 'N/A'
            },
            recentActivity: [], // Would need activity log table
            timeRange: {
                start: new Date(Date.now() - 604800000).toISOString(), // 7 days ago
                end: new Date().toISOString()
            }
        };
        res.json({
            ok: true,
            success: true,
            data: analytics,
            message: 'Real analytics based on user data'
        });
    }
    catch (error) {
        logger.error('Failed to fetch analytics summary', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'ANALYTICS_ERROR', 'Failed to fetch analytics summary');
    }
}));
// =============================================================================
// AUTH ENDPOINTS
// =============================================================================
// Get auth profile (similar to user/me but focused on auth data)
exports.app.get('/api/v1/auth/profile', validateAuth, withAuthContext((_, res, keyInfo) => {
    try {
        res.json({
            ok: true,
            success: true,
            data: {
                id: keyInfo.userId,
                email: keyInfo.authType === 'supabase_auth' ? keyInfo.name : null,
                displayName: keyInfo.name,
                avatar: null,
                authType: keyInfo.authType,
                permissions: keyInfo.permissions,
                lastLogin: new Date().toISOString(),
                accountStatus: 'active',
                twoFactorEnabled: false,
                emailVerified: true
            }
        });
    }
    catch (error) {
        logger.error('Failed to fetch auth profile', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'AUTH_PROFILE_ERROR', 'Failed to fetch auth profile');
    }
}));
// =============================================================================
// PROFILE ENDPOINTS
// =============================================================================
// Get available profiles for the extension
exports.app.get('/api/v1/profiles/available', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
    try {
        // Get real profiles from Supabase database (excluding anonymous profiles for third-party apps)
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id, is_active, is_default')
            .eq('account_id', keyInfo.userId)
            .eq('is_active', true)
            .eq('is_anonymous', false)
            .order('created_at', { ascending: true });
        if (error) {
            logger.error('Failed to fetch profiles from database', { error, userId: keyInfo.userId });
            const fallbackProfiles = [
                {
                    profileId: 'ext_fallback_profile',
                    profileName: 'My Profile',
                    isActive: true,
                    avatar: null,
                    isDefault: true
                }
            ];
            res.json({
                ok: true,
                success: true,
                data: fallbackProfiles,
                message: 'Using fallback data due to database error'
            });
            return;
        }
        const profileRecords = (profiles ?? []);
        const transformedProfiles = profileRecords.map(profile => ({
            profileId: profile.id,
            profileName: profile.display_name ?? profile.username ?? 'Unnamed Profile',
            isActive: Boolean(profile.is_active),
            avatar: profile.avatar_url ?? null,
            isDefault: Boolean(profile.is_default)
        }));
        const response = {
            ok: true,
            success: true,
            data: transformedProfiles
        };
        res.json(response);
    }
    catch (error) {
        logger.error('Failed to fetch available profiles', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to fetch profiles');
    }
}));
// Get currently active profile
exports.app.get('/api/v1/profiles/active', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
    try {
        // Get the default (primary) profile from Supabase database (excluding anonymous profiles for third-party apps)
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id, is_active, is_default')
            .eq('account_id', keyInfo.userId)
            .eq('is_active', true)
            .eq('is_default', true)
            .eq('is_anonymous', false)
            .single();
        if (error) {
            logger.error('Failed to fetch active profile from database', { error, userId: keyInfo.userId });
            const fallbackProfile = {
                profileId: 'ext_fallback_active',
                profileName: 'My Active Profile',
                isActive: true,
                avatar: null,
                isDefault: true
            };
            res.json({
                ok: true,
                success: true,
                data: fallbackProfile,
                message: 'Using fallback data due to database error'
            });
            return;
        }
        // Transform database profile to API format
        const profileRecord = profile;
        const activeProfile = {
            profileId: profileRecord.id,
            profileName: profileRecord.display_name ?? profileRecord.username ?? 'Unnamed Profile',
            isActive: Boolean(profileRecord.is_active),
            avatar: profileRecord.avatar_url ?? null,
            isDefault: Boolean(profileRecord.is_default)
        };
        const response = {
            ok: true,
            success: true,
            data: activeProfile
        };
        res.json(response);
    }
    catch (error) {
        logger.error('Failed to fetch active profile', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to fetch active profile');
    }
}));
// Update profile information
exports.app.put('/api/v1/profiles/:profileId', validateApiKey, (0, express_validator_1.param)('profileId').matches(/^ext_[a-f0-9]{16}$/).withMessage('Invalid profile ID format'), validateRequest, async (req, res) => {
    try {
        const { profileId } = getProfileParams(req);
        const { profileName, avatar, bio, location } = req.body ?? {};
        const updatedProfile = {
            profileId,
            profileName: profileName || 'Updated Profile',
            isActive: true,
            avatar: avatar || 'https://example.com/avatars/updated-profile.jpg',
            bio: bio ?? null,
            location: location ?? null,
            updatedAt: new Date().toISOString()
        };
        res.json({
            ok: true,
            success: true,
            data: updatedProfile,
            message: 'Profile updated successfully'
        });
    }
    catch (error) {
        logger.error('Failed to update profile', { error, profileId: getProfileParams(req).profileId });
        respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to update profile');
    }
});
// Switch to a different profile
exports.app.post('/api/v1/profiles/:profileId/activate', validateApiKey, (0, express_validator_1.param)('profileId').matches(/^ext_[a-f0-9]{16}$/).withMessage('Invalid profile ID format'), validateRequest, async (req, res) => {
    try {
        const { profileId } = getProfileParams(req);
        res.json({
            ok: true,
            success: true,
            data: {
                activeProfile: profileId,
                switchedAt: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger.error('Failed to switch profile', { error, profileId: getProfileParams(req).profileId });
        respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to switch profile');
    }
});
// =============================================================================
// GROUP ENDPOINTS
// =============================================================================
// Get user's groups
exports.app.get('/api/v1/groups', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
    try {
        const { data: groupMemberships, error: membershipError } = await supabase
            .from('group_members')
            .select(`
        group_id,
        role,
        groups!inner (
          id,
          name,
          description,
          is_active,
          created_at
        )
      `)
            .eq('profile_id', keyInfo.userId)
            .eq('is_active', true);
        if (membershipError) {
            logger.error('Failed to fetch group memberships', { membershipError, userId: keyInfo.userId });
            res.json({
                ok: true,
                success: true,
                data: [],
                message: 'No groups found or database error'
            });
            return;
        }
        const memberships = (groupMemberships ?? []);
        const groups = [];
        for (const membership of memberships) {
            const { count: memberCount } = await supabase
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', membership.group_id)
                .eq('is_active', true);
            groups.push({
                groupId: membership.groups.id,
                groupName: membership.groups.name,
                memberCount: memberCount || 0,
                isActive: membership.groups.is_active,
                role: membership.role,
                description: membership.groups.description
            });
        }
        const response = {
            ok: true,
            success: true,
            data: groups
        };
        res.json(response);
    }
    catch (error) {
        logger.error('Failed to fetch groups', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'GROUPS_ERROR', 'Failed to fetch groups');
    }
}));
// Get group members
exports.app.get('/api/v1/groups/:groupId/members', validateApiKey, (0, express_validator_1.param)('groupId').isUUID().withMessage('Invalid group ID format'), validateRequest, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { groupId } = getGroupParams(req);
        const { data: userMembership, error: accessError } = await supabase
            .from('group_members')
            .select('id')
            .eq('group_id', groupId)
            .eq('profile_id', keyInfo.userId)
            .eq('is_active', true)
            .single();
        if (accessError || !userMembership) {
            respondWithError(res, 403, 'FORBIDDEN', 'Access denied to this group');
            return;
        }
        const { data: members, error: membersError } = await supabase
            .from('group_members')
            .select(`
          id,
          role,
          joined_at,
          profiles!inner (
            id,
            display_name,
            username,
            avatar_url
          )
        `)
            .eq('group_id', groupId)
            .eq('is_active', true)
            .order('joined_at', { ascending: true });
        if (membersError) {
            logger.error('Failed to fetch group members', { membersError, groupId });
            respondWithError(res, 500, 'GROUP_MEMBERS_ERROR', 'Failed to fetch group members');
            return;
        }
        const formattedMembers = (members ?? []).map(member => ({
            memberId: member.profiles.id,
            displayName: member.profiles.display_name || member.profiles.username,
            role: member.role,
            joinedAt: member.joined_at,
            avatar: member.profiles.avatar_url
        }));
        const response = {
            ok: true,
            success: true,
            data: formattedMembers
        };
        res.json(response);
    }
    catch (error) {
        logger.error('Failed to fetch group members', { error, groupId: getGroupParams(req).groupId, userId: keyInfo.userId });
        respondWithError(res, 500, 'GROUP_MEMBERS_ERROR', 'Failed to fetch group members');
    }
}));
// Entries endpoints
exports.app.get('/api/v1/entries', validateApiKey, async (req, res) => {
    try {
        const limit = toNumber(req.query.limit, 20);
        const offset = toNumber(req.query.offset, 0);
        const profileFilter = toStringParam(req.query.profile_id, '');
        let query = supabase
            .from('entries')
            .select('id, title, content, profile_id, created_at, updated_at, audience_type')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (profileFilter) {
            query = query.eq('profile_id', profileFilter);
        }
        const { data: entries, error } = await query;
        if (error) {
            logger.error('Failed to fetch entries', { error, offset, limit, profileFilter });
            res.json({
                ok: true,
                success: true,
                data: [],
                meta: {
                    pagination: {
                        page: Math.floor(offset / limit) + 1,
                        limit,
                        total: 0,
                        totalPages: 0
                    }
                },
                message: 'Using empty dataset due to query error'
            });
            return;
        }
        const entryRows = (entries ?? []);
        const items = entryRows.map(entry => ({
            id: entry.id,
            title: entry.title,
            content: entry.content,
            profile_id: entry.profile_id,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
            audience_type: normalizeAudienceType(entry.audience_type)
        }));
        const total = items.length;
        const pagination = {
            page: Math.floor(offset / limit) + 1,
            limit,
            total,
            totalPages: limit === 0 ? 0 : Math.ceil(total / limit)
        };
        const response = {
            ok: true,
            success: true,
            data: items,
            meta: { pagination }
        };
        res.json(response);
    }
    catch (error) {
        logger.error('Failed to fetch entries', { error });
        respondWithError(res, 500, 'ENTRIES_ERROR', 'Failed to fetch entries');
    }
});
// Templates endpoints
exports.app.get('/api/v1/templates', validateApiKey, (req, res) => {
    res.json({
        ok: true,
        success: true,
        data: [],
        meta: {
            pagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0
            }
        }
    });
});
// Storage endpoints
exports.app.get('/api/v1/storage', validateApiKey, (req, res) => {
    res.json({
        ok: true,
        success: true,
        data: {}
    });
});
// UI endpoints
exports.app.post('/api/v1/ui/notifications', validateApiKey, (req, res) => {
    res.json({
        ok: true,
        success: true,
        data: {
            id: 'notification_123'
        }
    });
});
// =============================================================================
// DEVELOPER ENDPOINTS
// =============================================================================
// Get developer's apps
exports.app.get('/api/v1/developer/apps', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
    try {
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .select('*')
            .eq('developer_id', keyInfo.userId)
            .order('created_at', { ascending: false });
        if (error) {
            logger.error('Failed to fetch developer apps', { error, userId: keyInfo.userId });
            respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Failed to fetch developer apps');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: (data ?? [])
        });
    }
    catch (error) {
        logger.error('Developer apps endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
    }
}));
// Get single app details
exports.app.get('/api/v1/developer/apps/:appId', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { appId } = getAppParams(req);
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .select('*')
            .eq('id', appId)
            .eq('developer_id', keyInfo.userId)
            .single();
        if (error || !data) {
            respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: data
        });
    }
    catch (error) {
        logger.error('Developer app detail endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
    }
}));
// Create new app
exports.app.post('/api/v1/developer/apps', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
    try {
        const payload = req.body;
        const now = new Date().toISOString();
        const appRecord = {
            ...payload,
            developer_id: keyInfo.userId,
            developer_name: keyInfo.name ?? 'Developer',
            status: 'draft',
            is_active: false,
            install_count: 0,
            created_at: now,
            updated_at: now
        };
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .insert(appRecord)
            .select()
            .single();
        if (error || !data) {
            logger.error('Failed to create app', { error, userId: keyInfo.userId });
            respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Failed to create app');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: data
        });
    }
    catch (error) {
        logger.error('Create app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
    }
}));
// Update app
exports.app.put('/api/v1/developer/apps/:appId', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { appId } = getAppParams(req);
        const now = new Date().toISOString();
        const updates = {
            ...req.body,
            updated_at: now
        };
        delete updates.status;
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .update(updates)
            .eq('id', appId)
            .eq('developer_id', keyInfo.userId)
            .select()
            .single();
        if (error || !data) {
            respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found or unauthorized');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: data
        });
    }
    catch (error) {
        logger.error('Update app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
    }
}));
// Delete app (only if in draft status)
exports.app.delete('/api/v1/developer/apps/:appId', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { appId } = getAppParams(req);
        const { data: app } = await supabase
            .from('plugin_marketplace_apps')
            .select('status')
            .eq('id', appId)
            .eq('developer_id', keyInfo.userId)
            .single();
        if (!app) {
            respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found');
            return;
        }
        if (app.status !== 'draft') {
            respondWithError(res, 403, 'INVALID_STATE', 'Cannot delete apps that are not in draft status');
            return;
        }
        const { error } = await supabase
            .from('plugin_marketplace_apps')
            .delete()
            .eq('id', appId)
            .eq('developer_id', keyInfo.userId);
        if (error) {
            logger.error('Failed to delete app', { error, appId, userId: keyInfo.userId });
            respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Failed to delete app');
            return;
        }
        res.json({
            ok: true,
            success: true,
            message: 'App deleted successfully'
        });
    }
    catch (error) {
        logger.error('Delete app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
    }
}));
// Submit app for review
exports.app.post('/api/v1/developer/apps/:appId/submit', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { appId } = getAppParams(req);
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .update({
            status: 'pending_review',
            submitted_at: now,
            updated_at: now
        })
            .eq('id', appId)
            .eq('developer_id', keyInfo.userId)
            .eq('status', 'draft')
            .select()
            .single();
        if (error || !data) {
            respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found or already submitted');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: data
        });
    }
    catch (error) {
        logger.error('Submit app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
    }
}));
// Resubmit app after rejection
exports.app.post('/api/v1/developer/apps/:appId/resubmit', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { appId } = getAppParams(req);
        const now = new Date().toISOString();
        const updates = req.body;
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .update({
            ...updates,
            status: 'pending_review',
            submitted_at: now,
            updated_at: now,
            reviewer_notes: null,
            reviewed_at: null,
            reviewed_by: null
        })
            .eq('id', appId)
            .eq('developer_id', keyInfo.userId)
            .eq('status', 'rejected')
            .select()
            .single();
        if (error || !data) {
            respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found or not in rejected status');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: data
        });
    }
    catch (error) {
        logger.error('Resubmit app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
    }
}));
// =============================================================================
// MARKETPLACE ENDPOINTS
// =============================================================================
// Get all approved marketplace apps with optional filtering
exports.app.get('/api/v1/marketplace/apps', validateApiKey, async (req, res) => {
    try {
        const limit = getLimit(req.query.limit, 20, 100);
        const offset = getOffset(req.query.offset, 0);
        const categoryFilter = toStringParam(req.query.category);
        const searchTerm = toStringParam(req.query.search);
        let query = supabase
            .from('plugin_marketplace_apps')
            .select(`
        id,
        name,
        slug,
        tagline,
        description,
        category,
        icon_url,
        screenshots,
        version,
        pricing_model,
        pricing_config,
        install_count,
        developer_id,
        developer_name,
        created_at,
        updated_at
      `)
            .eq('status', 'approved')
            .eq('is_active', true)
            .order('install_count', { ascending: false });
        if (categoryFilter) {
            query = query.eq('category', categoryFilter);
        }
        if (searchTerm) {
            const escaped = searchTerm.replace(/%/g, '\\%').replace(/_/g, '\\_');
            query = query.or(`name.ilike.%${escaped}%,tagline.ilike.%${escaped}%,description.ilike.%${escaped}%`);
        }
        const { data, error } = await query.range(offset, offset + limit - 1);
        if (error) {
            logger.error('Failed to fetch marketplace apps', { error, limit, offset, categoryFilter, searchTerm });
            respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
            return;
        }
        const apps = (data ?? []);
        const pagination = {
            page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
            limit,
            total: apps.length,
            totalPages: limit === 0 ? 0 : Math.ceil(apps.length / limit)
        };
        const response = {
            ok: true,
            success: true,
            data: apps,
            meta: { pagination }
        };
        res.json(response);
    }
    catch (error) {
        logger.error('Marketplace apps endpoint error', { error });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
});
// Get trending apps
exports.app.get('/api/v1/marketplace/trending', validateApiKey, async (req, res) => {
    try {
        const limit = getLimit(req.query.limit, 10, 50);
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .select(`
        id,
        name,
        slug,
        tagline,
        category,
        icon_url,
        install_count,
        developer_name
      `)
            .eq('status', 'approved')
            .eq('is_active', true)
            .order('install_count', { ascending: false })
            .limit(limit);
        if (error) {
            logger.error('Failed to fetch trending apps', { error });
            respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: (data ?? [])
        });
    }
    catch (error) {
        logger.error('Trending apps endpoint error', { error });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
});
// Get featured apps
exports.app.get('/api/v1/marketplace/featured', validateApiKey, async (req, res) => {
    try {
        const limit = getLimit(req.query.limit, 6, 50);
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .select(`
        id,
        name,
        slug,
        tagline,
        category,
        icon_url,
        install_count,
        developer_name
      `)
            .eq('status', 'approved')
            .eq('is_active', true)
            .eq('is_featured', true)
            .order('featured_order', { ascending: true })
            .limit(limit);
        if (error) {
            logger.error('Failed to fetch featured apps', { error });
            respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: (data ?? [])
        });
    }
    catch (error) {
        logger.error('Featured apps endpoint error', { error });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
});
// Get app categories
exports.app.get('/api/v1/marketplace/categories', validateApiKey, async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .select('category')
            .eq('status', 'approved')
            .eq('is_active', true);
        if (error) {
            logger.error('Failed to fetch categories', { error });
            respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
            return;
        }
        const categoryCounts = new Map();
        (data ?? []).forEach(app => {
            if (app?.category) {
                categoryCounts.set(app.category, (categoryCounts.get(app.category) ?? 0) + 1);
            }
        });
        const formatted = Array.from(categoryCounts.entries()).map(([category, count]) => ({
            category,
            count
        }));
        res.json({
            ok: true,
            success: true,
            data: formatted
        });
    }
    catch (error) {
        logger.error('Categories endpoint error', { error });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
});
// Get single app details
exports.app.get('/api/v1/marketplace/apps/:appId', validateApiKey, async (req, res) => {
    const { appId } = getAppParams(req);
    try {
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .select(`
        *,
        plugin_versions (
          id,
          version,
          release_notes,
          created_at
        )
      `)
            .eq('id', appId)
            .eq('status', 'approved')
            .single();
        if (error || !data) {
            respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data
        });
    }
    catch (error) {
        logger.error('App detail endpoint error', { error, appId });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Internal server error');
    }
});
// Get user's installed apps
exports.app.get('/api/v1/marketplace/installed', validateAuth, withAuthContext(async (req, res, keyInfo) => {
    try {
        const limit = getLimit(req.query.limit, 50, 100);
        const offset = getOffset(req.query.offset, 0);
        const { data, error } = await supabase
            .from('user_app_installs')
            .select(`
        id,
        app_id,
        installed_at,
        is_active,
        app_settings,
        plugin_marketplace_apps!user_app_installs_app_id_fkey (
          id,
          name,
          slug,
          tagline,
          description,
          category,
          icon_url,
          version,
          developer_name,
          install_count
        )
      `)
            .eq('user_id', keyInfo.userId)
            .eq('is_active', true)
            .order('installed_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error) {
            logger.error('Failed to fetch installed apps', { error, userId: keyInfo.userId });
            respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
            return;
        }
        const installs = (data ?? []).map(install => ({
            installationId: install.id,
            installedAt: install.installed_at,
            isActive: install.is_active,
            settings: install.app_settings,
            app: install.plugin_marketplace_apps
        }));
        const pagination = {
            page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
            limit,
            total: installs.length,
            totalPages: limit === 0 ? 0 : Math.ceil(installs.length / limit)
        };
        const response = {
            ok: true,
            success: true,
            data: installs,
            meta: { pagination }
        };
        res.json(response);
    }
    catch (error) {
        logger.error('Installed apps endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
}));
// Install an app
exports.app.post('/api/v1/marketplace/install/:appId', validateAuth, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { appId } = getAppParams(req);
        const { settings = {} } = req.body;
        const { data: app, error: appError } = await supabase
            .from('plugin_marketplace_apps')
            .select('id, name, status')
            .eq('id', appId)
            .eq('status', 'approved')
            .eq('is_active', true)
            .single();
        if (appError || !app) {
            respondWithError(res, 404, 'APP_NOT_FOUND', 'App not found or not available for installation');
            return;
        }
        const { data: existingInstall } = await supabase
            .from('user_app_installs')
            .select('id')
            .eq('user_id', keyInfo.userId)
            .eq('app_id', appId)
            .eq('is_active', true)
            .single();
        if (existingInstall) {
            respondWithError(res, 409, 'APP_ALREADY_INSTALLED', 'App is already installed');
            return;
        }
        const now = new Date().toISOString();
        const { data: installation, error: installError } = await supabase
            .from('user_app_installs')
            .insert({
            user_id: keyInfo.userId,
            app_id: appId,
            installed_at: now,
            is_active: true,
            app_settings: settings
        })
            .select()
            .single();
        if (installError || !installation) {
            logger.error('Failed to install app', { installError, appId, userId: keyInfo.userId });
            respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to install app');
            return;
        }
        await supabase.rpc('increment_install_count', { app_id_in: appId });
        res.json({
            ok: true,
            success: true,
            data: {
                installationId: installation.id,
                appId,
                installedAt: installation.installed_at,
                message: `Successfully installed ${app.name}`
            }
        });
    }
    catch (error) {
        logger.error('Install app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
}));
// Uninstall an app
exports.app.delete('/api/v1/marketplace/uninstall/:appId', validateAuth, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { appId } = getAppParams(req);
        const { data: installation, error: checkError } = await supabase
            .from('user_app_installs')
            .select('id, plugin_marketplace_apps(name)')
            .eq('user_id', keyInfo.userId)
            .eq('app_id', appId)
            .eq('is_active', true)
            .single();
        if (checkError || !installation) {
            respondWithError(res, 404, 'APP_NOT_INSTALLED', 'App is not installed');
            return;
        }
        const { error: uninstallError } = await supabase
            .from('user_app_installs')
            .update({ is_active: false, uninstalled_at: new Date().toISOString() })
            .eq('id', installation.id)
            .eq('user_id', keyInfo.userId);
        if (uninstallError) {
            logger.error('Failed to uninstall app', { uninstallError, appId, userId: keyInfo.userId });
            respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to uninstall app');
            return;
        }
        await supabase.rpc('decrement_install_count', { app_id_in: appId });
        const installRecord = installation;
        const appName = installRecord.plugin_marketplace_apps?.name ?? 'app';
        res.json({
            ok: true,
            success: true,
            data: {
                message: `Successfully uninstalled ${appName}`
            }
        });
    }
    catch (error) {
        logger.error('Uninstall app endpoint error', { error, userId: keyInfo.userId });
        respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
    }
}));
// =============================================================================
// HUGO AI ENDPOINTS
// =============================================================================

// Hugo AI Chat endpoint
exports.app.post('/api/hugo/chat', validateApiKey, [
    (0, express_validator_1.body)('message').notEmpty().withMessage('Message is required'),
    (0, express_validator_1.body)('userId').optional().isString(),
    (0, express_validator_1.body)('sessionId').optional().isString()
], validateRequest, async (req, res, next) => {
    try {
        const { message, userId, sessionId } = req.body;

        // Mock Hugo AI response for now
        const response = {
            id: node_crypto_1.default.randomUUID(),
            message: `Hugo AI Response to: "${message}"`,
            timestamp: new Date().toISOString(),
            userId,
            sessionId,
            metadata: {
                type: 'coaching_response',
                confidence: 0.95
            }
        };

        res.json({
            ok: true,
            success: true,
            data: response
        });
    } catch (error) {
        logger.error('Hugo AI chat error:', { error });
        next(error);
    }
});

// Hugo AI Sessions endpoint
exports.app.get('/api/hugo/sessions', validateApiKey, [
    (0, express_validator_1.query)('userId').optional().isString(),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 })
], validateRequest, async (req, res, next) => {
    try {
        // Mock sessions data
        const sessions = [
            {
                id: node_crypto_1.default.randomUUID(),
                userId: req.query.userId || 'anonymous',
                title: 'Dating Confidence Session',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                message_count: 12
            }
        ];

        res.json({
            ok: true,
            success: true,
            data: sessions,
            pagination: {
                total: sessions.length,
                limit: parseInt(req.query.limit) || 20,
                offset: 0
            }
        });
    } catch (error) {
        logger.error('Hugo AI sessions error:', { error });
        next(error);
    }
});

// Hugo AI User Management
exports.app.post('/api/hugo/users', validateApiKey, [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('profile').optional().isObject()
], validateRequest, async (req, res, next) => {
    try {
        const { email, profile } = req.body;

        const user = {
            id: node_crypto_1.default.randomUUID(),
            email,
            profile: profile || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'active'
        };

        res.json({
            ok: true,
            success: true,
            data: user
        });
    } catch (error) {
        logger.error('Hugo AI user creation error:', { error });
        next(error);
    }
});

// =============================================================================
// ADMIN ENDPOINTS FOR APP APPROVAL
// =============================================================================
// Get pending apps for review (admin only)
exports.app.get('/api/v1/admin/apps/pending', validateApiKey, requireAdminToken, withAuthContext(async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .select('*')
            .eq('status', 'pending_review')
            .order('created_at', { ascending: true });
        if (error) {
            logger.error('Failed to fetch pending apps', { error });
            respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data: data ?? []
        });
    }
    catch (error) {
        logger.error('Pending apps endpoint error', { error });
        respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
    }
}));
// Approve or reject an app (admin only)
exports.app.post('/api/v1/admin/apps/:appId/review', validateApiKey, requireAdminToken, withAuthContext(async (req, res, keyInfo) => {
    try {
        const { appId } = getAppParams(req);
        const { status, reviewerNotes } = req.body;
        if (!status || !['approved', 'rejected'].includes(status)) {
            respondWithError(res, 400, 'INVALID_STATUS', 'Invalid status. Must be "approved" or "rejected"');
            return;
        }
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('plugin_marketplace_apps')
            .update({
            status,
            reviewer_notes: reviewerNotes ?? null,
            reviewed_at: now,
            reviewed_by: keyInfo.userId
        })
            .eq('id', appId)
            .select()
            .single();
        if (error || !data) {
            logger.error('Failed to update app status', { error, appId, status });
            respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
            return;
        }
        res.json({
            ok: true,
            success: true,
            data
        });
    }
    catch (error) {
        logger.error('App review endpoint error', { error, appId: getAppParams(req).appId, reviewer: keyInfo.userId });
        respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
    }
}));
// 404 handler for unmatched routes
exports.app.use('*', (req, res) => {
    res.status(404).json({
        ok: false,
        success: false,
        error: 'Endpoint not found',
        message: 'Endpoint not found',
        code: 'NOT_FOUND',
        details: [],
        path: req.originalUrl,
        method: req.method
    });
});
// Error handling (temporary placeholder until typed middleware lands)
exports.app.use(error_handler_1.errorHandler);
const handler = (req, res) => {
    (0, exports.app)(req, res);
};
exports.handler = handler;
const startServer = () => {
    const PORT = Number(process.env.PORT) || 3001;
    const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
    exports.app.listen(PORT, () => {
        console.log('🚀 Oriva Platform API');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📍 Base URL: ${BASE_URL}`);
        console.log(`❤️  Health Check: ${BASE_URL}/health`);
        console.log(`🔧 API Test: ${BASE_URL}/api/v1/test`);
        console.log(`👤 User API: ${BASE_URL}/api/v1/user/me`);
        console.log(`🏪 Marketplace: ${BASE_URL}/api/v1/marketplace/apps`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🌟 Ready for development! Try: curl ${BASE_URL}/health`);
    });
};
exports.startServer = startServer;
exports.default = exports.app;
// Force deployment trigger - Wed Sep 17 19:54:21 CST 2025
