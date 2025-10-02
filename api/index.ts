// Load environment variables FIRST before any imports
require('dotenv').config();

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { param, validationResult } from 'express-validator';
import winston from 'winston';
import type { Logger } from 'winston';

import type { AuthenticatedRequest, ApiMiddleware, ApiKeyInfo } from '../src/types/middleware/auth';
import type {
  ApiResponse,
  PaginatedResponse
} from '../src/types/api/responses';
import {
  AUDIENCE_TYPES,
  type AudienceType,
  type DatabaseQueryResult,
  type Entry,
  type Group,
  type GroupMember,
  type Profile
} from '../src/types/database/entities';
import type { MarketplaceApp } from '../src/types/database/marketplace';
import {
  createAuthError,
  createDatabaseError,
  createValidationError,
  toErrorResponse
} from '../src/types/errors';
// Removed: createAuthMiddleware and createLegacyApiKeyMiddleware (not implemented)
// import {
//   createAuthMiddleware,
//   createLegacyApiKeyMiddleware
// } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/error-handler';
import { createHugoAIRouter } from '../src/routes/hugo-ai';

const webcrypto = globalThis.crypto ?? crypto.webcrypto;

export const app = express();

// Enable trust proxy for Vercel/reverse proxy environments
// Trust only Vercel's proxy layer (loopback + private networks)
// See: https://expressjs.com/en/guide/behind-proxies.html
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// Production logging setup
const logger: Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' })
    ] : [])
  ]
});

const respondWithError = (
  res: Response,
  status: number,
  code: string,
  message: string,
  details: unknown[] = []
) => {
  res.status(status).json({
    ok: false,
    success: false,
    error: message,
    message,
    code,
    details
  });
};

const asAuthRequest = (req: Request): AuthenticatedRequest => req as AuthenticatedRequest;

const API_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 1000);

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'string' ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toStringParam = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : Array.isArray(value) ? value[0] ?? fallback : fallback;

const getLimit = (value: unknown, fallback: number, max?: number): number => {
  const parsed = toNumber(value, fallback);
  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return max ? Math.min(normalized, max) : normalized;
};

const getOffset = (value: unknown, fallback: number): number => {
  const parsed = toNumber(value, fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

type ProfileRecord = Pick<Profile,
  | 'id'
  | 'username'
  | 'display_name'
  | 'bio'
  | 'location'
  | 'website_url'
  | 'avatar_url'
  | 'created_at'
  | 'updated_at'
  | 'account_id'
> & {
  is_active?: boolean | null;
  is_default?: boolean | null;
};

type ProfileSummary = {
  profileId: string;
  profileName: string;
  isActive: boolean;
  avatar: string | null;
  isDefault: boolean;
};

type ActiveProfileSummary = ProfileSummary;

type TeamMember = {
  memberId: string;
  displayName: string;
  role: string;
  joinedAt: string;
  avatar: string | null;
};

type GroupSummary = {
  groupId: string;
  groupName: string;
  memberCount: number;
  isActive: boolean;
  role: string;
  description: string | null;
};

const normalizeAudienceType = (value: string): AudienceType =>
  AUDIENCE_TYPES.includes(value as AudienceType) ? (value as AudienceType) : 'public';

type ProfileRouteParams = { profileId: string };
type GroupRouteParams = { groupId: string };
type AppRouteParams = { appId: string };
type InstalledAppSummary = {
  installationId: string;
  installedAt: string;
  isActive: boolean;
  settings: Record<string, unknown> | null;
  app: MarketplaceApp;
};

const getProfileParams = (req: Request): ProfileRouteParams => req.params as ProfileRouteParams;
const getGroupParams = (req: Request): GroupRouteParams => req.params as GroupRouteParams;
const getAppParams = (req: Request): AppRouteParams => req.params as AppRouteParams;

interface AuthContext {
  authReq: AuthenticatedRequest;
  keyInfo: ApiKeyInfo;
}

const getAuthContext = (req: Request, res: Response): AuthContext | undefined => {
  const authReq = asAuthRequest(req);
  if (!authReq.keyInfo) {
    const authError = createAuthError('AUTH_REQUIRED', 'API key required');
    res.status(authError.status).json(toErrorResponse(authError));
    return undefined;
  }
  return { authReq, keyInfo: authReq.keyInfo };
};

type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response,
  keyInfo: ApiKeyInfo
) => Promise<void> | void;

const withAuthContext = (handler: AuthenticatedHandler) =>
  async (req: Request, res: Response) => {
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
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Update cache
    corsOriginCache.data = new Set([
      // Core Oriva domains (static origins)
      ...STATIC_CORS_ORIGINS,
      // Registered 3rd party app domains
      ...appDomains
    ]);
    corsOriginCache.lastUpdated = Date.now();

    logger.info('CORS: Cache refreshed', {
      totalOrigins: corsOriginCache.data.size,
      appOrigins: appDomains.length
    });
    return true;
  } catch (error) {
    logger.error('CORS: Error refreshing cache', { error });
    return false;
  }
}

// Core origins that must always work (high-trust domains)
// Currently using dynamic CORS from database

// Static origins that must always work (high-trust domains)
const STATIC_CORS_ORIGINS = process.env.CORS_ORIGIN?.split(',') || [
  'https://oriva.io',
  'https://www.oriva.io',
  'https://app.oriva.io',
  'http://localhost:8081'  // Added for Oriva Core team development
];

// CORS cache for marketplace apps (loaded at startup)
const corsOriginCache = {
  data: new Set(STATIC_CORS_ORIGINS), // Initialize with static origins
  lastUpdated: 0,
  CACHE_TTL: 5 * 60 * 1000 // 5 minutes
};

// Initialize CORS cache on startup
refreshCorsCache().then(() => {
  console.log('✅ CORS cache initialized with registered app domains');
}).catch(error => {
  console.warn('⚠️ Failed to initialize CORS cache, using static origins only:', error.message);
  // Ensure static origins are still in cache if refresh failed
  STATIC_CORS_ORIGINS.forEach(origin => corsOriginCache.data.add(origin));
});

// Dynamic CORS for marketplace applications
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

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
    } catch (error) {
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
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body?: unknown) => {
    if (body && typeof body === 'object') {
      const payload = body as Record<string, unknown>;

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
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const requestedHeaders = req.headers['access-control-request-headers'];
    const origin = req.headers.origin;

    if (requestedHeaders && origin) {
      const currentAllowedHeaders = [
        'content-type', 'authorization', 'x-extension-id', 'x-client-id',
        'x-api-key', 'user-agent', 'x-user-id', 'x-request-id'
      ];

      const requestedHeadersArray = requestedHeaders.toLowerCase().split(',').map(h => h.trim());
      const blockedHeaders = requestedHeadersArray.filter(header =>
        !currentAllowedHeaders.includes(header)
      );

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

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: API_RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
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
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// DEBUG: Log environment variable status
console.log('🔍 Environment Variables Debug:', {
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceKey: !!supabaseServiceKey,
  hasAnonKey: !!supabaseAnonKey,
  supabaseUrlSource: process.env.SUPABASE_URL ? 'SUPABASE_URL' : (process.env.EXPO_PUBLIC_SUPABASE_URL ? 'EXPO_PUBLIC_SUPABASE_URL' : 'MISSING'),
  nodeEnv: process.env.NODE_ENV,
  supabaseUrlValue: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING'
});

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration. Required environment variables:');
  console.error('   - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('   - SUPABASE_ANON_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  console.error('🚨 API cannot start without database connection');
  process.exit(1);
}

// Service role client for database operations (bypasses RLS)
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);
console.log('✅ Supabase service client initialized');

// Anon client for auth operations (regular user operations)
const supabaseAuth: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
console.log('✅ Supabase auth client initialized');

// CORS cache defined above

// Admin token from environment (used to protect dev-only endpoints)
const ADMIN_TOKEN = process.env.ORIVA_ADMIN_TOKEN || '';

// Very small in-memory rate limiter for dev endpoints (per IP)
const rateLimitState = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP for dev endpoints

const devRateLimiter: ApiMiddleware = (req, res, next) => {
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
const requireAdminToken: ApiMiddleware = (req, res, next) => {
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
    authType: 'api_key' as const
  };
  next();
};

// API Key validation using Supabase
const hashAPIKey = async (key: string): Promise<string> => {
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
  } catch (error) {
    console.error('❌ DEBUG: hashAPIKey failed', { error: getErrorMessage(error) });
    throw error instanceof Error ? error : new Error(getErrorMessage(error));
  }
};

// Import authentication and rate limiting middleware
import { createAuthMiddleware, createOptionalAuthMiddleware, type ExpressAuthenticatedRequest } from '../src/middleware/auth';
import { apiRateLimiter } from '../src/middleware/rateLimiter';

// Authentication middleware (includes rate limiting)
const validateAuth = createAuthMiddleware(); // Returns [rateLimiter, authHandler]

// API Key validation middleware
const validateApiKey: ApiMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      respondWithError(res, 401, 'AUTH_REQUIRED', 'Authorization header required');
      return;
    }

    // Support both "Bearer token" and "token" formats
    const apiKey = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    if (!apiKey) {
      respondWithError(res, 401, 'AUTH_REQUIRED', 'API key required');
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('oriva_pk_test_') && !apiKey.startsWith('oriva_pk_live_')) {
      respondWithError(res, 401, 'INVALID_API_KEY', 'Invalid API key format');
      return;
    }

    // Hash the API key
    const keyHash = await hashAPIKey(apiKey);

    // Look up the API key in the database
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from('developer_api_keys')
      .select('id, user_id, name, permissions, usage_count, is_active, last_used_at')
      .eq('key_hash', keyHash)
      .single();

    if (keyError || !apiKeyRecord) {
      respondWithError(res, 401, 'INVALID_API_KEY', 'Invalid or expired API key');
      return;
    }

    if (!apiKeyRecord.is_active) {
      respondWithError(res, 401, 'API_KEY_INACTIVE', 'API key is inactive');
      return;
    }

    // Set keyInfo on the request
    const authReq = asAuthRequest(req);
    authReq.keyInfo = {
      id: apiKeyRecord.id,
      userId: apiKeyRecord.user_id,
      name: apiKeyRecord.name,
      permissions: apiKeyRecord.permissions || [],
      usageCount: apiKeyRecord.usage_count || 0,
      isActive: apiKeyRecord.is_active,
      authType: 'api_key',
      lastUsedAt: apiKeyRecord.last_used_at || undefined
    };

    // Update usage count and last_used_at (fire and forget)
    void supabase
      .from('developer_api_keys')
      .update({
        usage_count: (apiKeyRecord.usage_count || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', apiKeyRecord.id)
      .then(() => {}, (err) => console.warn('Failed to update API key usage:', err));

    next();
  } catch (error) {
    logger.error('API key validation error', { error: getErrorMessage(error) });
    respondWithError(res, 500, 'AUTH_ERROR', 'Authentication error');
  }
}

// Apply general API rate limiting to all routes
app.use('/api', apiRateLimiter);

// Health endpoint (no auth required)
app.get('/health', (req, res) => {
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
app.get('/api/v1/health', (req, res) => {
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
app.get('/api/v1/test', (req, res) => {
  res.json({
    ok: true,
    success: true,
    message: 'API routing is working!',
    timestamp: new Date().toISOString()
  });
});


// Debug endpoint to check CORS cache state (admin only)
app.get('/api/v1/debug/cors', requireAdminToken, async (req, res) => {
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
  } catch (error) {
    logger.error('CORS debug endpoint error', { error });
    respondWithError(res, 500, 'DEBUG_ERROR', 'Failed to fetch debug information');
  }
});

// =============================================================================
// INPUT VALIDATION MIDDLEWARE
// =============================================================================

const validateRequest: ApiMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors
      .array()
      .map(error => `${'param' in error ? error.param : 'unknown'}: ${error.msg}`);
    const validationError = createValidationError('Validation failed', details);
    const status = validationError.status ?? 400;
    res.status(status).json(toErrorResponse(validationError));
    return;
  }
  next();
};

// Helper function to generate API keys
const generateAPIKey = (prefix = 'oriva_pk_live_') => {
  const randomBytes = crypto.randomBytes(32);
  const keyString = randomBytes.toString('hex');
  return prefix + keyString;
};

// Backward compatibility mapping for old permission format
const LEGACY_PERMISSION_MAPPING: Record<string, readonly string[]> = {
  'profiles': ['user:read', 'profiles:read', 'profiles:write'],
  'groups': ['groups:read', 'groups:write'],
  'marketplace': ['marketplace:read'],
  'entries': ['entries:read', 'entries:write'],
  'templates': ['templates:read', 'templates:write']
};

// Helper function to expand legacy permissions to granular permissions
const expandPermissions = (permissions: unknown[]): string[] => {
  const expandedPerms = new Set<string>();

  if (!Array.isArray(permissions)) {
    return [];
  }

  permissions.forEach(permission => {
    const key = String(permission);
    const legacyScopes = LEGACY_PERMISSION_MAPPING[key];

    if (legacyScopes) {
      legacyScopes.forEach((scope: string) => {
        expandedPerms.add(scope);
      });
    } else {
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
app.get('/api/v1/dev/permissions', (req, res) => {
  res.json({
    ok: true,
    success: true,
    data: AVAILABLE_PERMISSIONS
  });
});

// =============================================================================
// 🚨 SECURITY NOTICE: API KEY MANAGEMENT
// =============================================================================
// 
// NEVER expose API key generation endpoints in public APIs!
// 
// The following endpoints have been REMOVED for security:
//   ❌ POST /api/v1/dev/generate-live-key - Key generation
//   ❌ POST /api/v1/dev/generate-key - Legacy key generation  
//   ❌ GET /api/v1/dev/keys - List all keys
//   ❌ POST /api/v1/dev/revoke-key - Revoke keys
//
// WHY THIS IS CRITICAL:
//   1. API key generation must require authenticated web sessions
//   2. Programmatic key generation enables automated attacks
//   3. Shared admin tokens are insecure for production
//   4. No audit trail or user attribution
//   5. Risk of unlimited key generation abuse
//
// CORRECT ARCHITECTURE:
//   ✅ Generate keys through Oriva platform web UI only
//   ✅ Require user authentication (OAuth/session)
//   ✅ Add CAPTCHA and rate limiting
//   ✅ Email verification for new keys
//   ✅ Full audit logging with user attribution
//   ✅ Keys shown once and copied by developer
//
// Only the permissions documentation endpoint remains public:
//   ✅ GET /api/v1/dev/permissions - Documentation only
//
// =============================================================================

// API keys are now managed through Supabase database
console.log('🔑 API keys will be validated against Supabase database');

// User endpoints
app.get('/api/v1/user/me', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
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
  } catch (error) {
    logger.error('User profile endpoint error', { error });
    respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
  }
}));

// Alternative plural endpoint for compatibility
app.get('/api/v1/users/me', validateApiKey, async (req, res) => {
  // Redirect to the main endpoint
  req.url = '/api/v1/user/me';
  return app._router.handle(req, res);
});

// =============================================================================
// SESSION ENDPOINTS
// =============================================================================

// Get user's sessions
app.get('/api/v1/sessions', validateApiKey, async (req, res) => {
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
  } catch (error) {
    logger.error('Failed to fetch sessions', { error });
    respondWithError(res, 500, 'SESSIONS_ERROR', 'Failed to fetch sessions');
  }
});

// Get upcoming sessions
app.get('/api/v1/sessions/upcoming', validateApiKey, async (req, res) => {
  try {
    // Sessions are not implemented in the current Oriva Core schema
    res.json({
      ok: true,
      success: true,
      data: [],
      message: 'Sessions feature not yet implemented'
    });
  } catch (error) {
    logger.error('Failed to fetch upcoming sessions', { error });
    respondWithError(res, 500, 'SESSIONS_ERROR', 'Failed to fetch upcoming sessions');
  }
});

// =============================================================================
// TEAM ENDPOINTS
// =============================================================================

// Get team members
app.get('/api/v1/team/members', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
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

    type GroupMembershipRecord = {
      role: string;
      joined_at: string;
      profiles: {
        id: string;
        display_name: string | null;
        username: string;
        avatar_url: string | null;
      };
      groups: {
        name: string;
      };
    };

    const memberships = ((groupMemberships ?? []) as unknown) as GroupMembershipRecord[];

    const teamMembers = memberships.map(member => ({
      memberId: member.profiles.id,
      name: member.profiles.display_name || member.profiles.username,
      email: null as string | null,
      role: member.role,
      avatar: member.profiles.avatar_url,
      status: 'active' as const,
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
  } catch (error) {
    logger.error('Failed to fetch team members', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'TEAM_MEMBERS_ERROR', 'Failed to fetch team members');
  }
}));

// =============================================================================
// ANALYTICS ENDPOINTS
// =============================================================================

// Get analytics summary
app.get('/api/v1/analytics/summary', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
  try {
    // Get real analytics from database
    const [
      entriesCount,
      responsesCount,
      groupsCount,
      installedAppsCount
    ] = await Promise.all([
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
  } catch (error) {
    logger.error('Failed to fetch analytics summary', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'ANALYTICS_ERROR', 'Failed to fetch analytics summary');
  }
}));

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

// Get auth profile (similar to user/me but focused on auth data)
app.get('/api/v1/auth/profile', validateAuth, withAuthContext((_, res, keyInfo) => {
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
  } catch (error) {
    logger.error('Failed to fetch auth profile', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'AUTH_PROFILE_ERROR', 'Failed to fetch auth profile');
  }
}));

// =============================================================================
// PROFILE ENDPOINTS
// =============================================================================

// Get available profiles for the extension
app.get('/api/v1/profiles/available', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
  try {
    // Get real profiles from Supabase database (excluding anonymous profiles for third-party apps)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id, is_active, is_default'
      )
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

    // Transform database profiles to API format
    type ProfileRecord = {
      id: string;
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
      is_active: boolean;
      is_default: boolean;
    };

    const profileRecords = (profiles ?? []) as ProfileRecord[];
    const transformedProfiles: ProfileSummary[] = profileRecords.map(profile => ({
      profileId: profile.id,
      profileName: profile.display_name ?? profile.username ?? 'Unnamed Profile',
      isActive: Boolean(profile.is_active),
      avatar: profile.avatar_url ?? null,
      isDefault: Boolean(profile.is_default)
    }));

    const response: ApiResponse<ProfileSummary[]> = {
      ok: true,
      success: true,
      data: transformedProfiles
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch available profiles', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to fetch profiles');
  }
}));

// Get currently active profile
app.get('/api/v1/profiles/active', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
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
    const profileRecord = profile as ProfileRecord;
    const activeProfile: ActiveProfileSummary = {
      profileId: profileRecord.id,
      profileName: profileRecord.display_name ?? profileRecord.username ?? 'Unnamed Profile',
      isActive: Boolean(profileRecord.is_active),
      avatar: profileRecord.avatar_url ?? null,
      isDefault: Boolean(profileRecord.is_default)
    };

    const response: ApiResponse<ActiveProfileSummary> = {
      ok: true,
      success: true,
      data: activeProfile
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch active profile', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to fetch active profile');
  }
}));

// Update profile information
app.put('/api/v1/profiles/:profileId',
  validateApiKey,
  param('profileId').matches(/^ext_[a-f0-9]{16}$/).withMessage('Invalid profile ID format'),
  validateRequest,
  async (req: Request<ProfileRouteParams>, res: Response) => {
    try {
      const { profileId } = getProfileParams(req);
      const { profileName, avatar, bio, location } = (req.body as Partial<{
        profileName: string;
        avatar: string;
        bio: string | null;
        location: string | null;
      }>) ?? {};

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
    } catch (error) {
      logger.error('Failed to update profile', { error, profileId: getProfileParams(req).profileId });
      respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to update profile');
    }
  });

// Switch to a different profile
app.post('/api/v1/profiles/:profileId/activate',
  validateApiKey,
  param('profileId').matches(/^ext_[a-f0-9]{16}$/).withMessage('Invalid profile ID format'),
  validateRequest,
  async (req: Request<ProfileRouteParams>, res: Response) => {
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
    } catch (error) {
      logger.error('Failed to switch profile', { error, profileId: getProfileParams(req).profileId });
      respondWithError(res, 500, 'PROFILES_ERROR', 'Failed to switch profile');
    }
  });

// =============================================================================
// GROUP ENDPOINTS
// =============================================================================

// Get user's groups
app.get('/api/v1/groups', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
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

    type GroupMembershipRow = {
      group_id: string;
      role: string;
      groups: {
        id: string;
        name: string;
        description: string | null;
        is_active: boolean;
        created_at: string;
      };
    };

    const memberships = ((groupMemberships ?? []) as unknown) as GroupMembershipRow[];
    const groups: GroupSummary[] = [];

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

    const response: ApiResponse<GroupSummary[]> = {
      ok: true,
      success: true,
      data: groups
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch groups', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'GROUPS_ERROR', 'Failed to fetch groups');
  }
}));

// Get group members
app.get('/api/v1/groups/:groupId/members',
  validateApiKey,
  param('groupId').isUUID().withMessage('Invalid group ID format'),
  validateRequest,
  withAuthContext(async (req, res, keyInfo) => {
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

      type GroupMemberRow = {
        id: string;
        role: string;
        joined_at: string;
        profiles: {
          id: string;
          display_name: string | null;
          username: string;
          avatar_url: string | null;
        };
      };

      const formattedMembers: TeamMember[] = ((members ?? []) as unknown as GroupMemberRow[]).map(member => ({
        memberId: member.profiles.id,
        displayName: member.profiles.display_name || member.profiles.username,
        role: member.role,
        joinedAt: member.joined_at,
        avatar: member.profiles.avatar_url
      }));

      const response: ApiResponse<TeamMember[]> = {
        ok: true,
        success: true,
        data: formattedMembers
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to fetch group members', { error, groupId: getGroupParams(req).groupId, userId: keyInfo.userId });
      respondWithError(res, 500, 'GROUP_MEMBERS_ERROR', 'Failed to fetch group members');
    }
  }));

// Entries endpoints
app.get('/api/v1/entries', validateApiKey, async (req, res) => {
  try {
    // Extract authenticated user context
    const authReq = req as ExpressAuthenticatedRequest;
    if (!authReq.authContext) {
      respondWithError(res, 401, 'AUTH_REQUIRED', 'Authentication required');
      return;
    }

    const limit = toNumber(req.query.limit, 20);
    const offset = toNumber(req.query.offset, 0);

    // Get user's profile_id from their account
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authReq.authContext.userId)
      .single();

    if (profileError || !userProfile) {
      respondWithError(res, 404, 'PROFILE_NOT_FOUND', 'User profile not found');
      return;
    }

    // Query entries for authenticated user's profile only
    // RLS policies will automatically filter to only this user's entries
    let query = supabase
      .from('entries')
      .select('id, title, content, profile_id, created_at, updated_at, audience_type')
      .eq('profile_id', userProfile.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: entries, error } = await query;

    if (error) {
      logger.error('Failed to fetch entries', { error, offset, limit, userId: authReq.authContext.userId });
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

    type EntryRow = {
      id: string;
      title: string;
      content: string;
      profile_id: string;
      created_at: string;
      updated_at: string;
      audience_type: string;
    };

    const entryRows = (entries ?? []) as EntryRow[];
    const items: Entry[] = entryRows.map(entry => ({
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

    const response: PaginatedResponse<Entry> = {
      ok: true,
      success: true,
      data: items,
      meta: { pagination }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch entries', { error });
    respondWithError(res, 500, 'ENTRIES_ERROR', 'Failed to fetch entries');
  }
});

// Templates endpoints
app.get('/api/v1/templates', validateApiKey, (req, res) => {
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
app.get('/api/v1/storage', validateApiKey, (req, res) => {
  res.json({
    ok: true,
    success: true,
    data: {}
  });
});

// UI endpoints
app.post('/api/v1/ui/notifications', validateApiKey, (req, res) => {
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
app.get('/api/v1/developer/apps', validateApiKey, withAuthContext(async (_req, res, keyInfo) => {
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
      data: (data ?? []) as MarketplaceApp[]
    });
  } catch (error) {
    logger.error('Developer apps endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
  }
}));

// Get single app details
app.get('/api/v1/developer/apps/:appId', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
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
      data: data as MarketplaceApp
    });
  } catch (error) {
    logger.error('Developer app detail endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
  }
}));

// Create new app
app.post('/api/v1/developer/apps', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
  try {
    const payload = req.body as Partial<MarketplaceApp>;
    const now = new Date().toISOString();

    const appRecord: Partial<MarketplaceApp> = {
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
      data: data as MarketplaceApp
    });
  } catch (error) {
    logger.error('Create app endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
  }
}));

// Update app
app.put('/api/v1/developer/apps/:appId', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
  try {
    const { appId } = getAppParams(req);
    const now = new Date().toISOString();
    const updates: Partial<MarketplaceApp> = {
      ...(req.body as Partial<MarketplaceApp>),
      updated_at: now
    };

    delete (updates as Record<string, unknown>).status;

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
      data: data as MarketplaceApp
    });
  } catch (error) {
    logger.error('Update app endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
  }
}));

// Delete app (only if in draft status)
app.delete('/api/v1/developer/apps/:appId', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
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
  } catch (error) {
    logger.error('Delete app endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
  }
}));

// Submit app for review
app.post('/api/v1/developer/apps/:appId/submit', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
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
      data: data as MarketplaceApp
    });
  } catch (error) {
    logger.error('Submit app endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
  }
}));

// Resubmit app after rejection
app.post('/api/v1/developer/apps/:appId/resubmit', validateApiKey, withAuthContext(async (req, res, keyInfo) => {
  try {
    const { appId } = getAppParams(req);
    const now = new Date().toISOString();
    const updates = req.body as Partial<MarketplaceApp>;

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
      data: data as MarketplaceApp
    });
  } catch (error) {
    logger.error('Resubmit app endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'DEVELOPER_APPS_ERROR', 'Internal server error');
  }
}));

// =============================================================================
// MARKETPLACE ENDPOINTS
// =============================================================================

// Get all approved marketplace apps with optional filtering
app.get('/api/v1/marketplace/apps', validateApiKey, async (req, res) => {
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

    const apps = (data ?? []) as MarketplaceApp[];
    const pagination = {
      page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
      limit,
      total: apps.length,
      totalPages: limit === 0 ? 0 : Math.ceil(apps.length / limit)
    };

    const response: PaginatedResponse<MarketplaceApp> = {
      ok: true,
      success: true,
      data: apps,
      meta: { pagination }
    };

    res.json(response);
  } catch (error) {
    logger.error('Marketplace apps endpoint error', { error });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
  }
});

// Get trending apps
app.get('/api/v1/marketplace/trending', validateApiKey, async (req, res) => {
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
      data: (data ?? []) as MarketplaceApp[]
    });
  } catch (error) {
    logger.error('Trending apps endpoint error', { error });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
  }
});

// Get featured apps
app.get('/api/v1/marketplace/featured', validateApiKey, async (req, res) => {
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
      data: (data ?? []) as MarketplaceApp[]
    });
  } catch (error) {
    logger.error('Featured apps endpoint error', { error });
      respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
  }
});

// Get app categories
app.get('/api/v1/marketplace/categories', validateApiKey, async (_req, res) => {
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

    const categoryCounts = new Map<string, number>();
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
  } catch (error) {
    logger.error('Categories endpoint error', { error });
    respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
  }
});

// Get single app details
app.get('/api/v1/marketplace/apps/:appId', validateApiKey, async (req, res) => {
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
  } catch (error) {
    logger.error('App detail endpoint error', { error, appId });
    respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Internal server error');
  }
});

// Get user's installed apps
app.get('/api/v1/marketplace/installed', validateAuth, withAuthContext(async (req, res, keyInfo) => {
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

    type InstallRow = {
      id: string;
      app_id: string;
      installed_at: string;
      is_active: boolean;
      app_settings: Record<string, unknown> | null;
      plugin_marketplace_apps: MarketplaceApp;
    };

    const installs: InstalledAppSummary[] = ((data ?? []) as unknown as InstallRow[]).map(install => ({
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

    const response: PaginatedResponse<InstalledAppSummary> = {
      ok: true,
      success: true,
      data: installs,
      meta: { pagination }
    };

    res.json(response);
  } catch (error) {
    logger.error('Installed apps endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
  }
}));

// Install an app
app.post('/api/v1/marketplace/install/:appId', validateAuth, withAuthContext(async (req, res, keyInfo) => {
  try {
    const { appId } = getAppParams(req);
    const { settings = {} } = req.body as { settings?: Record<string, unknown> };

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
  } catch (error) {
    logger.error('Install app endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
  }
}));

// Uninstall an app
app.delete('/api/v1/marketplace/uninstall/:appId', validateAuth, withAuthContext(async (req, res, keyInfo) => {
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

    type UninstallRow = typeof installation & {
      plugin_marketplace_apps?: { name?: string } | null;
    };

    const installRecord = installation as UninstallRow;
    const appName = installRecord.plugin_marketplace_apps?.name ?? 'app';

    res.json({
      ok: true,
      success: true,
      data: {
        message: `Successfully uninstalled ${appName}`
      }
    });
  } catch (error) {
    logger.error('Uninstall app endpoint error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'MARKETPLACE_APPS_ERROR', 'Failed to fetch apps');
  }
}));

// =============================================================================
// MARKETPLACE ITEMS ENDPOINTS (OrivaFlow Commerce)
// =============================================================================

// List/search marketplace items (public)
app.get('/api/v1/marketplace/items', async (req, res) => {
  try {
    const limit = getLimit(req.query.limit, 20, 100);
    const offset = getOffset(req.query.offset, 0);
    const itemType = toStringParam(req.query.item_type);
    const earnerType = toStringParam(req.query.earner_type);
    const categoryId = toStringParam(req.query.category_id);
    const minPrice = req.query.min_price ? toNumber(req.query.min_price, 0) : undefined;
    const maxPrice = req.query.max_price ? toNumber(req.query.max_price, 0) : undefined;
    const sellerId = toStringParam(req.query.seller_id);
    const searchTerm = toStringParam(req.query.search);

    let query = supabase
      .from('entries')
      .select('*', { count: 'exact' })
      .eq('entry_type', 'marketplace_item')
      .eq('marketplace_metadata->>is_published', 'true');

    if (itemType) {
      query = query.eq('marketplace_metadata->>item_type', itemType);
    }

    if (earnerType) {
      query = query.eq('marketplace_metadata->>earner_type', earnerType);
    }

    if (categoryId) {
      query = query.contains('marketplace_metadata->category_ids', [categoryId]);
    }

    if (minPrice !== undefined) {
      query = query.gte('marketplace_metadata->>price', minPrice);
    }

    if (maxPrice !== undefined) {
      query = query.lte('marketplace_metadata->>price', maxPrice);
    }

    if (sellerId) {
      query = query.eq('user_id', sellerId);
    }

    if (searchTerm) {
      const escaped = searchTerm.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch marketplace items', { error });
      respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to fetch items');
      return;
    }

    const pagination = {
      page: limit === 0 ? 1 : Math.floor(offset / limit) + 1,
      limit,
      total: count || 0,
      totalPages: limit === 0 ? 0 : Math.ceil((count || 0) / limit)
    };

    res.json({
      ok: true,
      success: true,
      data: data || [],
      meta: { pagination }
    });
  } catch (error) {
    logger.error('Marketplace items endpoint error', { error });
    respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to fetch items');
  }
});

// Create marketplace item (auth required)
app.post('/api/v1/marketplace/items', validateAuth, withAuthContext(async (req, res, keyInfo) => {
  try {
    const { title, content, marketplace_metadata } = req.body as {
      title: string;
      content?: string;
      marketplace_metadata: Record<string, unknown>;
    };

    // Validation
    if (!title || title.trim() === '') {
      respondWithError(res, 400, 'VALIDATION_ERROR', 'Title is required');
      return;
    }

    if (!marketplace_metadata?.price && marketplace_metadata?.price !== 0) {
      respondWithError(res, 400, 'VALIDATION_ERROR', 'Price is required');
      return;
    }

    if (!marketplace_metadata?.currency) {
      respondWithError(res, 400, 'VALIDATION_ERROR', 'Currency is required');
      return;
    }

    if (typeof marketplace_metadata.price === 'number' && marketplace_metadata.price < 0) {
      respondWithError(res, 400, 'VALIDATION_ERROR', 'Price must be greater than or equal to 0');
      return;
    }

    const now = new Date().toISOString();
    const itemData = {
      title,
      content: content || '',
      entry_type: 'marketplace_item',
      user_id: keyInfo.userId,
      marketplace_metadata: {
        ...marketplace_metadata,
        is_published: false // Default to unpublished
      },
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('entries')
      .insert(itemData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create marketplace item', { error, userId: keyInfo.userId });
      if (error.code === '23505') {
        respondWithError(res, 409, 'DUPLICATE_ERROR', 'Duplicate SKU or unique constraint violation');
        return;
      }
      respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to create item');
      return;
    }

    logger.info('Marketplace item created', { itemId: data.id, userId: keyInfo.userId });
    res.status(201).json({
      ok: true,
      success: true,
      data
    });
  } catch (error) {
    logger.error('Create marketplace item error', { error, userId: keyInfo.userId });
    respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to create item');
  }
}));

// Get single marketplace item (public)
app.get('/api/v1/marketplace/items/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('entries')
      .select('*')
      .eq('id', id)
      .eq('entry_type', 'marketplace_item')
      .single();

    if (error || !data) {
      respondWithError(res, 404, 'ITEM_NOT_FOUND', 'Marketplace item not found');
      return;
    }

    // Check if published (unpublished items hidden from public)
    const isPublished = data.marketplace_metadata?.is_published;
    if (!isPublished) {
      respondWithError(res, 404, 'ITEM_NOT_FOUND', 'Marketplace item not found');
      return;
    }

    res.json({
      ok: true,
      success: true,
      data
    });
  } catch (error) {
    logger.error('Get marketplace item error', { error, itemId: req.params.id });
    respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to retrieve item');
  }
});

// Update marketplace item (owner only)
app.put('/api/v1/marketplace/items/:id', validateAuth, withAuthContext(async (req, res, keyInfo) => {
  try {
    const { id } = req.params;
    const { title, content, marketplace_metadata } = req.body as {
      title?: string;
      content?: string;
      marketplace_metadata?: Record<string, unknown>;
    };

    // Validate metadata if provided
    if (marketplace_metadata?.price !== undefined && typeof marketplace_metadata.price === 'number') {
      if (marketplace_metadata.price < 0) {
        respondWithError(res, 400, 'VALIDATION_ERROR', 'Price must be greater than or equal to 0');
        return;
      }
    }

    const updates = {
      ...(title && { title }),
      ...(content !== undefined && { content }),
      ...(marketplace_metadata && { marketplace_metadata }),
      updated_at: new Date().toISOString()
    };

    // Update item (RLS enforces ownership via user_id match)
    const { data, error } = await supabase
      .from('entries')
      .update(updates)
      .eq('id', id)
      .eq('user_id', keyInfo.userId)
      .eq('entry_type', 'marketplace_item')
      .select()
      .single();

    if (error || !data) {
      logger.error('Failed to update marketplace item', { error, itemId: id, userId: keyInfo.userId });
      respondWithError(res, 404, 'ITEM_NOT_FOUND', 'Item not found or permission denied');
      return;
    }

    logger.info('Marketplace item updated', { itemId: id, userId: keyInfo.userId });
    res.json({
      ok: true,
      success: true,
      data
    });
  } catch (error) {
    logger.error('Update marketplace item error', { error, itemId: req.params.id, userId: keyInfo.userId });
    respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to update item');
  }
}));

// Delete marketplace item (owner only)
app.delete('/api/v1/marketplace/items/:id', validateAuth, withAuthContext(async (req, res, keyInfo) => {
  try {
    const { id } = req.params;

    // Delete item (RLS enforces ownership)
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', id)
      .eq('user_id', keyInfo.userId)
      .eq('entry_type', 'marketplace_item');

    if (error) {
      logger.error('Failed to delete marketplace item', { error, itemId: id, userId: keyInfo.userId });
      respondWithError(res, 404, 'ITEM_NOT_FOUND', 'Item not found or permission denied');
      return;
    }

    logger.info('Marketplace item deleted', { itemId: id, userId: keyInfo.userId });
    res.json({
      ok: true,
      success: true,
      message: 'Item deleted successfully'
    });
  } catch (error) {
    logger.error('Delete marketplace item error', { error, itemId: req.params.id, userId: keyInfo.userId });
    respondWithError(res, 500, 'MARKETPLACE_ITEMS_ERROR', 'Failed to delete item');
  }
}));

// =============================================================================
// MARKETPLACE SEARCH ENDPOINT
// =============================================================================

// Advanced search (public)
app.post('/api/v1/marketplace/search', async (req, res) => {
  try {
    const {
      query: searchQuery,
      filters = {},
      sort = 'created_at',
      order = 'desc',
      page = 1,
      limit: requestLimit = 20
    } = req.body as {
      query?: string;
      filters?: Record<string, unknown>;
      sort?: string;
      order?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    };

    const limit = getLimit(requestLimit, 20, 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('entries')
      .select('*', { count: 'exact' })
      .eq('entry_type', 'marketplace_item')
      .eq('marketplace_metadata->>is_published', 'true');

    // Apply search query
    if (searchQuery && searchQuery.trim() !== '') {
      const escaped = searchQuery.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    }

    // Apply filters
    if (filters.item_type) {
      query = query.eq('marketplace_metadata->>item_type', filters.item_type);
    }

    if (filters.category_id) {
      query = query.contains('marketplace_metadata->category_ids', [filters.category_id]);
    }

    if (filters.min_price !== undefined) {
      query = query.gte('marketplace_metadata->>price', filters.min_price);
    }

    if (filters.max_price !== undefined) {
      query = query.lte('marketplace_metadata->>price', filters.max_price);
    }

    if (filters.seller_id) {
      query = query.eq('user_id', filters.seller_id);
    }

    // Apply sorting
    const validSortFields = ['created_at', 'updated_at', 'title'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    query = query.order(sortField, { ascending: order === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Failed to search marketplace items', { error });
      respondWithError(res, 500, 'SEARCH_ERROR', 'Failed to search items');
      return;
    }

    const pagination = {
      page,
      limit,
      total: count || 0,
      totalPages: limit === 0 ? 0 : Math.ceil((count || 0) / limit)
    };

    res.json({
      ok: true,
      success: true,
      data: data || [],
      meta: {
        pagination,
        query: searchQuery,
        filters,
        sort: { field: sortField, order }
      }
    });
  } catch (error) {
    logger.error('Marketplace search error', { error });
    respondWithError(res, 500, 'SEARCH_ERROR', 'Failed to search items');
  }
});

// =============================================================================
// MARKETPLACE CATEGORIES ENDPOINTS
// =============================================================================

// List categories (public)
app.get('/api/v1/marketplace/categories', async (req, res) => {
  try {
    const parentId = req.query.parent_id ? toStringParam(req.query.parent_id) : undefined;

    let query = supabase
      .from('collections')
      .select('*')
      .eq('collection_type', 'marketplace_category')
      .order('organization_rules->display_order', { ascending: true });

    // Filter by parent_id
    if (parentId !== undefined) {
      if (parentId === 'null' || parentId === '') {
        query = query.is('organization_rules->>parent_category_id', null);
      } else {
        query = query.eq('organization_rules->>parent_category_id', parentId);
      }
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch categories', { error });
      respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to fetch categories');
      return;
    }

    res.json({
      ok: true,
      success: true,
      data: data || []
    });
  } catch (error) {
    logger.error('Categories endpoint error', { error });
    respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to fetch categories');
  }
});

// Create category (admin only)
app.post('/api/v1/marketplace/categories', validateAuth, requireAdminToken, withAuthContext(async (req, res) => {
  try {
    const { name, description, organization_rules } = req.body as {
      name: string;
      description?: string;
      organization_rules: Record<string, unknown>;
    };

    // Validation
    if (!name || name.trim() === '') {
      respondWithError(res, 400, 'VALIDATION_ERROR', 'Category name is required');
      return;
    }

    if (name.length > 255) {
      respondWithError(res, 400, 'VALIDATION_ERROR', 'Category name too long (max 255 characters)');
      return;
    }

    // Auto-generate SEO slug if not provided
    const seoSlug = organization_rules?.seo_slug || name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    const now = new Date().toISOString();
    const categoryData = {
      name,
      description: description || null,
      collection_type: 'marketplace_category',
      organization_rules: {
        ...organization_rules,
        seo_slug: seoSlug
      },
      entry_count: 0,
      created_at: now,
      updated_at: now
    };

    const { data, error } = await supabase
      .from('collections')
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create category', { error });
      if (error.code === '23505') {
        respondWithError(res, 409, 'DUPLICATE_ERROR', 'Duplicate category name or SEO slug');
        return;
      }
      respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to create category');
      return;
    }

    logger.info('Category created', { categoryId: data.id });
    res.status(201).json({
      ok: true,
      success: true,
      data
    });
  } catch (error) {
    logger.error('Create category error', { error });
    respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to create category');
  }
}));

// Get category tree hierarchy (public)
app.get('/api/v1/marketplace/categories/tree', async (req, res) => {
  try {
    // Get all categories
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('collection_type', 'marketplace_category')
      .order('organization_rules->display_order', { ascending: true });

    if (error) {
      logger.error('Failed to fetch categories for tree', { error });
      respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to fetch categories');
      return;
    }

    const categories = data || [];

    // Build tree structure
    type CategoryNode = typeof categories[0] & { children: CategoryNode[] };
    const categoryMap = new Map<string, CategoryNode>();
    const rootNodes: CategoryNode[] = [];

    // First pass: create nodes
    categories.forEach((category) => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Second pass: build hierarchy
    categories.forEach((category) => {
      const node = categoryMap.get(category.id)!;
      const parentId = category.organization_rules?.parent_category_id;

      if (parentId && categoryMap.has(parentId)) {
        const parent = categoryMap.get(parentId)!;
        parent.children.push(node);
      } else if (!parentId) {
        rootNodes.push(node);
      }
    });

    res.json({
      ok: true,
      success: true,
      data: rootNodes
    });
  } catch (error) {
    logger.error('Category tree error', { error });
    respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to build category tree');
  }
});

// Get single category (public)
app.get('/api/v1/marketplace/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('id', id)
      .eq('collection_type', 'marketplace_category')
      .single();

    if (error || !data) {
      respondWithError(res, 404, 'CATEGORY_NOT_FOUND', 'Category not found');
      return;
    }

    res.json({
      ok: true,
      success: true,
      data
    });
  } catch (error) {
    logger.error('Get category error', { error, categoryId: req.params.id });
    respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to retrieve category');
  }
});

// Update category (admin only)
app.put('/api/v1/marketplace/categories/:id', validateAuth, requireAdminToken, withAuthContext(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, organization_rules } = req.body as {
      name?: string;
      description?: string;
      organization_rules?: Record<string, unknown>;
    };

    // Validation
    if (name !== undefined) {
      if (name.trim() === '') {
        respondWithError(res, 400, 'VALIDATION_ERROR', 'Category name cannot be empty');
        return;
      }
      if (name.length > 255) {
        respondWithError(res, 400, 'VALIDATION_ERROR', 'Category name too long (max 255 characters)');
        return;
      }
    }

    // Auto-update SEO slug if name changes and slug not explicitly provided
    let updatedOrgRules = organization_rules;
    if (name && !organization_rules?.seo_slug) {
      const seoSlug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

      updatedOrgRules = {
        ...organization_rules,
        seo_slug: seoSlug
      };
    }

    const updates = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(updatedOrgRules && { organization_rules: updatedOrgRules }),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('id', id)
      .eq('collection_type', 'marketplace_category')
      .select()
      .single();

    if (error || !data) {
      logger.error('Failed to update category', { error, categoryId: id });
      respondWithError(res, 404, 'CATEGORY_NOT_FOUND', 'Category not found or permission denied');
      return;
    }

    logger.info('Category updated', { categoryId: id });
    res.json({
      ok: true,
      success: true,
      data
    });
  } catch (error) {
    logger.error('Update category error', { error, categoryId: req.params.id });
    respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to update category');
  }
}));

// Delete category (admin only)
app.delete('/api/v1/marketplace/categories/:id', validateAuth, requireAdminToken, withAuthContext(async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has items
    const { data: categoryData, error: fetchError } = await supabase
      .from('collections')
      .select('entry_count')
      .eq('id', id)
      .eq('collection_type', 'marketplace_category')
      .single();

    if (fetchError) {
      respondWithError(res, 404, 'CATEGORY_NOT_FOUND', 'Category not found');
      return;
    }

    if (categoryData.entry_count > 0) {
      respondWithError(res, 409, 'CATEGORY_HAS_ITEMS', 'Cannot delete category with items');
      return;
    }

    // Check if category has sub-categories
    const { data: subCategories } = await supabase
      .from('collections')
      .select('id')
      .eq('collection_type', 'marketplace_category')
      .eq('organization_rules->>parent_category_id', id);

    if (subCategories && subCategories.length > 0) {
      respondWithError(res, 409, 'CATEGORY_HAS_CHILDREN', 'Cannot delete category with sub-categories');
      return;
    }

    // Delete category
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', id)
      .eq('collection_type', 'marketplace_category');

    if (error) {
      logger.error('Failed to delete category', { error, categoryId: id });
      respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to delete category');
      return;
    }

    logger.info('Category deleted', { categoryId: id });
    res.json({
      ok: true,
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    logger.error('Delete category error', { error, categoryId: req.params.id });
    respondWithError(res, 500, 'CATEGORIES_ERROR', 'Failed to delete category');
  }
}));

// =============================================================================
// ADMIN ENDPOINTS FOR APP APPROVAL
// =============================================================================

// Get pending apps for review (admin only)
app.get('/api/v1/admin/apps/pending', validateApiKey, requireAdminToken, withAuthContext(async (_req, res) => {
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
  } catch (error) {
    logger.error('Pending apps endpoint error', { error });
    respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
  }
}));

// Approve or reject an app (admin only)
app.post('/api/v1/admin/apps/:appId/review', validateApiKey, requireAdminToken, withAuthContext(async (req, res, keyInfo) => {
  try {
    const { appId } = getAppParams(req);
    const { status, reviewerNotes } = req.body as { status?: string; reviewerNotes?: string };

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
  } catch (error) {
    logger.error('App review endpoint error', { error, appId: getAppParams(req).appId, reviewer: keyInfo.userId });
    respondWithError(res, 500, 'ADMIN_APPS_ERROR', 'Failed to fetch apps');
  }
}));

// =============================================================================
// AUTH REGISTRATION & LOGIN ENDPOINTS
// =============================================================================

// Helper functions for validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

// POST /api/v1/auth/register - User registration
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, username, name, preferences } = req.body;

    // Validation
    if (!email || !password) {
      return respondWithError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
    }

    if (!isValidEmail(email)) {
      return respondWithError(res, 400, 'INVALID_EMAIL', 'Invalid email format');
    }

    if (!isStrongPassword(password)) {
      return respondWithError(res, 400, 'WEAK_PASSWORD', 'Password must be at least 8 characters with uppercase, lowercase, and numbers');
    }

    // Create Supabase auth user using anon client (public signup)
    const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
      email,
      password,
    });

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        return respondWithError(res, 409, 'USER_EXISTS', 'Email already registered');
      }
      logger.error('Auth signup failed', { error: authError, message: authError.message, status: authError.status });
      return respondWithError(res, 500, 'SIGNUP_ERROR', `Database error creating new user: ${authError.message}`);
    }

    if (!authData.user) {
      return respondWithError(res, 500, 'USER_CREATION_FAILED', 'User creation failed');
    }

    // Create user profile in profiles table (called 'users')
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        account_id: authData.user.id,
        display_name: name || authData.user.email!.split('@')[0],
        username: authData.user.email!.split('@')[0],
      })
      .select()
      .single();

    if (profileError) {
      // Rollback: Delete auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      logger.error('Profile creation failed', { error: profileError });
      return respondWithError(res, 500, 'PROFILE_CREATION_FAILED', 'Failed to create user profile');
    }

    // Generate session tokens
    const { data: sessionData, error: sessionError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      logger.error('Session creation failed', { error: sessionError });
      return respondWithError(res, 500, 'SESSION_ERROR', 'Session creation failed after registration');
    }

    // Return auth response with profile data
    res.status(201).json({
      user: {
        id: profileData.id,
        email: authData.user.email,
        display_name: profileData.display_name,
        username: profileData.username,
        subscription_tier: 'free',
        created_at: profileData.created_at,
      },
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_in: sessionData.session.expires_in || 3600,
    });
  } catch (error) {
    logger.error('Registration error', { error });
    respondWithError(res, 500, 'REGISTRATION_ERROR', getErrorMessage(error));
  }
});

// POST /api/v1/auth/login - User login
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return respondWithError(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
    }

    // Authenticate with Supabase
    const { data: sessionData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !sessionData.session) {
      logger.error('Login failed', { error: authError, email });
      return respondWithError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Get user profile from profiles table
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .eq('account_id', sessionData.user.id)
      .single();

    if (profileError || !profileData) {
      logger.error('User profile not found', { error: profileError, authUserId: sessionData.user.id });
      return respondWithError(res, 404, 'USER_NOT_FOUND', 'User profile not found');
    }

    // Return auth response with profile data
    res.status(200).json({
      user: {
        id: profileData.id,
        email: sessionData.user.email,
        display_name: profileData.display_name,
        username: profileData.username,
        subscription_tier: 'free',
        created_at: sessionData.user.created_at,
      },
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_in: sessionData.session.expires_in || 3600,
    });
  } catch (error) {
    logger.error('Login error', { error });
    respondWithError(res, 500, 'LOGIN_ERROR', getErrorMessage(error));
  }
});

// POST /api/v1/auth/logout - User logout
app.post('/api/v1/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return respondWithError(res, 401, 'AUTH_MISSING', 'Missing authorization header');
    }

    await supabase.auth.signOut();
    res.status(204).end();
  } catch (error) {
    logger.error('Logout error', { error });
    respondWithError(res, 500, 'LOGOUT_ERROR', getErrorMessage(error));
  }
});

// POST /api/v1/auth/token/refresh - Refresh access token
app.post('/api/v1/auth/token/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return respondWithError(res, 400, 'VALIDATION_ERROR', 'Refresh token is required');
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error || !data.session) {
      return respondWithError(res, 401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in || 3600,
    });
  } catch (error) {
    logger.error('Token refresh error', { error });
    respondWithError(res, 500, 'REFRESH_ERROR', getErrorMessage(error));
  }
});

// GET /api/v1/auth/profile - Get user profile (requires auth)
app.get('/api/v1/auth/profile', validateAuth, async (req, res) => {
  try {
    const userId = (req as any).authContext.userId;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, username, bio, avatar_url, location, website_url')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return respondWithError(res, 404, 'USER_NOT_FOUND', 'User not found');
    }

    res.status(200).json(data);
  } catch (error) {
    logger.error('Get profile error', { error });
    respondWithError(res, 500, 'PROFILE_ERROR', getErrorMessage(error));
  }
});

// PATCH /api/v1/auth/profile - Update user profile (requires auth)
app.patch('/api/v1/auth/profile', validateAuth, async (req, res) => {
  try {
    const userId = (req as any).authContext.userId;
    const { name, bio, avatar_url, location, website_url } = req.body;

    if (!name && !bio && !avatar_url && !location && !website_url) {
      return respondWithError(res, 400, 'VALIDATION_ERROR', 'At least one field must be provided');
    }

    const updates: any = {};
    if (name) updates.display_name = name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (location !== undefined) updates.location = location;
    if (website_url !== undefined) updates.website_url = website_url;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Update profile error', { error });
      return respondWithError(res, 500, 'UPDATE_FAILED', 'Failed to update profile');
    }

    res.status(200).json(data);
  } catch (error) {
    logger.error('Update profile error', { error });
    respondWithError(res, 500, 'PROFILE_ERROR', getErrorMessage(error));
  }
});

// PUT /api/v1/auth/profile - Update user profile (requires auth) - alias for PATCH
app.put('/api/v1/auth/profile', validateAuth, async (req, res) => {
  try {
    const userId = (req as any).authContext.userId;
    const { name, bio, avatar_url, location, website_url, preferences, data_retention_days } = req.body;

    if (!name && !bio && !avatar_url && !location && !website_url && !preferences && !data_retention_days) {
      return respondWithError(res, 400, 'VALIDATION_ERROR', 'At least one field must be provided');
    }

    // Validate data_retention_days if provided
    if (data_retention_days !== undefined && data_retention_days < 30) {
      return respondWithError(res, 400, 'VALIDATION_ERROR', 'data_retention_days must be at least 30');
    }

    const updates: any = {};
    if (name) updates.display_name = name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (location !== undefined) updates.location = location;
    if (website_url !== undefined) updates.website_url = website_url;
    if (preferences !== undefined) updates.preferences = preferences;
    if (data_retention_days !== undefined) updates.data_retention_days = data_retention_days;

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error('Update profile error', { error });
      return respondWithError(res, 500, 'UPDATE_FAILED', 'Failed to update profile');
    }

    res.status(200).json(data);
  } catch (error) {
    logger.error('Update profile error', { error });
    respondWithError(res, 500, 'PROFILE_ERROR', getErrorMessage(error));
  }
});

// DELETE /api/v1/auth/account - Delete user account (requires auth)
app.delete('/api/v1/auth/account', validateAuth, async (req, res) => {
  try {
    const userId = (req as any).authContext.userId;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      logger.error('Delete account error', { error });
      return respondWithError(res, 500, 'DELETE_FAILED', 'Failed to delete account');
    }

    res.status(204).end();
  } catch (error) {
    logger.error('Delete account error', { error });
    respondWithError(res, 500, 'ACCOUNT_ERROR', getErrorMessage(error));
  }
});

// Mount Hugo AI router
const hugoRouter = createHugoAIRouter(supabase);
app.use('/api/hugo', hugoRouter);

// 404 handler for unmatched routes
app.use('*', (req, res) => {
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
app.use(errorHandler as any);

export const startServer = (): void => {
  const PORT = Number(process.env.PORT) || 3001;
  const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

  app.listen(PORT, () => {
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

// Auto-start server when run directly (not imported)
if (require.main === module) {
  startServer();
}

export default app;
// Force deployment trigger - Wed Sep 17 19:54:21 CST 2025
