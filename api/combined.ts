import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import { param, validationResult } from 'express-validator';
import winston from 'winston';
import type { Logger } from 'winston';

dotenv.config();

const webcrypto = globalThis.crypto ?? crypto.webcrypto;

// ============================================================================
// INLINE TYPES (from ./types/*)
// ============================================================================

// From types/middleware/auth.ts
export interface ApiKeyInfo {
  id: string;
  user_id: string;
  name: string;
  permissions: string[];
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export interface AuthenticatedRequest extends Request {
  apiKey?: ApiKeyInfo;
}

export type ApiMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

// From types/api/responses.ts
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  version: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// From types/database/entities.ts
export const AUDIENCE_TYPES = ['general', 'internal', 'external', 'customer', 'partner'] as const;
export type AudienceType = typeof AUDIENCE_TYPES[number];

export interface DatabaseQueryResult<T = any> {
  data: T | null;
  error: any;
  count?: number | null;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  website?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private' | 'invite_only';
  owner_id: string;
  avatar_url?: string;
  banner_url?: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  joined_at: string;
}

export interface Entry {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  author_id: string;
  audience_type: AudienceType;
  tags?: string[];
  is_featured: boolean;
  is_published: boolean;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

// From types/database/marketplace.ts
export interface MarketplaceApp {
  id: string;
  name: string;
  description?: string;
  developer_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  api_key_id?: string;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

// From types/errors/index.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function createAuthError(message: string, details?: any): ApiError {
  return new ApiError(message, 401, 'AUTH_ERROR', details);
}

export function createDatabaseError(message: string, details?: any): ApiError {
  return new ApiError(message, 500, 'DATABASE_ERROR', details);
}

export function createValidationError(message: string, details?: any): ApiError {
  return new ApiError(message, 400, 'VALIDATION_ERROR', details);
}

export function toErrorResponse(error: ApiError | Error): ApiResponse {
  if (error instanceof ApiError) {
    return {
      success: false,
      error: error.code || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0'
    };
  }

  return {
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An internal server error occurred',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  };
}

// ============================================================================
// INLINE MIDDLEWARE (from ./middleware/*)
// ============================================================================

// From middleware/auth.ts
export function createAuthMiddleware(supabase: SupabaseClient): ApiMiddleware {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Extract API key from Authorization header or X-API-Key header
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'] as string;

      let apiKey: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      } else if (apiKeyHeader) {
        apiKey = apiKeyHeader;
      }

      if (!apiKey) {
        return res.status(401).json(toErrorResponse(createAuthError('API key required')));
      }

      // Hash the API key to compare with stored hash
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await webcrypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const apiKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Look up the API key in the database
      const { data: keyData, error } = await supabase
        .from('developer_api_keys')
        .select('id, user_id, name, permissions, usage_count, is_active, created_at')
        .eq('key_hash', apiKeyHash)
        .eq('is_active', true)
        .single();

      if (error || !keyData) {
        return res.status(401).json(toErrorResponse(createAuthError('Invalid API key')));
      }

      // Attach API key info to request
      req.apiKey = keyData;

      // Update usage count
      await supabase
        .from('developer_api_keys')
        .update({ usage_count: keyData.usage_count + 1 })
        .eq('id', keyData.id);

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json(toErrorResponse(createDatabaseError('Authentication failed')));
    }
  };
}

export function createLegacyApiKeyMiddleware(supabase: SupabaseClient): ApiMiddleware {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Legacy support - same as createAuthMiddleware for now
    return createAuthMiddleware(supabase)(req, res, next);
  };
}

// From middleware/error-handler.ts
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Unhandled error:', error);

  if (error instanceof ApiError) {
    res.status(error.statusCode).json(toErrorResponse(error));
  } else {
    res.status(500).json(toErrorResponse(new ApiError('Internal server error')));
  }
}

// ============================================================================
// INLINE ROUTES (from ./routes/*)
// ============================================================================

// From routes/hugo-ai.ts
export function createHugoAIRouter(supabase: SupabaseClient): express.Router {
  const router = express.Router();

  // Hugo AI endpoints
  router.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { message, conversation_id } = req.body;

      if (!message) {
        return res.status(400).json(toErrorResponse(createValidationError('Message is required')));
      }

      // Mock Hugo AI response for now
      const response = {
        id: crypto.randomUUID(),
        message: `Hugo AI response to: ${message}`,
        conversation_id: conversation_id || crypto.randomUUID(),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0'
      });
    } catch (error) {
      console.error('Hugo AI chat error:', error);
      res.status(500).json(toErrorResponse(createDatabaseError('Hugo AI chat failed')));
    }
  });

  router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Mock conversations list
      const conversations = [
        {
          id: crypto.randomUUID(),
          title: 'Sample Conversation',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        data: conversations,
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0'
      });
    } catch (error) {
      console.error('Hugo AI conversations error:', error);
      res.status(500).json(toErrorResponse(createDatabaseError('Failed to fetch conversations')));
    }
  });

  return router;
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export const app = express();

// Production logging setup
const logger: Logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Supabase client initialization
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error('Missing required Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS configuration
const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [
  'https://oriva.io',
  'https://www.oriva.io',
  'https://oriva.app',
  'https://www.oriva.app',
  'https://app.oriva.app',
  'http://localhost:8081'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (corsOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}));

// Additional CORS headers middleware to ensure headers are present on all responses
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && corsOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // For requests without origin (mobile apps, curl, etc.)
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  }
});

app.use('/api/', limiter);

// Health check endpoint (no auth required)
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Oriva API is running',
    version: process.env.API_VERSION || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API is healthy',
    version: process.env.API_VERSION || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Authentication middleware for all API routes
const authMiddleware = createAuthMiddleware(supabase);
app.use('/api/v1', authMiddleware);

// ============================================================================
// API ROUTES
// ============================================================================

// Profiles endpoints
app.get('/api/v1/profiles/available', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, display_name, bio, avatar_url, location, is_public, created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: profiles || [],
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0'
    });
  } catch (error) {
    logger.error('Error fetching available profiles:', error);
    res.status(500).json(toErrorResponse(createDatabaseError('Failed to fetch available profiles')));
  }
});

app.get('/api/v1/profiles/active', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, display_name, bio, avatar_url, location, is_public, created_at')
      .eq('is_public', true)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: profiles || [],
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0'
    });
  } catch (error) {
    logger.error('Error fetching active profiles:', error);
    res.status(500).json(toErrorResponse(createDatabaseError('Failed to fetch active profiles')));
  }
});

// Groups endpoints
app.get('/api/v1/groups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name, description, type, member_count, created_at')
      .eq('type', 'public')
      .order('member_count', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: groups || [],
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0'
    });
  } catch (error) {
    logger.error('Error fetching groups:', error);
    res.status(500).json(toErrorResponse(createDatabaseError('Failed to fetch groups')));
  }
});

// Entries endpoints
app.get('/api/v1/entries', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: entries, error } = await supabase
      .from('entries')
      .select('id, title, excerpt, author_id, audience_type, tags, is_featured, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: entries || [],
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0'
    });
  } catch (error) {
    logger.error('Error fetching entries:', error);
    res.status(500).json(toErrorResponse(createDatabaseError('Failed to fetch entries')));
  }
});

// Hugo AI routes
app.use('/api/v1/hugo-ai', createHugoAIRouter(supabase));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString(),
    version: process.env.API_VERSION || '1.0.0'
  });
});

// Export handler for Vercel
export default app;