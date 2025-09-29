import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient, type PostgrestError } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { param, validationResult } from 'express-validator';
import winston from 'winston';
import type { Logger } from 'winston';

// ============================================================================
// INLINE TYPE DEFINITIONS (avoiding external imports)
// ============================================================================

// Auth Types
export type AuthType = 'api_key' | 'supabase_auth';

export interface ApiKeyInfo {
  id: string;
  userId: string;
  name: string;
  permissions: string[];
  usageCount: number;
  isActive: boolean;
  authType: AuthType;
  lastUsedAt?: string;
}

export interface AuthenticatedRequest<TParams = any, TResBody = any, TReqBody = any> extends Request<TParams, TResBody, TReqBody> {
  apiKey?: string;
  authToken?: string;
  keyInfo?: ApiKeyInfo;
}

export type ApiMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

export const hasApiKeyInfo = (
  req: AuthenticatedRequest
): req is AuthenticatedRequest & { keyInfo: ApiKeyInfo } => Boolean(req.keyInfo);

// HTTP Response Types
export type ApiErrorResponse = {
  ok: false;
  success?: false;
  error: string;
  message: string;
  code?: string;
  details?: string[];
};

export type ApiSuccessResponse<T> = {
  ok: true;
  success?: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationMeta {
  pagination: PaginationInfo;
}

export type PaginatedResponse<T = unknown> = ApiSuccessResponse<T[]> & {
  meta: PaginationMeta;
};

// Database Entity Types
export const AUDIENCE_TYPES = [
  'public',
  'private',
  'followers',
  'groups',
  'draft'
] as const;
export type AudienceType = typeof AUDIENCE_TYPES[number];

export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  location?: string;
  website_url?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  account_id: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface Entry {
  id: string;
  content: string;
  audience: AudienceType;
  author_id: string;
  group_id?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

// ============================================================================
// APPLICATION SETUP
// ============================================================================

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enhanced logging setup
const logger: Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'oriva-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Database setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security: CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [
        'https://oriva.app',
        'https://www.oriva.app',
        'https://app.oriva.app',
        'https://oriva-platform.vercel.app'
      ]
    : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-api-key']
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting
const createRateLimit = (windowMs: number, max: number, message: string) => rateLimit({
  windowMs,
  max,
  message: { error: message, ok: false },
  standardHeaders: true,
  legacyHeaders: false,
});

// API key authentication middleware
const authenticateAPIKey: ApiMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      res.status(401).json({
        ok: false,
        error: 'Authentication required',
        message: 'API key is required'
      });
      return;
    }

    // Hash the API key for database lookup
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Look up the API key in the database
    const { data: keyData, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', apiKeyHash)
      .eq('is_active', true)
      .single();

    if (error || !keyData) {
      res.status(401).json({
        ok: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid or has been deactivated'
      });
      return;
    }

    // Update usage tracking
    await supabase
      .from('api_keys')
      .update({
        usage_count: keyData.usage_count + 1,
        last_used_at: new Date().toISOString()
      })
      .eq('id', keyData.id);

    // Attach key info to request
    req.keyInfo = {
      id: keyData.id,
      userId: keyData.user_id,
      name: keyData.name,
      permissions: keyData.permissions || [],
      usageCount: keyData.usage_count,
      isActive: keyData.is_active,
      authType: 'api_key',
      lastUsedAt: keyData.last_used_at
    };

    next();
  } catch (err) {
    logger.error('API key authentication error:', err);
    res.status(500).json({
      ok: false,
      error: 'Authentication error',
      message: 'Internal authentication error'
    });
  }
};

// ============================================================================
// API ENDPOINTS - PROFILES
// ============================================================================

// Get available profiles (Active profiles with usernames)
app.get('/api/v1/profiles/available', authenticateAPIKey, createRateLimit(60000, 100, 'Too many profile requests'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, created_at')
      .not('username', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Database error fetching available profiles:', error);
      return res.status(500).json({
        ok: false,
        error: 'Database error',
        message: 'Failed to fetch available profiles'
      });
    }

    res.json({
      ok: true,
      data: profiles || [],
      meta: { count: profiles?.length || 0 }
    });
  } catch (err) {
    logger.error('Error fetching available profiles:', err);
    res.status(500).json({
      ok: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
});

// Get active profiles (Recently active profiles)
app.get('/api/v1/profiles/active', authenticateAPIKey, createRateLimit(60000, 100, 'Too many profile requests'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get profiles that have been active in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, bio, avatar_url, updated_at')
      .not('username', 'is', null)
      .gte('updated_at', thirtyDaysAgo.toISOString())
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('Database error fetching active profiles:', error);
      return res.status(500).json({
        ok: false,
        error: 'Database error',
        message: 'Failed to fetch active profiles'
      });
    }

    res.json({
      ok: true,
      data: profiles || [],
      meta: {
        count: profiles?.length || 0,
        period: '30 days'
      }
    });
  } catch (err) {
    logger.error('Error fetching active profiles:', err);
    res.status(500).json({
      ok: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// API ENDPOINTS - GROUPS
// ============================================================================

// Get all groups
app.get('/api/v1/groups', authenticateAPIKey, createRateLimit(60000, 100, 'Too many group requests'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: groups, error } = await supabase
      .from('groups')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Database error fetching groups:', error);
      return res.status(500).json({
        ok: false,
        error: 'Database error',
        message: 'Failed to fetch groups'
      });
    }

    res.json({
      ok: true,
      data: groups || [],
      meta: { count: groups?.length || 0 }
    });
  } catch (err) {
    logger.error('Error fetching groups:', err);
    res.status(500).json({
      ok: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// API ENDPOINTS - ENTRIES
// ============================================================================

// Get all entries
app.get('/api/v1/entries', authenticateAPIKey, createRateLimit(60000, 100, 'Too many entry requests'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: entries, error } = await supabase
      .from('entries')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Database error fetching entries:', error);
      return res.status(500).json({
        ok: false,
        error: 'Database error',
        message: 'Failed to fetch entries'
      });
    }

    res.json({
      ok: true,
      data: entries || [],
      meta: { count: entries?.length || 0 }
    });
  } catch (err) {
    logger.error('Error fetching entries:', err);
    res.status(500).json({
      ok: false,
      error: 'Server error',
      message: 'Internal server error'
    });
  }
});

// ============================================================================
// ROOT ENDPOINT
// ============================================================================

app.get('/', (req: Request, res: Response) => {
  res.json({
    ok: true,
    message: 'Oriva Platform API',
    version: '1.0.0',
    endpoints: {
      profiles: {
        available: '/api/v1/profiles/available',
        active: '/api/v1/profiles/active'
      },
      groups: '/api/v1/groups',
      entries: '/api/v1/entries'
    },
    documentation: 'https://oriva.app/api-docs'
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Catch-all for undefined routes
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: 'Not Found',
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    ok: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// Start server (for local development)
if (require.main === module) {
  app.listen(port, () => {
    logger.info(`🚀 Oriva Platform API running on port ${port}`);
    logger.info(`📖 Documentation: https://oriva.app/api-docs`);
  });
}

// Export for serverless deployment
export default app;
export const handler = app;