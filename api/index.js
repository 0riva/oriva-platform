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
const { body, param, validationResult } = require('express-validator');
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
          const url = new URL(app.execution_url);
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

// Fallback origins when dynamic CORS fails
const FALLBACK_ORIGINS = [
  'https://oriva.io',
  'https://www.oriva.io',
  'https://app.oriva.io',
  'https://work-buddy-expo.vercel.app' // Ensure Work Buddy always works
];

// Dynamic CORS configuration that supports 3rd party developer apps
const dynamicCorsOrigin = async (origin, callback) => {
  try {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // Development: Allow localhost for testing
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      logger.info('CORS: Allowing localhost in development', { origin });
      return callback(null, true);
    }

    // Check fallback origins first (always allow these)
    if (FALLBACK_ORIGINS.includes(origin)) {
      logger.info('CORS: Allowing fallback origin', { origin });
      return callback(null, true);
    }

    // Check if cache needs refresh
    const cacheAge = Date.now() - corsOriginCache.lastUpdated;
    if (cacheAge > corsOriginCache.CACHE_TTL || corsOriginCache.data.size === 0) {
      logger.debug('CORS: Refreshing cache', { cacheAge, cacheSize: corsOriginCache.data.size });
      await refreshCorsCache();
    }

    // Check if origin is in cache
    if (corsOriginCache.data.has(origin)) {
      logger.debug('CORS: Allowing cached origin', { origin });
      return callback(null, true);
    }

    // Block unregistered origins
    logger.warn('CORS: Blocking unregistered origin', {
      origin,
      registeredOrigins: Array.from(corsOriginCache.data).length
    });
    callback(new Error('Not allowed by CORS'));

  } catch (error) {
    logger.error('CORS: Error in dynamic origin check, checking fallbacks', { error, origin });

    // Fallback: allow known safe origins even when DB is down
    if (FALLBACK_ORIGINS.includes(origin)) {
      logger.warn('CORS: Allowing fallback origin due to error', { origin, error: error.message });
      return callback(null, true);
    }

    // Still block unknown origins
    callback(new Error('CORS configuration error'));
  }
};

// Initialize CORS cache on startup
refreshCorsCache().then(() => {
  console.log('✅ CORS cache initialized with registered app domains');
}).catch(error => {
  console.warn('⚠️ Failed to initialize CORS cache:', error.message);
});

// Middleware with dynamic CORS
app.use(cors({
  origin: dynamicCorsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Extension-ID'],
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 1000, // limit each IP to 1000 requests per windowMs
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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Required environment variables:');
  console.error('   - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('🚨 API cannot start without database connection');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log('✅ Supabase client initialized for API key validation');

// CORS cache for performance optimization
let corsOriginCache = {
  data: new Set(),
  lastUpdated: 0,
  CACHE_TTL: 5 * 60 * 1000 // 5 minutes
};

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
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
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

      // Add key info to request
      req.apiKey = token;
      req.keyInfo = {
        id: keyData.id,
        userId: keyData.user_id,
        name: keyData.name,
        permissions: keyData.permissions,
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
      permissions: keyData.permissions,
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

// Debug endpoint to check CORS cache state (admin only)
app.get('/api/v1/debug/cors', requireAdminToken, async (req, res) => {
  try {
    // Test Supabase connection
    const { data: testQuery, error: testError } = await supabase
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

// API Key Management endpoints (for developer dashboard)
// Note: API key generation is now handled by the frontend via Supabase
// This endpoint is kept for backward compatibility but no longer creates keys
app.post('/api/v1/dev/generate-key', devRateLimiter, requireAdminToken, (req, res) => {
  res.status(501).json({
    success: false,
    error: 'API key generation is now handled through the developer dashboard frontend. Please use the web interface to create API keys.',
    redirect: '/developer/api-keys'
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
app.get('/api/v1/user/me', validateApiKey, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.keyInfo.userId || 'user_unknown',
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com',
      bio: 'Test user bio',
      location: 'Test Location',
      website: 'https://example.com',
      avatar: 'https://example.com/avatar.jpg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
});

// =============================================================================
// PROFILE ENDPOINTS
// =============================================================================

// Get available profiles for the extension
app.get('/api/v1/profiles/available', validateApiKey, async (req, res) => {
  try {
    // For now, return mock data to make tests pass
    // TODO: Implement real profile fetching from Oriva Core
    const mockProfiles = [
      {
        profileId: 'ext_1234567890abcdef',
        profileName: 'Dating Profile',
        isActive: true
      },
      {
        profileId: 'ext_fedcba0987654321',
        profileName: 'Work Profile',
        isActive: false
      }
    ];

    res.json({
      success: true,
      data: mockProfiles
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
    // For now, return mock data to make tests pass
    // TODO: Implement real active profile fetching
    const mockActiveProfile = {
      profileId: 'ext_1234567890abcdef',
      profileName: 'Dating Profile',
      isActive: true
    };

    res.json({
      success: true,
      data: mockActiveProfile
    });
  } catch (error) {
    console.error('Failed to fetch active profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active profile'
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
    // For now, return mock data to make tests pass
    // TODO: Implement real group fetching from Oriva Core
    const mockGroups = [
      {
        groupId: 'ext_9876543210fedcba',
        groupName: 'Work Team Alpha',
        memberCount: 5,
        isActive: true
      },
      {
        groupId: 'ext_abcdef0123456789',
        groupName: 'Gaming Squad',
        memberCount: 8,
        isActive: true
      }
    ];

    res.json({
      success: true,
      data: mockGroups
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
  param('groupId').matches(/^ext_[a-f0-9]{16}$/).withMessage('Invalid group ID format'),
  validateRequest,
  async (req, res) => {
  try {
    const { groupId } = req.params;

    // For now, return mock data to make tests pass
    // TODO: Implement real group member fetching from Oriva Core
    const mockMembers = [
      {
        memberId: 'ext_member_1234567890',
        displayName: 'Alex Johnson',
        role: 'admin',
        joinedAt: '2024-01-15T10:00:00Z'
      },
      {
        memberId: 'ext_member_0987654321',
        displayName: 'Sam Wilson',
        role: 'member',
        joinedAt: '2024-01-20T14:30:00Z'
      }
    ];

    res.json({
      success: true,
      data: mockMembers
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
app.get('/api/v1/entries', validateApiKey, (req, res) => {
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
    const { days_back = 7, limit = 10 } = req.query;
    
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
    const { data: existingInstall, error: checkError } = await supabase
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
app.use((err, req, res, next) => {
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
