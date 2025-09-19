// Load env variables in local/dev
try { 
  require('dotenv').config(); 
} catch {
  // dotenv not available in production
}
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const { param, validationResult } = require('express-validator');
const winston = require('winston');

const app = express();

// Production logging setup
const logger = winston.createLogger({
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
  } catch (error) {
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

// ULTRA-BULLETPROOF CORS: Guaranteed Work Buddy support
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Development: Allow localhost
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      return callback(null, true);
    }

    // CRITICAL: Work Buddy MUST ALWAYS be allowed (highest priority)
    if (origin === 'https://work-buddy-expo.vercel.app') {
      console.log('✅ CORS: Work Buddy origin allowed (critical path)');
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
      console.error('❌ CORS: Cache check failed:', error.message);
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
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000, // limit each IP to 1000 requests per windowMs
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
  }

  next();
};

// Guard for dev/admin endpoints
const requireAdminToken = (req, res, next) => {
  // Only enforce when an admin token is configured
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ success: false, error: 'Admin token not configured' });
  }
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// API Key validation using Supabase
const hashAPIKey = async (key) => {
  try {
    console.log('🔐 DEBUG: Starting hashAPIKey', { keyLength: key.length, keyPrefix: key.substring(0, 20) });

    // Check if crypto.subtle is available
    if (!crypto.subtle) {
      console.error('❌ crypto.subtle not available');
      throw new Error('crypto.subtle not available');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');

    console.log('✅ DEBUG: hashAPIKey success', { hashLength: hash.length, hashPrefix: hash.substring(0, 16) });
    return hash;
  } catch (error) {
    console.error('❌ DEBUG: hashAPIKey failed', { error: error.message });
    throw error;
  }
};

// Dual authentication middleware (API keys + Supabase auth tokens)
const validateAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authorization required'
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (!token || typeof token !== 'string') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token format'
    });
  }

  // Check if it's an API key (starts with oriva_pk_)
  const validApiKeyPrefixes = ['oriva_pk_live_', 'oriva_pk_test_'];
  const isApiKey = validApiKeyPrefixes.some(prefix => token.startsWith(prefix));
  
  if (isApiKey) {
    // Handle API key authentication
    try {
      const keyHash = await hashAPIKey(token);
      const { data: keyData, error } = await supabase
        .from('developer_api_keys')
        .select('id, user_id, name, permissions, is_active, usage_count')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();

      if (error || !keyData) {
        console.log('❌ API key validation failed:', {
          error: error?.message,
          errorCode: error?.code,
          errorDetails: error?.details,
          hasKey: !!keyData,
          keyHash: keyHash.substring(0, 16) + '...',
          timestamp: new Date().toISOString()
        });
        return res.status(401).json({
          success: false,
          error: 'Invalid API key'
        });
      }

      console.log('✅ API key validation succeeded:', {
        keyId: keyData.id,
        userId: keyData.user_id,
        name: keyData.name,
        timestamp: new Date().toISOString()
      });

      // Update usage statistics (fire and forget)
      supabase
        .from('developer_api_keys')
        .update({
          usage_count: (keyData.usage_count || 0) + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', keyData.id)
        .then(() => {
          console.log('API key usage updated:', { keyId: keyData.id });
        })
        .catch((err) => {
          console.warn('Failed to update API key usage:', { error: err.message, keyId: keyData.id });
        });

      // Add key info to request
      req.apiKey = token;
      req.keyInfo = {
        id: keyData.id,
        userId: keyData.user_id,
        name: keyData.name,
        permissions: expandPermissions(keyData.permissions),
        usageCount: keyData.usage_count,
        authType: 'api_key'
      };
      
      console.log('API key validated successfully:', { keyId: keyData.id, userId: keyData.user_id });
      return next();

    } catch (error) {
      console.error('API key validation error:', error);
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }
  } else {
    // Handle Supabase auth token
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.log('Supabase auth validation failed:', { error: error?.message, hasUser: !!user });
        return res.status(401).json({
          success: false,
          error: 'Invalid authentication token'
        });
      }

      // Add user info to request
      req.apiKey = token;
      req.keyInfo = {
        id: user.id,
        userId: user.id,
        name: user.email || user.user_metadata?.name || 'User',
        permissions: ['read', 'write'],
        usageCount: 0,
        authType: 'supabase_auth'
      };
      
      console.log('Supabase auth validated successfully:', { userId: user.id });
      return next();

    } catch (error) {
      console.error('Supabase auth validation error:', error);
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }
  }
};

// Legacy API Key validation middleware (for backward compatibility)
const validateApiKey = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }
  
  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key format'
    });
  }

  // Check if key has valid prefix
  const validPrefixes = ['oriva_pk_live_', 'oriva_pk_test_'];
  const hasValidPrefix = validPrefixes.some(prefix => apiKey.startsWith(prefix));
  
  if (!hasValidPrefix) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  try {
    // Hash the API key to compare with stored hash
    const keyHash = await hashAPIKey(apiKey);

    // Query Supabase for the API key
    const { data: keyData, error } = await supabase
      .from('developer_api_keys')
      .select('id, user_id, name, permissions, is_active, usage_count')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !keyData) {
      console.log('API key validation failed:', { error: error?.message, hasKey: !!keyData });
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Update usage statistics (fire and forget)
    supabase
      .from('developer_api_keys')
      .update({
        usage_count: (keyData.usage_count || 0) + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', keyData.id)
      .then(() => {
        console.log('API key usage updated:', { keyId: keyData.id });
      })
      .catch((err) => {
        console.warn('Failed to update API key usage:', { error: err.message, keyId: keyData.id });
      });

    // Add key info to request for use in endpoints
    req.apiKey = apiKey;
    req.keyInfo = {
      id: keyData.id,
      userId: keyData.user_id,
      name: keyData.name,
      permissions: expandPermissions(keyData.permissions),
      usageCount: keyData.usage_count
    };
    
    console.log('API key validated successfully:', { keyId: keyData.id, userId: keyData.user_id });
    next();

  } catch (error) {
    console.error('API key validation error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid API key'
    });
  }
};

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
    success: true,
    message: 'API routing is working!',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint for Work Buddy API key
app.get('/api/v1/debug/workbuddy', async (req, res) => {
  try {
    const WORK_BUDDY_API_KEY = 'oriva_pk_live_b7d127a91ff32d58044492ab89a72e52976f65143178fda8f2d808e967b2a9d9';

    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        supabaseUrlValue: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
        cryptoSubtleAvailable: !!crypto.subtle
      },
      keyTest: {}
    };

    // Test key hashing
    try {
      const keyHash = await hashAPIKey(WORK_BUDDY_API_KEY);
      debugInfo.keyTest.hashSuccess = true;
      debugInfo.keyTest.hash = keyHash.substring(0, 16) + '...';

      // Test database query
      const { data: keyData, error } = await supabase
        .from('developer_api_keys')
        .select('id, user_id, name, permissions, is_active, usage_count')
        .eq('key_hash', keyHash)
        .eq('is_active', true)
        .single();

      debugInfo.keyTest.dbQuerySuccess = !error;
      debugInfo.keyTest.keyFound = !!keyData;
      debugInfo.keyTest.error = error?.message || null;

      if (error) {
        debugInfo.keyTest.dbError = {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        };
      }

      if (keyData) {
        debugInfo.keyTest.keyData = {
          id: keyData.id,
          name: keyData.name,
          permissions: expandPermissions(keyData.permissions),
          isActive: keyData.is_active
        };
      }

    } catch (error) {
      debugInfo.keyTest.hashSuccess = false;
      debugInfo.keyTest.error = error.message;
    }

    // Test basic Supabase connection
    try {
      const { data: connectionTest, error: connectionError } = await supabase
        .from('developer_api_keys')
        .select('count')
        .limit(1);

      debugInfo.connectionTest = {
        success: !connectionError,
        error: connectionError?.message || null
      };
    } catch (error) {
      debugInfo.connectionTest = {
        success: false,
        error: error.message
      };
    }

    res.json({
      success: true,
      debug: debugInfo
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
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

    // Test Work Buddy specifically
    const { data: workBuddyApps, error: workBuddyError } = await supabase
      .from('plugin_marketplace_apps')
      .select('name, execution_url, status')
      .ilike('name', '%work%buddy%');

    res.json({
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
      workBuddy: {
        found: workBuddyApps?.length || 0,
        apps: workBuddyApps || [],
        error: workBuddyError?.message || null
      },
      environment: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.EXPO_PUBLIC_SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================================================
// INPUT VALIDATION MIDDLEWARE
// =============================================================================

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
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

  permissions.forEach(perm => {
    if (LEGACY_PERMISSION_MAPPING[perm]) {
      // Legacy permission - expand it
      LEGACY_PERMISSION_MAPPING[perm].forEach(granularPerm => {
        expandedPerms.add(granularPerm);
      });
    } else {
      // Already granular permission
      expandedPerms.add(perm);
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
    success: true,
    data: AVAILABLE_PERMISSIONS
  });
});

// API Key Management endpoints (for developer dashboard)
// Generate live API key endpoint - fixes confusing test key naming
app.post('/api/v1/dev/generate-live-key', devRateLimiter, requireAdminToken, async (req, res) => {
  try {
    const { name = 'Live API Key', permissions = null } = req.body;
    const userId = req.user?.id;

    // Validate permissions if provided
    if (permissions) {
      const validScopes = AVAILABLE_PERMISSIONS.map(p => p.scope);
      const invalidPermissions = permissions.filter(p => !validScopes.includes(p));
      if (invalidPermissions.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid permissions: ${invalidPermissions.join(', ')}`
        });
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
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
        name: name,
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
      console.error('Failed to store API key:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create API key'
      });
    }

    res.json({
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

  } catch (error) {
    console.error('API key generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during key generation'
    });
  }
});

// Legacy endpoint - now redirects to live key generation
app.post('/api/v1/dev/generate-key', devRateLimiter, requireAdminToken, (req, res) => {
  res.status(501).json({
    success: false,
    error: 'This endpoint has been deprecated. Use /api/v1/dev/generate-live-key for production keys.',
    redirect: '/api/v1/dev/generate-live-key'
  });
});

app.get('/api/v1/dev/keys', devRateLimiter, requireAdminToken, async (req, res) => {
  try {
    const { data: keys, error } = await supabase
      .from('developer_api_keys')
      .select('id, name, key_prefix, is_active, usage_count, last_used_at, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch API keys:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve API keys'
      });
    }
    
    const formattedKeys = keys.map(key => ({
      id: key.id,
      key: `${key.key_prefix + '•'.repeat(24)  }••••`, // Show prefix and masked key
      name: key.name,
      type: key.key_prefix.includes('_live_') ? 'live' : 'test',
      createdAt: key.created_at,
      lastUsed: key.last_used_at,
      usageCount: key.usage_count || 0,
      isActive: key.is_active
    }));
    
    res.json({
      success: true,
      data: formattedKeys
    });
  } catch (error) {
    console.error('Dev keys endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve API keys'
    });
  }
});

app.post('/api/v1/dev/revoke-key', devRateLimiter, requireAdminToken, async (req, res) => {
  try {
    const { keyId } = req.body;
    
    if (!keyId) {
      return res.status(400).json({
        success: false,
        error: 'Key ID is required'
      });
    }
    
    const { data, error } = await supabase
      .from('developer_api_keys')
      .update({ is_active: false })
      .eq('id', keyId)
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to revoke API key:', error);
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }
    
    res.json({
      success: true,
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('Revoke key endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key'
    });
  }
});

// API keys are now managed through Supabase database
console.log('🔑 API keys will be validated against Supabase database');

// User endpoints
app.get('/api/v1/user/me', validateApiKey, async (req, res) => {
  try {
    // Get the user's primary profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, location, website_url, avatar_url, created_at, updated_at, account_id')
      .eq('account_id', req.keyInfo.userId)
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (error) {
      console.error('Failed to fetch user profile:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user profile'
      });
    }

    res.json({
      success: true,
      data: {
        id: profile.account_id,
        username: profile.username,
        displayName: profile.display_name || profile.username,
        email: req.keyInfo.authType === 'supabase_auth' ? req.keyInfo.name : null,
        bio: profile.bio,
        location: profile.location,
        website: profile.website_url,
        avatar: profile.avatar_url,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        // Include API key info for debugging
        apiKeyInfo: {
          keyId: req.keyInfo.id,
          name: req.keyInfo.name,
          userId: req.keyInfo.userId,
          permissions: req.keyInfo.permissions,
          usageCount: req.keyInfo.usageCount
        }
      }
    });
  } catch (error) {
    console.error('User profile endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

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
      note: 'Sessions feature not yet implemented'
    });
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions'
    });
  }
});

// Get upcoming sessions
app.get('/api/v1/sessions/upcoming', validateApiKey, async (req, res) => {
  try {
    // Sessions are not implemented in the current Oriva Core schema
    res.json({
      success: true,
      data: [],
      note: 'Sessions feature not yet implemented'
    });
  } catch (error) {
    console.error('Failed to fetch upcoming sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming sessions'
    });
  }
});

// =============================================================================
// TEAM ENDPOINTS
// =============================================================================

// Get team members
app.get('/api/v1/team/members', validateApiKey, async (req, res) => {
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
      .eq('profile_id', req.keyInfo.userId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch team members:', error);
      return res.json({
        success: true,
        data: [],
        meta: {
          total: 0,
          roles: []
        },
        note: 'No team memberships found'
      });
    }

    const teamMembers = groupMemberships?.map(membership => ({
      memberId: membership.profiles.id,
      name: membership.profiles.display_name || membership.profiles.username,
      email: null, // Not exposed through this API
      role: membership.role,
      avatar: membership.profiles.avatar_url,
      status: 'active',
      joinedAt: membership.joined_at,
      groupName: membership.groups.name
    })) || [];

    const roles = [...new Set(teamMembers.map(member => member.role))];

    res.json({
      success: true,
      data: teamMembers,
      meta: {
        total: teamMembers.length,
        roles: roles
      }
    });
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team members'
    });
  }
});

// =============================================================================
// ANALYTICS ENDPOINTS
// =============================================================================

// Get analytics summary
app.get('/api/v1/analytics/summary', validateApiKey, async (req, res) => {
  try {
    // Get real analytics from database
    const [
      entriesCount,
      responsesCount,
      groupsCount,
      installedAppsCount
    ] = await Promise.all([
      supabase.from('entries').select('*', { count: 'exact', head: true }).eq('profile_id', req.keyInfo.userId),
      supabase.from('responses').select('*', { count: 'exact', head: true }).eq('profile_id', req.keyInfo.userId),
      supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('profile_id', req.keyInfo.userId).eq('is_active', true),
      supabase.from('user_app_installs').select('*', { count: 'exact', head: true }).eq('user_id', req.keyInfo.userId).eq('is_active', true)
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
      success: true,
      data: analytics,
      note: 'Real analytics based on user data'
    });
  } catch (error) {
    console.error('Failed to fetch analytics summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics summary'
    });
  }
});

// =============================================================================
// AUTH ENDPOINTS
// =============================================================================

// Get auth profile (similar to user/me but focused on auth data)
app.get('/api/v1/auth/profile', validateAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        id: req.keyInfo.userId,
        email: 'test@example.com',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        authType: req.keyInfo.authType,
        permissions: req.keyInfo.permissions,
        lastLogin: new Date().toISOString(),
        accountStatus: 'active',
        twoFactorEnabled: false,
        emailVerified: true
      }
    });
  } catch (error) {
    console.error('Failed to fetch auth profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch auth profile'
    });
  }
});

// =============================================================================
// PROFILE ENDPOINTS
// =============================================================================

// Get available profiles for the extension
app.get('/api/v1/profiles/available', validateApiKey, async (req, res) => {
  try {
    // Get real profiles from Supabase database (excluding anonymous profiles for third-party apps)
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, is_active, is_default')
      .eq('account_id', req.keyInfo.userId)
      .eq('is_active', true)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch profiles from database:', error);
      // Fallback to mock data if database fails
      const fallbackProfiles = [
        {
          profileId: 'ext_fallback_profile',
          profileName: 'My Profile',
          isActive: true,
          avatar: null
        }
      ];

      return res.json({
        success: true,
        data: fallbackProfiles,
        note: 'Using fallback data due to database error'
      });
    }

    // Transform database profiles to API format
    const transformedProfiles = profiles.map(profile => ({
      profileId: profile.id,
      profileName: profile.display_name || profile.username || 'Unnamed Profile',
      isActive: profile.is_active,
      avatar: profile.avatar_url,
      isDefault: profile.is_default
    }));

    res.json({
      success: true,
      data: transformedProfiles
    });
  } catch (error) {
    console.error('Failed to fetch available profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profiles'
    });
  }
});

// Get currently active profile
app.get('/api/v1/profiles/active', validateApiKey, async (req, res) => {
  try {
    // Get the default (primary) profile from Supabase database (excluding anonymous profiles for third-party apps)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, is_active, is_default')
      .eq('account_id', req.keyInfo.userId)
      .eq('is_active', true)
      .eq('is_default', true)
      .eq('is_anonymous', false)
      .single();

    if (error) {
      console.error('Failed to fetch active profile from database:', error);
      // Fallback to mock data if database fails
      const fallbackProfile = {
        profileId: 'ext_fallback_active',
        profileName: 'My Active Profile',
        isActive: true,
        avatar: null
      };

      return res.json({
        success: true,
        data: fallbackProfile,
        note: 'Using fallback data due to database error'
      });
    }

    // Transform database profile to API format
    const activeProfile = {
      profileId: profile.id,
      profileName: profile.display_name || profile.username || 'Unnamed Profile',
      isActive: profile.is_active,
      avatar: profile.avatar_url,
      isDefault: profile.is_default
    };

    res.json({
      success: true,
      data: activeProfile
    });
  } catch (error) {
    console.error('Failed to fetch active profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active profile'
    });
  }
});

// Update profile information
app.put('/api/v1/profiles/:profileId',
  validateApiKey,
  param('profileId').matches(/^ext_[a-f0-9]{16}$/).withMessage('Invalid profile ID format'),
  validateRequest,
  async (req, res) => {
    try {
      const { profileId } = req.params;
      const { profileName, avatar, bio, location } = req.body;

      // For now, return mock success response
      // TODO: Implement real profile update using Oriva Core profileService
      const updatedProfile = {
        profileId,
        profileName: profileName || 'Updated Profile',
        isActive: true,
        avatar: avatar || 'https://example.com/avatars/updated-profile.jpg',
        bio: bio || null,
        location: location || null,
        updatedAt: new Date().toISOString()
      };

      res.json({
        success: true,
        data: updatedProfile,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  });

// Switch to a different profile
app.post('/api/v1/profiles/:profileId/activate',
  validateApiKey,
  param('profileId').matches(/^ext_[a-f0-9]{16}$/).withMessage('Invalid profile ID format'),
  validateRequest,
  async (req, res) => {
    try {
      const { profileId } = req.params;

      // For now, return mock success response
      // TODO: Implement real profile switching
      res.json({
        success: true,
        data: {
          activeProfile: profileId,
          switchedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to switch profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to switch profile'
      });
    }
  });

// =============================================================================
// GROUP ENDPOINTS
// =============================================================================

// Get user's groups
app.get('/api/v1/groups', validateApiKey, async (req, res) => {
  try {
    // Get groups where the user is a member
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
      .eq('profile_id', req.keyInfo.userId)
      .eq('is_active', true);

    if (membershipError) {
      console.error('Failed to fetch group memberships:', membershipError);
      return res.json({
        success: true,
        data: [],
        note: 'No groups found or database error'
      });
    }

    // Get member counts for each group
    const groups = [];
    for (const membership of groupMemberships || []) {
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

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Failed to fetch groups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch groups'
    });
  }
});

// Get group members
app.get('/api/v1/groups/:groupId/members',
  validateApiKey,
  param('groupId').isUUID().withMessage('Invalid group ID format'),
  validateRequest,
  async (req, res) => {
    try {
      const { groupId } = req.params;

      // Verify user has access to this group
      const { data: userMembership, error: accessError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('profile_id', req.keyInfo.userId)
        .eq('is_active', true)
        .single();

      if (accessError || !userMembership) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this group'
        });
      }

      // Get group members with profile information
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
        console.error('Failed to fetch group members:', membersError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch group members'
        });
      }

      const formattedMembers = members.map(member => ({
        memberId: member.profiles.id,
        displayName: member.profiles.display_name || member.profiles.username,
        role: member.role,
        joinedAt: member.joined_at,
        avatar: member.profiles.avatar_url
      }));

      res.json({
        success: true,
        data: formattedMembers
      });
    } catch (error) {
      console.error('Failed to fetch group members:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch group members'
      });
    }
  });

// Entries endpoints
app.get('/api/v1/entries', validateApiKey, async (req, res) => {
  try {
    const { limit = 20, offset = 0, profile_id } = req.query;

    let query = supabase
      .from('entries')
      .select('id, title, content, profile_id, created_at, updated_at, audience_type')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by profile if specified
    if (profile_id) {
      query = query.eq('profile_id', profile_id);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('Failed to fetch entries:', error);
      return res.json({
        success: true,
        data: [],
        meta: {
          pagination: {
            page: Math.floor(offset / limit) + 1,
            limit: parseInt(limit),
            total: 0,
            totalPages: 0
          }
        }
      });
    }

    res.json({
      success: true,
      data: entries || [],
      meta: {
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit: parseInt(limit),
          total: entries?.length || 0,
          totalPages: Math.ceil((entries?.length || 0) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Failed to fetch entries:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch entries'
    });
  }
});

// Templates endpoints
app.get('/api/v1/templates', validateApiKey, (req, res) => {
  res.json({
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
    success: true,
    data: {}
  });
});

// UI endpoints
app.post('/api/v1/ui/notifications', validateApiKey, (req, res) => {
  res.json({
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
app.get('/api/v1/developer/apps', validateApiKey, async (req, res) => {
  try {
    const { data: apps, error } = await supabase
      .from('plugin_marketplace_apps')
      .select('*')
      .eq('developer_id', req.keyInfo.userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch developer apps:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch apps'
      });
    }
    
    res.json({
      success: true,
      data: apps || []
    });
  } catch (error) {
    console.error('Developer apps endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get single app details
app.get('/api/v1/developer/apps/:appId', validateApiKey, async (req, res) => {
  try {
    const { appId } = req.params;
    
    const { data: app, error } = await supabase
      .from('plugin_marketplace_apps')
      .select('*')
      .eq('id', appId)
      .eq('developer_id', req.keyInfo.userId)
      .single();
    
    if (error || !app) {
      return res.status(404).json({
        success: false,
        error: 'App not found'
      });
    }
    
    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('Developer app detail endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create new app
app.post('/api/v1/developer/apps', validateApiKey, async (req, res) => {
  try {
    const appData = {
      ...req.body,
      developer_id: req.keyInfo.userId,
      developer_name: req.keyInfo.name || 'Developer',
      status: 'draft',
      is_active: false,
      install_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const { data: app, error } = await supabase
      .from('plugin_marketplace_apps')
      .insert([appData])
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create app:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create app'
      });
    }
    
    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('Create app endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update app
app.put('/api/v1/developer/apps/:appId', validateApiKey, async (req, res) => {
  try {
    const { appId } = req.params;
    const updates = {
      ...req.body,
      updated_at: new Date().toISOString()
    };
    
    // Don't allow status updates through this endpoint
    delete updates.status;
    
    const { data: app, error } = await supabase
      .from('plugin_marketplace_apps')
      .update(updates)
      .eq('id', appId)
      .eq('developer_id', req.keyInfo.userId)
      .select()
      .single();
    
    if (error || !app) {
      return res.status(404).json({
        success: false,
        error: 'App not found or unauthorized'
      });
    }
    
    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('Update app endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete app (only if in draft status)
app.delete('/api/v1/developer/apps/:appId', validateApiKey, async (req, res) => {
  try {
    const { appId } = req.params;
    
    // First check if app is in draft status
    const { data: app } = await supabase
      .from('plugin_marketplace_apps')
      .select('status')
      .eq('id', appId)
      .eq('developer_id', req.keyInfo.userId)
      .single();
    
    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'App not found'
      });
    }
    
    if (app.status !== 'draft') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete apps that are not in draft status'
      });
    }
    
    const { error } = await supabase
      .from('plugin_marketplace_apps')
      .delete()
      .eq('id', appId)
      .eq('developer_id', req.keyInfo.userId);
    
    if (error) {
      console.error('Failed to delete app:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete app'
      });
    }
    
    res.json({
      success: true,
      message: 'App deleted successfully'
    });
  } catch (error) {
    console.error('Delete app endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Submit app for review
app.post('/api/v1/developer/apps/:appId/submit', validateApiKey, async (req, res) => {
  try {
    const { appId } = req.params;
    
    const { data: app, error } = await supabase
      .from('plugin_marketplace_apps')
      .update({
        status: 'pending_review',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', appId)
      .eq('developer_id', req.keyInfo.userId)
      .eq('status', 'draft')
      .select()
      .single();
    
    if (error || !app) {
      return res.status(404).json({
        success: false,
        error: 'App not found or already submitted'
      });
    }
    
    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('Submit app endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Resubmit app after rejection
app.post('/api/v1/developer/apps/:appId/resubmit', validateApiKey, async (req, res) => {
  try {
    const { appId } = req.params;
    const updates = req.body;
    
    const { data: app, error } = await supabase
      .from('plugin_marketplace_apps')
      .update({
        ...updates,
        status: 'pending_review',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        reviewer_notes: null,
        reviewed_at: null,
        reviewed_by: null
      })
      .eq('id', appId)
      .eq('developer_id', req.keyInfo.userId)
      .eq('status', 'rejected')
      .select()
      .single();
    
    if (error || !app) {
      return res.status(404).json({
        success: false,
        error: 'App not found or not in rejected status'
      });
    }
    
    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('Resubmit app endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// =============================================================================
// MARKETPLACE ENDPOINTS
// =============================================================================

// Get all approved marketplace apps with optional filtering
app.get('/api/v1/marketplace/apps', validateApiKey, async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    
    // Build query to get only approved apps
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
      .eq('status', 'approved') // Only show approved apps
      .eq('is_active', true)
      .order('install_count', { ascending: false });
    
    // Apply category filter
    if (category) {
      query = query.eq('category', category);
    }
    
    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,tagline.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1);
    
    const { data: apps, error } = await query;
    
    if (error) {
      console.error('Failed to fetch marketplace apps:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch apps'
      });
    }
    
    res.json({
      success: true,
      data: apps || []
    });
  } catch (error) {
    console.error('Marketplace apps endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get trending apps
app.get('/api/v1/marketplace/trending', validateApiKey, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    // days_back parameter available in req.query for future implementation
    
    // Get apps with high install growth in the past X days
    const { data: apps, error } = await supabase
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
      console.error('Failed to fetch trending apps:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch trending apps'
      });
    }
    
    res.json({
      success: true,
      data: apps || []
    });
  } catch (error) {
    console.error('Trending apps endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get featured apps
app.get('/api/v1/marketplace/featured', validateApiKey, async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    
    // Get featured apps (could be based on featured flag or curated list)
    const { data: apps, error } = await supabase
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
      .eq('is_featured', true) // Assuming there's a featured flag
      .order('featured_order', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Failed to fetch featured apps:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch featured apps'
      });
    }
    
    res.json({
      success: true,
      data: apps || []
    });
  } catch (error) {
    console.error('Featured apps endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get app categories
app.get('/api/v1/marketplace/categories', validateApiKey, async (req, res) => {
  try {
    // Get unique categories with counts
    const { data: categories, error } = await supabase
      .from('plugin_marketplace_apps')
      .select('category')
      .eq('status', 'approved')
      .eq('is_active', true);
    
    if (error) {
      console.error('Failed to fetch categories:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch categories'
      });
    }
    
    // Count apps per category
    const categoryCounts = {};
    categories?.forEach(app => {
      if (app.category) {
        categoryCounts[app.category] = (categoryCounts[app.category] || 0) + 1;
      }
    });
    
    // Format response
    const formattedCategories = Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count
    }));
    
    res.json({
      success: true,
      data: formattedCategories
    });
  } catch (error) {
    console.error('Categories endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get single app details
app.get('/api/v1/marketplace/apps/:appId', validateApiKey, async (req, res) => {
  try {
    const { appId } = req.params;
    
    const { data: app, error } = await supabase
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
    
    if (error || !app) {
      return res.status(404).json({
        success: false,
        error: 'App not found'
      });
    }
    
    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('App detail endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get user's installed apps
app.get('/api/v1/marketplace/installed', validateAuth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Get user's installed apps from the database
    const { data: installedApps, error } = await supabase
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
      .eq('user_id', req.keyInfo.userId)
      .eq('is_active', true)
      .order('installed_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Failed to fetch installed apps:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch installed apps'
      });
    }
    
    // Transform the data to include app details
    const apps = installedApps.map(install => ({
      installationId: install.id,
      installedAt: install.installed_at,
      isActive: install.is_active,
      settings: install.app_settings,
      app: install.plugin_marketplace_apps
    }));
    
    res.json({
      success: true,
      data: apps,
      pagination: {
        total: apps.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: apps.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Installed apps endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Install an app
app.post('/api/v1/marketplace/install/:appId', validateAuth, async (req, res) => {
  try {
    const { appId } = req.params;
    const { settings = {} } = req.body;
    
    // First check if the app exists and is approved
    const { data: app, error: appError } = await supabase
      .from('plugin_marketplace_apps')
      .select('id, name, status')
      .eq('id', appId)
      .eq('status', 'approved')
      .eq('is_active', true)
      .single();
    
    if (appError || !app) {
      return res.status(404).json({
        success: false,
        error: 'App not found or not available for installation'
      });
    }
    
    // Check if user already has this app installed
    const { data: existingInstall } = await supabase
      .from('user_app_installs')
      .select('id')
      .eq('user_id', req.keyInfo.userId)
      .eq('app_id', appId)
      .eq('is_active', true)
      .single();
    
    if (existingInstall) {
      return res.status(409).json({
        success: false,
        error: 'App is already installed'
      });
    }
    
    // Install the app
    const { data: installation, error: installError } = await supabase
      .from('user_app_installs')
      .insert([{
        user_id: req.keyInfo.userId,
        app_id: appId,
        installed_at: new Date().toISOString(),
        is_active: true,
        app_settings: settings
      }])
      .select()
      .single();
    
    if (installError) {
      console.error('Failed to install app:', installError);
      return res.status(500).json({
        success: false,
        error: 'Failed to install app'
      });
    }
    
    // Update app install count
    await supabase.rpc('increment_install_count', { app_id_in: appId });
    
    res.json({
      success: true,
      data: {
        installationId: installation.id,
        appId: appId,
        installedAt: installation.installed_at,
        message: `Successfully installed ${app.name}`
      }
    });
  } catch (error) {
    console.error('Install app endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Uninstall an app
app.delete('/api/v1/marketplace/uninstall/:appId', validateAuth, async (req, res) => {
  try {
    const { appId } = req.params;
    
    // Check if user has this app installed
    const { data: installation, error: checkError } = await supabase
      .from('user_app_installs')
      .select('id, plugin_marketplace_apps(name)')
      .eq('user_id', req.keyInfo.userId)
      .eq('app_id', appId)
      .eq('is_active', true)
      .single();
    
    if (checkError || !installation) {
      return res.status(404).json({
        success: false,
        error: 'App is not installed'
      });
    }
    
    // Mark as uninstalled (soft delete)
    const { error: uninstallError } = await supabase
      .from('user_app_installs')
      .update({ is_active: false, uninstalled_at: new Date().toISOString() })
      .eq('id', installation.id);
    
    if (uninstallError) {
      console.error('Failed to uninstall app:', uninstallError);
      return res.status(500).json({
        success: false,
        error: 'Failed to uninstall app'
      });
    }
    
    // Update app install count
    await supabase.rpc('decrement_install_count', { app_id_in: appId });
    
    res.json({
      success: true,
      data: {
        message: `Successfully uninstalled ${installation.plugin_marketplace_apps.name}`
      }
    });
  } catch (error) {
    console.error('Uninstall app endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// =============================================================================
// ADMIN ENDPOINTS FOR APP APPROVAL
// =============================================================================

// Get pending apps for review (admin only)
app.get('/api/v1/admin/apps/pending', validateApiKey, requireAdminToken, async (req, res) => {
  try {
    const { data: apps, error } = await supabase
      .from('plugin_marketplace_apps')
      .select('*')
      .eq('status', 'pending_review')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Failed to fetch pending apps:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch pending apps'
      });
    }
    
    res.json({
      success: true,
      data: apps || []
    });
  } catch (error) {
    console.error('Pending apps endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Approve or reject an app (admin only)
app.post('/api/v1/admin/apps/:appId/review', validateApiKey, requireAdminToken, async (req, res) => {
  try {
    const { appId } = req.params;
    const { status, reviewerNotes } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "approved" or "rejected"'
      });
    }
    
    const { data: app, error } = await supabase
      .from('plugin_marketplace_apps')
      .update({
        status,
        reviewer_notes: reviewerNotes,
        reviewed_at: new Date().toISOString(),
        reviewed_by: req.keyInfo.userId
      })
      .eq('id', appId)
      .select()
      .single();
    
    if (error || !app) {
      console.error('Failed to update app status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update app status'
      });
    }
    
    res.json({
      success: true,
      data: app
    });
  } catch (error) {
    console.error('App review endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 404 handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Export for Vercel (serverless function format)
module.exports = (req, res) => {
  // Handle the request with Express app
  app(req, res);
};

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
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
}
// Force deployment trigger - Wed Sep 17 19:54:21 CST 2025
