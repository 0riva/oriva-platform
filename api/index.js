// Load env variables in local/dev
try { require('dotenv').config(); } catch {}
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Required environment variables:');
  console.error('   - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log('✅ Supabase client initialized for API key validation');

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

// API Key validation middleware
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
        last_used_at: new Date().toISOString(),
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
      usageCount: keyData.usage_count,
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
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

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
      key: key.key_prefix + '•'.repeat(24) + '••••', // Show prefix and masked key
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

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
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

// Export for Vercel
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
}
