// Load environment variables FIRST before any imports
// Load .env first, then .env.local to allow local overrides
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

// DATADOG APM - Must be initialized before any other imports
if (process.env.DD_API_KEY) {
  require('dd-trace').init({
    service: 'oriva-api-legacy',
    env: process.env.DD_ENV || process.env.NODE_ENV || 'production',
    version: process.env.DD_VERSION || process.env.API_VERSION || '1.0.0',
    logInjection: true, // Automatically inject trace IDs into logs
    analytics: true, // Enable analytics
    runtimeMetrics: true, // Collect runtime metrics
  });
}

import express, { type Request, type Response } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { param, validationResult } from 'express-validator';
import winston from 'winston';
import type { Logger } from 'winston';

import type { AuthenticatedRequest, ApiMiddleware, ApiKeyInfo } from '../src/types/middleware/auth';
import { type Entry, type Group, type Profile } from '../src/types/database/entities';
import { createAuthError, createValidationError, toErrorResponse } from '../src/types/errors';
// Removed: createAuthMiddleware and createLegacyApiKeyMiddleware (not implemented)
// import {
//   createAuthMiddleware,
//   createLegacyApiKeyMiddleware
// } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/error-handler';
import { createMerlinAIRouter } from '../src/routes/merlin-ai';
import photosRouter from '../src/express/routes/photos';
import userMediaRouter from '../src/express/routes/userMedia';
import videoMeetingsRouter from '../src/express/routes/video-meetings';
// NOTE: Travel Hub routes removed - use o-orig /api/tenant/travel-hub/* instead
import hugoLoveRouter from '../src/express/routes/hugo-love';
import askMeAnythingRouter from '../src/express/routes/ask-me-anything';
import locationsRouter from '../src/express/routes/locations';
import { createOrivaEventsRouter } from '../src/express/routes/oriva-events';
import { createAuthPublicRouter } from '../src/express/routes/auth-public';
import { createMarketplaceRouter } from '../src/express/routes/marketplace';
import { createUserPublicRouter } from '../src/express/routes/user-public';
// TEMPORARILY DISABLED - limohawk feature incomplete, missing service files
// import limohawkRouter from '../src/express/routes/limohawk';
import { optionalSchemaRouter } from '../src/express/middleware/schemaRouter';
import { validateContentType } from '../src/express/middleware/contentTypeValidator';
import { requestIdMiddleware } from '../src/express/middleware/requestId';
import { respondWithError } from '../src/express/utils/response';
import { getErrorMessage } from '../src/express/utils/query';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from '../src/openapi/spec';

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
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({ filename: 'error.log', level: 'error' }),
          new winston.transports.File({ filename: 'combined.log' }),
        ]
      : []),
  ],
});

const asAuthRequest = (req: Request): AuthenticatedRequest => req as AuthenticatedRequest;

const API_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 1000);

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

const withAuthContext = (handler: AuthenticatedHandler) => async (req: Request, res: Response) => {
  const context = getAuthContext(req, res);
  if (!context) {
    return;
  }
  await handler(context.authReq, res, context.keyInfo);
};

/**
 * Check if an origin is a valid localhost origin
 * Supports: localhost, 127.0.0.1, host.docker.internal, any port
 */
function isLocalhostOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'host.docker.internal' ||
      hostname === '::1' // IPv6 localhost
    );
  } catch {
    return false;
  }
}

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
      .map((app) => {
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
      ...appDomains,
    ]);
    corsOriginCache.lastUpdated = Date.now();

    logger.info('CORS: Cache refreshed', {
      totalOrigins: corsOriginCache.data.size,
      appOrigins: appDomains.length,
    });
    return true;
  } catch (error) {
    logger.error('CORS: Error refreshing cache', { error });
    return false;
  }
}

// ============================================================================
// CORS Configuration: Allowed Origins for Cross-Origin Requests
// ============================================================================

/**
 * Core origins that must always work (high-trust domains)
 *
 * Configuration strategy:
 * 1. CORS_ORIGIN env var: Comma-separated list to override defaults (production)
 * 2. Default origins: Built-in for production deployments and common dev ports
 * 3. Development mode: Additional flexible localhost handling in middleware (line 321)
 *
 * Environment Variables:
 * - CORS_ORIGIN: Override default origins (comma-separated, no spaces)
 *   Example: CORS_ORIGIN=https://custom.domain,https://another.domain
 * - NODE_ENV: If 'development', all localhost:* origins are allowed
 *
 * Local Development Ports:
 * - 8081: o-core (React Native / Expo) Metro bundler
 * - 8084: o-orig (Ultra Concierge) Metro bundler
 * - 8087: o-orig (Love Puzl) Metro bundler
 * - 3000: Next.js development server (e.g., o-orig web app)
 * - 5173: Vite development server
 */
const STATIC_CORS_ORIGINS = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || [
  // Production deployments
  'https://oriva.io',
  'https://www.oriva.io',
  'https://app.oriva.io',
  'https://o-originals.vercel.app', // o-orig marketplace apps deployment

  // Local development - specific ports (serves as fallback when NODE_ENV !== 'development')
  'http://localhost:8081', // o-core Metro bundler
  'http://localhost:8084', // o-orig Ultra Concierge Metro bundler
  'http://localhost:8087', // o-orig Love Puzl Metro bundler
  'http://localhost:3000', // Next.js dev server
  'http://localhost:5173', // Vite dev server
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8084',
  'http://127.0.0.1:8087',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

// CORS cache for marketplace apps (loaded at startup)
const corsOriginCache = {
  data: new Set(STATIC_CORS_ORIGINS), // Initialize with static origins
  lastUpdated: 0,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
};

// NOTE: CORS cache initialization moved AFTER Supabase client is created (around line 590)
// The refreshCorsCache() function requires the supabase client to be initialized first

// SECURITY: Dynamic CORS for marketplace applications
// Note on CSRF: This API uses token-based authentication (X-API-Key + Bearer JWT), NOT cookies.
// CSRF attacks exploit cookies that browsers automatically attach to requests.
// Since our auth is header-based (must be explicitly added by client code), CSRF is not applicable.
// Therefore, allowing no-origin requests is safe as security is enforced by token validation.
app.use(
  cors({
    origin: (origin, callback) => {
      // No origin header = server-to-server or direct request (curl, monitoring, webhooks)
      // CORS is a browser-only mechanism - requests without Origin are NOT from browsers
      // We allow these because:
      // 1. Health checks from monitoring services don't have Origin
      // 2. Server-to-server API calls don't have Origin
      // 3. Curl/wget/Postman testing doesn't have Origin
      // 4. Mobile apps may not send Origin header
      // SECURITY: Authentication is enforced by API key + JWT validation, not CORS
      if (!origin) {
        logger.debug('CORS: No origin header - allowing non-browser request');
        return callback(null, true);
      }

      /**
       * LOCALHOST CORS HANDLING (Development Mode)
       *
       * In development mode, we allow ALL localhost origins to facilitate:
       * - Multiple Metro bundlers (8081, 8084, 8087, custom ports)
       * - Next.js dev servers (3000, 3001, etc.)
       * - Vite dev servers (5173, 5174, etc.)
       * - Docker localhost access (host.docker.internal)
       * - Playwright testing via host.docker.internal
       * - IPv6 localhost (::1)
       *
       * This is safe because:
       * 1. Development only (NODE_ENV === 'development')
       * 2. Authentication is still enforced (API keys, JWT tokens)
       * 3. Localhost is non-routable by default (no external risk)
       */
      if (process.env.NODE_ENV === 'development' && isLocalhostOrigin(origin)) {
        logger.debug('CORS: Development localhost origin allowed', {
          origin,
          mode: 'dev-flexible',
        });
        return callback(null, true);
      }

      // Vercel preview URLs for o-originals (o-orig) deployments
      // Pattern: https://o-originals-{hash}-orivas-projects.vercel.app
      if (origin.match(/^https:\/\/o-originals-[a-z0-9]+-orivas-projects\.vercel\.app$/)) {
        logger.debug('CORS: Vercel preview origin allowed', { origin });
        return callback(null, true);
      }

      // Check against registered marketplace applications
      if (corsOriginCache.data.has(origin)) {
        logger.debug('CORS: Registered marketplace origin allowed', { origin });
        return callback(null, true);
      }

      // Other core origins - ALWAYS allowed (static, no dependencies)
      // NOTE: o-originals.vercel.app hosts iframe apps launched from oriva.io app launcher
      const coreOrigins = [
        'https://oriva.io',
        'https://www.oriva.io',
        'https://app.oriva.io',
        'https://o-originals.vercel.app',
      ];

      if (coreOrigins.includes(origin)) {
        logger.debug('CORS: Core origin allowed', { origin });
        return callback(null, true);
      }

      // Check marketplace cache (synchronous only) - with safety checks
      try {
        if (
          corsOriginCache &&
          corsOriginCache.data &&
          corsOriginCache.data.has &&
          corsOriginCache.data.has(origin)
        ) {
          logger.debug('CORS: Marketplace origin allowed', { origin });
          return callback(null, true);
        }
      } catch (error) {
        logger.error('CORS: Cache check failed', { error: getErrorMessage(error) });
      }

      // Log rejected origins for debugging
      logger.warn('CORS: Origin rejected', {
        origin,
        cacheExists: !!corsOriginCache,
        cacheDataExists: !!corsOriginCache?.data,
        cacheSize: corsOriginCache?.data?.size || 0,
        cacheAge: corsOriginCache?.lastUpdated
          ? Date.now() - corsOriginCache.lastUpdated
          : 'unknown',
      });
      return callback(new Error('Not allowed by CORS'));
    },
    // Methods allowed for CORS preflight
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Extension-ID',
      'X-Client-ID',
      'X-API-Key',
      'X-App-ID',
      'X-Tenant-ID',
      'X-Profile-ID',
      'User-Agent',
      'X-User-ID',
      'X-Request-ID',
    ],
    credentials: true,
  })
);

// SECURITY: Enforce HTTPS in production
app.use((req, res, next) => {
  // Skip HTTPS enforcement in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    return next();
  }

  // Check if request is secure (handles proxies via x-forwarded-proto)
  const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';

  if (!isSecure) {
    logger.warn('HTTPS required: rejecting insecure request', {
      path: req.path,
      ip: req.ip,
    });
    return res.status(403).json({
      code: 'HTTPS_REQUIRED',
      message: 'HTTPS is required for API access',
    });
  }

  next();
});

// SECURITY: Add security headers (Helmet)
// Configured for API responses, not web pages
import helmet from 'helmet';

app.use(
  helmet({
    // SECURITY: Disable CSP for API - it's meant for HTML pages, not JSON responses
    // APIs don't serve executable content that CSP protects against
    contentSecurityPolicy: false,

    // SECURITY: HSTS - force HTTPS for 1 year, include subdomains
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },

    // SECURITY: Prevent clickjacking - API shouldn't be framed
    frameguard: {
      action: 'deny',
    },

    // SECURITY: Prevent MIME type sniffing
    noSniff: true,

    // SECURITY: X-XSS-Protection is deprecated, let helmet use default (disabled)
    // Modern browsers have better built-in protections

    // SECURITY: Control referrer information
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },

    // SECURITY: Cross-Origin policies for modern browsers
    crossOriginEmbedderPolicy: false, // Disabled - APIs don't embed cross-origin content
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin API access

    // SECURITY: Disable deprecated/unnecessary headers for APIs
    dnsPrefetchControl: { allow: false },
    ieNoOpen: true,
    originAgentCluster: true,
  })
);

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
        'content-type',
        'authorization',
        'x-extension-id',
        'x-client-id',
        'x-api-key',
        'user-agent',
        'x-user-id',
        'x-request-id',
      ];

      const requestedHeadersArray = requestedHeaders
        .toLowerCase()
        .split(',')
        .map((h) => h.trim());
      const blockedHeaders = requestedHeadersArray.filter(
        (header) => !currentAllowedHeaders.includes(header)
      );

      if (blockedHeaders.length > 0) {
        logger.warn('CORS: Blocked headers detected', {
          origin,
          requestedHeaders: requestedHeadersArray,
          blockedHeaders,
          timestamp: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
        });
      }
    }
  }
  next();
});

app.use(express.json());

// OBSERVABILITY: Request ID tracking
app.use(requestIdMiddleware);

// OBSERVABILITY: API version header
app.use((req, res, next) => {
  res.setHeader('X-API-Version', process.env.API_VERSION || '1.0.0');
  next();
});

// SECURITY: Validate Content-Type headers
app.use(validateContentType);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: API_RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('API Request', {
      requestId: (req as any).requestId,
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
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
  supabaseUrlSource: process.env.SUPABASE_URL
    ? 'SUPABASE_URL'
    : process.env.EXPO_PUBLIC_SUPABASE_URL
      ? 'EXPO_PUBLIC_SUPABASE_URL'
      : 'MISSING',
  nodeEnv: process.env.NODE_ENV,
  supabaseUrlValue: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
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

// Initialize CORS cache NOW that Supabase is ready
// This must happen AFTER supabase client is created
refreshCorsCache()
  .then(() => {
    console.log('✅ CORS cache initialized with registered app domains');
  })
  .catch((error) => {
    console.warn('⚠️ Failed to initialize CORS cache, using static origins only:', error.message);
    // Ensure static origins are still in cache if refresh failed
    STATIC_CORS_ORIGINS.forEach((origin) => corsOriginCache.data.add(origin));
  });

// CORS cache defined above

// Admin token from environment (used to protect dev-only endpoints)
const ADMIN_TOKEN = process.env.ORIVA_ADMIN_TOKEN || '';

// Very small in-memory rate limiter for dev endpoints (per IP)
const rateLimitState = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP for dev endpoints

const devRateLimiter: ApiMiddleware = (req, res, next) => {
  const now = Date.now();
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';
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
    authType: 'api_key' as const,
  };
  next();
};

// API Key validation using Supabase
const hashAPIKey = async (key: string): Promise<string> => {
  try {
    console.log('🔐 DEBUG: Starting hashAPIKey', {
      keyLength: key.length,
      keyPrefix: key.substring(0, 20),
    });

    // Check if crypto.subtle is available
    if (!webcrypto?.subtle) {
      console.error('❌ crypto.subtle not available');
      throw new Error('crypto.subtle not available');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hash = Array.from(hashArray, (byte) => byte.toString(16).padStart(2, '0')).join('');

    console.log('✅ DEBUG: hashAPIKey success', {
      hashLength: hash.length,
      hashPrefix: hash.substring(0, 16),
    });
    return hash;
  } catch (error) {
    console.error('❌ DEBUG: hashAPIKey failed', { error: getErrorMessage(error) });
    throw error instanceof Error ? error : new Error(getErrorMessage(error));
  }
};

// Import authentication and rate limiting middleware
import { createAuthMiddleware, createOptionalAuthMiddleware } from '../src/middleware/auth';
import { apiRateLimiter } from '../src/middleware/rateLimiter';

// Authentication middleware (includes rate limiting)
const validateAuth = createAuthMiddleware(); // Returns [rateLimiter, authHandler]

// API Key validation middleware
const validateApiKey: ApiMiddleware = async (req, res, next) => {
  try {
    // Check X-API-Key header first (preferred for API keys from o-orig apps)
    // Fall back to Authorization header for backward compatibility
    const xApiKey = req.headers['x-api-key'] as string | undefined;
    const authHeader = xApiKey || req.headers.authorization;

    // Allow development mode bypass for specific endpoints
    if (process.env.NODE_ENV === 'development' && !authHeader) {
      // In development mode without auth header, create a dev context
      // IMPORTANT: This only works in development mode and requires DEV_USER_ID env var
      // In production, NODE_ENV will be 'production' so this code path is never executed
      const devUserId = process.env.DEV_USER_ID;

      if (!devUserId) {
        logger.warn(
          'Dev mode: No DEV_USER_ID environment variable set. ' +
            'Set DEV_USER_ID in .env to use dev mode without API key. ' +
            'Requests will proceed but may return empty results.'
        );
        // Use a placeholder that won't match any real user
        // Queries will return empty results instead of crashing
        const authReq = asAuthRequest(req);
        authReq.keyInfo = {
          id: 'dev_key',
          userId: '__dev_user_placeholder__',
          name: 'Development User (No DEV_USER_ID set)',
          permissions: ['read:profiles', 'write:sessions', 'read:sessions'],
          usageCount: 0,
          isActive: true,
          authType: 'api_key' as const,
          lastUsedAt: undefined,
        };
        next();
        return;
      }

      const authReq = asAuthRequest(req);
      authReq.keyInfo = {
        id: 'dev_key',
        userId: devUserId, // From DEV_USER_ID environment variable
        name: 'Development User',
        permissions: ['read:profiles', 'write:sessions', 'read:sessions'],
        usageCount: 0,
        isActive: true,
        authType: 'api_key' as const,
        lastUsedAt: undefined,
      };
      next();
      return;
    }

    if (!authHeader) {
      respondWithError(res, 401, 'AUTH_REQUIRED', 'Authorization header required');
      return;
    }

    // Support both "Bearer token" and "token" formats
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    if (!apiKey) {
      respondWithError(res, 401, 'AUTH_REQUIRED', 'API key required');
      return;
    }

    // Validate API key format
    if (!apiKey.startsWith('oriva_pk_test_') && !apiKey.startsWith('oriva_pk_live_')) {
      // In development mode, also accept JWT tokens (for orivaApi client using user auth)
      if (process.env.NODE_ENV === 'development') {
        // Check if this looks like a JWT token (has 3 dot-separated parts)
        const parts = apiKey.split('.');
        if (parts.length === 3) {
          // This is a JWT token - verify it with Supabase auth
          const {
            data: { user },
            error: authError,
          } = await supabase.auth.getUser(apiKey);
          if (!authError && user) {
            const authReq = asAuthRequest(req);
            authReq.keyInfo = {
              id: 'jwt_auth',
              userId: user.id,
              name: user.email || 'JWT User',
              permissions: ['read:profiles', 'write:sessions', 'read:sessions'],
              usageCount: 0,
              isActive: true,
              authType: 'supabase_auth' as const,
              lastUsedAt: undefined,
            };
            next();
            return;
          }
        }
      }
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

    // Determine the actual user ID
    // When both X-API-Key and Authorization JWT are provided:
    // - Use API key for tenant permissions/validation
    // - Use JWT for the actual logged-in user's identity
    // This pattern is used by o-core's app-launcher iframe proxy
    let effectiveUserId = apiKeyRecord.user_id;
    let effectiveAuthType: 'api_key' | 'supabase_auth' = 'api_key';

    // Check if there's also an Authorization header with a JWT
    const authHeaderForJwt = req.headers.authorization;
    if (authHeaderForJwt && authHeaderForJwt.startsWith('Bearer ')) {
      const jwtToken = authHeaderForJwt.substring(7);
      // Check if this looks like a JWT (3 dot-separated parts)
      const jwtParts = jwtToken.split('.');
      if (jwtParts.length === 3) {
        // Validate the JWT with Supabase to get the actual user
        const {
          data: { user: jwtUser },
          error: jwtError,
        } = await supabase.auth.getUser(jwtToken);
        if (!jwtError && jwtUser) {
          // Use the JWT user's ID instead of the API key owner
          effectiveUserId = jwtUser.id;
          effectiveAuthType = 'supabase_auth';
          logger.debug('Using JWT user for request instead of API key owner', {
            apiKeyOwner: apiKeyRecord.user_id,
            jwtUser: jwtUser.id,
            email: jwtUser.email,
          });
        }
      }
    }

    // Set keyInfo on the request
    const authReq = asAuthRequest(req);
    authReq.keyInfo = {
      id: apiKeyRecord.id,
      userId: effectiveUserId,
      name: apiKeyRecord.name,
      permissions: apiKeyRecord.permissions || [],
      usageCount: apiKeyRecord.usage_count || 0,
      isActive: apiKeyRecord.is_active,
      authType: effectiveAuthType,
      lastUsedAt: apiKeyRecord.last_used_at || undefined,
    };

    // Update usage count and last_used_at (fire and forget)
    void supabase
      .from('developer_api_keys')
      .update({
        usage_count: (apiKeyRecord.usage_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', apiKeyRecord.id)
      .then(
        () => {},
        (err) => console.warn('Failed to update API key usage:', err)
      );

    next();
  } catch (error) {
    logger.error('API key validation error', { error: getErrorMessage(error) });
    respondWithError(res, 500, 'AUTH_ERROR', 'Authentication error');
  }
};

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
      templates: '/api/v1/templates/*',
    },
  });
});

// Legacy health endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.7',
    features: ['marketplace', 'profiles', 'groups', 'privacy-first', 'tenant-namespace'],
    deployment: 'remove-legacy-hugo-love-routes',
  });
});

// Test endpoint to verify routing
app.get('/api/v1/test', (req, res) => {
  res.json({
    ok: true,
    success: true,
    message: 'API routing is working!',
    timestamp: new Date().toISOString(),
  });
});

// GET /dev-profiles - Public endpoint for dev login (development mode only)
// Returns available profiles for dev login without requiring authentication
app.get('/dev-profiles', async (req, res) => {
  // Only available in development mode
  if (process.env.NODE_ENV !== 'development' && !process.env.VERCEL_ENV?.includes('preview')) {
    return res.status(403).json({
      ok: false,
      success: false,
      error: 'Dev profiles only available in development',
      code: 'DEV_ONLY',
    });
  }

  try {
    // Get all profiles from the database (for dev purposes)
    logger.info('Fetching profiles from public schema for dev login');
    const { data: profiles, error } = await supabase.from('profiles').select('*').limit(10); // Limit to first 10 profiles for dev

    if (error) {
      logger.error('Database error fetching profiles:', {
        code: error.code,
        message: error.message,
        details: (error as any).details,
      });
      return res.status(500).json({
        ok: false,
        success: false,
        error: 'Failed to fetch available profiles from database',
        code: 'PROFILE_FETCH_FAILED',
        details: error.message,
      });
    }

    if (!profiles || profiles.length === 0) {
      logger.warn('No profiles found in database');
      return res.status(200).json({
        ok: true,
        success: true,
        data: [], // Return empty list if no profiles exist yet
      });
    }

    logger.info('Successfully fetched profiles from database', { count: profiles.length });

    // Return profiles in the expected format
    return res.status(200).json({
      ok: true,
      success: true,
      data: profiles.map((p: any) => ({
        id: p.id,
        email: p.email || 'dev@oriva.io',
        name: p.display_name || p.username || 'Dev User',
        display_name: p.display_name || p.username,
        username: p.username,
        avatar_url: p.avatar_url,
      })),
    });
  } catch (error) {
    logger.error('Error fetching dev profiles:', { error });
    return res.status(500).json({
      ok: false,
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.message : String(error),
    });
  }
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
        error: testError?.message || null,
      },
      corsCache: {
        size: corsOriginCache.data.size,
        lastUpdated: new Date(corsOriginCache.lastUpdated).toISOString(),
        ageMs: cacheAge,
        origins: cacheOrigins,
      },
      marketplace: {
        totalApps: marketplaceApps?.length || 0,
        apps: marketplaceApps || [],
        error: marketplaceError?.message || null,
      },
      environment: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.EXPO_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV,
      },
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
      .map((error) => `${'param' in error ? error.param : 'unknown'}: ${error.msg}`);
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
  profiles: ['user:read', 'profiles:read', 'profiles:write'],
  groups: ['groups:read', 'groups:write'],
  marketplace: ['marketplace:read'],
  entries: ['entries:read', 'entries:write'],
  templates: ['templates:read', 'templates:write'],
};

// Helper function to expand legacy permissions to granular permissions
const expandPermissions = (permissions: unknown[]): string[] => {
  const expandedPerms = new Set<string>();

  if (!Array.isArray(permissions)) {
    return [];
  }

  permissions.forEach((permission) => {
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
  {
    scope: 'profiles:write',
    description: 'Switch between authorized profiles',
    category: 'Profiles',
  },

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
  {
    scope: 'marketplace:read',
    description: 'Browse public marketplace apps',
    category: 'Marketplace',
  },

  // Storage permissions
  { scope: 'storage:read', description: 'Read app-specific data only', category: 'Storage' },
  { scope: 'storage:write', description: 'Write app-specific data only', category: 'Storage' },

  // UI permissions
  { scope: 'ui:notifications', description: 'Show notifications to user', category: 'UI' },
  { scope: 'ui:modals', description: 'Display modals', category: 'UI' },
  { scope: 'ui:navigation', description: 'Navigate between screens', category: 'UI' },
];

// Get available permissions for developer UI
app.get('/api/v1/dev/permissions', (req, res) => {
  res.json({
    ok: true,
    success: true,
    data: AVAILABLE_PERMISSIONS,
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

// =============================================================================
// SUB-ROUTER MOUNTS
// =============================================================================

// Mount User / Sessions / Profiles / Groups / Entries router.
// MUST be mounted before the /api/v1/auth router — it registers
// GET /auth/profile (withAuthContext version) which wins Express first-match.
app.use(
  '/api/v1',
  createUserPublicRouter(supabase, logger, validateApiKey, validateAuth, withAuthContext)
);

// Mount Marketplace / Developer / Admin router
app.use(
  '/api/v1',
  createMarketplaceRouter(
    supabase,
    logger,
    validateApiKey,
    validateAuth,
    withAuthContext,
    requireAdminToken
  )
);

// Mount public Auth router (register, login, logout, token refresh, profile, account)
app.use('/api/v1/auth', createAuthPublicRouter(supabase, supabaseAuth, logger, validateAuth));

// Mount Merlin AI router (renamed from Hugo AI)
const merlinRouter = createMerlinAIRouter(supabase);
app.use('/api/merlin', merlinRouter);
// Legacy route (deprecated - use /api/merlin)
app.use('/api/hugo', merlinRouter);

// Mount Photos router for pre-signed URL uploads (requires API key)
app.use('/api/v1/apps/photos', photosRouter);
// Also mount at /api/oriva/* for o-orig development BFF proxy
app.use('/api/oriva/apps/photos', photosRouter);

// Mount User Media router for internal avatar uploads (user auth only)
// Requires optionalSchemaRouter to initialize Supabase client for auth validation
app.use('/api/v1/user/media', optionalSchemaRouter, userMediaRouter);

// Mount Video Meetings router
app.use('/api/v1/video-meetings', videoMeetingsRouter);

// ============================================================================
// TENANT APP ROUTES (o-orig marketplace apps)
// These routes serve first-party tenant apps from o-orig repository
// Namespaced under /api/v1/tenant/* to distinguish from public platform APIs
// ============================================================================

// NOTE: Travel Hub routes have been removed from o-platform
// Travel Hub now uses o-orig's Next.js API routes at /api/tenant/travel-hub/*
// o-platform (api.oriva.io) is the PUBLIC API for third-party developers
// o-orig tenant routes are for internal frontend-to-backend communication

// Mount Hugo Love router (dating app)
// Requires optionalSchemaRouter to initialize Supabase client for auth validation
app.use('/api/v1/tenant/hugo-love', optionalSchemaRouter, hugoLoveRouter);

// Mount Ask Me Anything router (AMA sessions)
// Requires optionalSchemaRouter to initialize Supabase client for auth validation
app.use('/api/v1/ask-me-anything', optionalSchemaRouter, askMeAnythingRouter);
app.use('/api/oriva/ask-me-anything', optionalSchemaRouter, askMeAnythingRouter);

// ============================================================================
// LOCATIONS API ENDPOINTS (Google Places proxy - no auth required)
// ============================================================================
app.use('/api/locations', locationsRouter);

// ============================================================================
// EVENTS API ENDPOINTS
// ============================================================================
app.use(
  '/api/oriva/events',
  createOrivaEventsRouter(supabase, logger, validateAuth, withAuthContext)
);

// ============================================================================
// LIMOHAWK LOYALTY SYSTEM ENDPOINTS (External system - API key auth)
// ============================================================================
// TEMPORARILY DISABLED - limohawk feature incomplete, missing service files
// app.use('/api/v1/limohawk', limohawkRouter);

// OpenAPI docs — unauthenticated, public
app.get('/api/openapi.json', (_req, res) => res.json(openApiDocument));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

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
    method: req.method,
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
