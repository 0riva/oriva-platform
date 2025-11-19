/**
 * BFF Authentication Flow Pattern
 *
 * This file documents the complete Backend For Frontend (BFF) authentication pattern
 * used in o-platform. It shows how JWT tokens, Supabase clients, and RLS policies
 * work together to secure API endpoints.
 *
 * Related files:
 * - src/middleware/auth.ts (JWT extraction and validation)
 * - src/config/supabase.ts (client initialization)
 * - src/types/errors/index.ts (error handling)
 * - src/types/http.ts (response format)
 */

// ============================================================================
// 1. CLIENT INITIALIZATION PATTERN (from src/config/supabase.ts)
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Environment variable declarations for pattern demonstration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * ✅ CORRECT: Dual-client pattern for security
 *
 * - Anon client: Used for user-facing requests (RLS enforced)
 * - Service client: Used for server operations only (RLS bypassed)
 */

// Anon client - RLS policies enforced, user context from JWT
export function getSupabaseClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Edge functions don't persist sessions
    },
    db: {
      schema: 'public',
    },
  });
}

// Service client - RLS policies BYPASSED, full database access
export function getSupabaseServiceClient(): SupabaseClient<Database> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });
}

// ============================================================================
// 2. AUTHENTICATION MIDDLEWARE PATTERN (from src/middleware/auth.ts)
// ============================================================================

import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * ✅ CORRECT: JWT extraction and validation flow
 *
 * Steps:
 * 1. Extract JWT from "Authorization: Bearer <token>" header
 * 2. Verify JWT with Supabase Auth
 * 3. Fetch user profile from database
 * 4. Attach auth context to request
 * 5. Continue to next handler
 */

export interface AuthContext {
  userId: string;
  email: string;
  subscription_tier: 'free' | 'premium' | 'enterprise';
}

export async function authenticate(
  req: VercelRequest,
  res: VercelResponse,
  next: () => void | Promise<void>
): Promise<void> {
  try {
    // Step 1: Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        ok: false,
        error: 'Missing or invalid Authorization header',
        code: 'AUTH_MISSING',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Step 2: Verify JWT with Supabase
    const supabase = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        ok: false,
        error: 'Invalid or expired token',
        code: 'AUTH_INVALID',
      });
      return;
    }

    // Step 3: Fetch user profile (establishes auth.uid() context)
    const { data: userProfile } = (await supabase
      .from('profiles')
      .select('id, subscription_tier, account_id')
      .eq('account_id', user.id)
      .single()) as { data: { id: string; subscription_tier: string; account_id: string } | null };

    if (!userProfile) {
      res.status(404).json({
        ok: false,
        error: 'User profile not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    // Step 4: Attach auth context to request
    (req as any).authContext = {
      userId: userProfile.id,
      email: user.email, // Use email from auth user, not profile
      subscription_tier: userProfile.subscription_tier,
    };

    // Step 5: Continue to next handler
    await next();
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Internal authentication error',
      code: 'AUTH_ERROR',
    });
  }
}

// ============================================================================
// 3. RESPONSE FORMAT PATTERN (from src/types/http.ts)
// ============================================================================

/**
 * ✅ CORRECT: Dual-boolean response format
 *
 * - ok: HTTP-level success (mirrors fetch API response.ok)
 * - success: Business logic success (operation completed as intended)
 *
 * This allows distinguishing:
 * - Network/server issues (ok: false)
 * - Validation failures where server processed request (ok: true, success: false)
 */

export type ApiSuccessResponse<T> = {
  ok: true;
  success?: true; // legacy, optional for compatibility
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  ok: false;
  success?: false; // legacy, optional for compatibility
  error: string; // Human-readable message
  message: string; // Additional details
  code?: string; // Error code (e.g., 'VALIDATION_ERROR')
  details?: string[]; // Detailed error information
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// 4. ERROR HANDLING PATTERN (from src/types/errors/index.ts)
// ============================================================================

/**
 * ✅ CORRECT: Typed error creation with proper status codes
 *
 * Use these helpers to create errors with correct HTTP status codes
 */

export interface ApiError {
  code: string;
  message: string;
  details?: string[];
  status?: number;
}

export interface ValidationError extends ApiError {
  code: 'VALIDATION_ERROR';
  details: string[];
  fieldErrors?: Record<string, string[]>;
}

export interface AuthenticationError extends ApiError {
  code: 'AUTH_REQUIRED' | 'INVALID_API_KEY' | 'UNAUTHORIZED';
  status: 400 | 401 | 403;
}

// Error helpers
export const createValidationError = (
  message: string,
  details: string[] = []
): ValidationError => ({
  code: 'VALIDATION_ERROR',
  message,
  details,
  status: 400,
});

export const createAuthError = (
  code: AuthenticationError['code'],
  message: string,
  details: string[] = []
): AuthenticationError => ({
  code,
  message,
  details,
  status: code === 'UNAUTHORIZED' ? 403 : 401,
});

export const toErrorResponse = (error: ApiError): ApiErrorResponse => ({
  ok: false,
  success: false,
  error: error.message,
  message: error.message,
  code: error.code,
  details: error.details,
});

// ============================================================================
// 5. COMPLETE REQUEST FLOW EXAMPLE
// ============================================================================

/**
 * ✅ CORRECT: Complete BFF authentication flow
 *
 * Frontend Request:
 * GET /api/v1/conversations
 * Authorization: Bearer <JWT_TOKEN>
 *
 * o-platform Processing:
 * 1. Auth middleware validates JWT
 * 2. Auth middleware fetches user profile (sets auth.uid())
 * 3. Handler receives authenticated request
 * 4. Handler uses getSupabaseClient() for user operations
 * 5. Supabase RLS policies check auth.uid() for access control
 *
 * Response:
 * {
 *   "ok": true,
 *   "success": true,
 *   "data": [ ... user's conversations ... ]
 * }
 */

export async function handleGetConversations(req: VercelRequest, res: VercelResponse) {
  try {
    const authContext = (req as any).authContext;
    if (!authContext) {
      return res
        .status(401)
        .json(toErrorResponse(createAuthError('UNAUTHORIZED', 'User not authenticated')));
    }

    // Use anon client - RLS policies enforce access control
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('conversations' as any)
      .select('*')
      .eq('user_id', authContext.userId); // RLS will also check this

    if (error) {
      return res.status(500).json(
        toErrorResponse({
          code: 'DATABASE_ERROR',
          message: 'Failed to fetch conversations',
          status: 500,
        })
      );
    }

    res.status(200).json({
      ok: true,
      success: true,
      data,
      meta: {
        pagination: {
          page: 1,
          limit: data.length,
          total: data.length,
          totalPages: 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json(
      toErrorResponse({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        status: 500,
      })
    );
  }
}

// ============================================================================
// 6. ANTI-PATTERNS: WHAT NOT TO DO
// ============================================================================

/**
 * ❌ WRONG: Using service client for user-facing operations
 */
export async function BAD_handleGetConversations(req: VercelRequest, res: VercelResponse) {
  // DANGER: This bypasses RLS and exposes all conversations
  const adminClient = getSupabaseServiceClient();
  const { data } = await adminClient.from('conversations' as any).select('*');
  // This returns conversations for ALL users, not just the authenticated user!
}

/**
 * ❌ WRONG: Missing JWT validation
 */
export async function BAD_handleWithoutAuth(req: VercelRequest, res: VercelResponse) {
  // DANGER: No auth context, anyone can call this
  const supabase = getSupabaseClient();
  // But now auth.uid() is NULL in RLS policies!
}

/**
 * ❌ WRONG: Incorrect response format
 */
export async function BAD_responseFormat(req: VercelRequest, res: VercelResponse) {
  res.json({
    // WRONG: Missing 'ok' field
    success: true,
    data: { id: '123' },
  });
}

/**
 * ❌ WRONG: Exposing sensitive errors
 */
export async function BAD_errorHandling(req: VercelRequest, res: VercelResponse) {
  try {
    // some operation
  } catch (error: any) {
    // DANGER: Exposing internal database error messages
    res.status(500).json({
      ok: false,
      error: error.message, // Could reveal SQL structure, internal details
    });
  }
}

// ============================================================================
// 7. CHECKLIST: BFF AUTH IMPLEMENTATION
// ============================================================================

/**
 * Use this checklist when implementing a new endpoint:
 *
 * ✅ JWT Extraction
 *    - Extract token from "Authorization: Bearer <token>" header
 *    - Return 401 if missing or invalid
 *
 * ✅ JWT Verification
 *    - Verify with Supabase Auth
 *    - Check that user.id exists
 *    - Return 401 if invalid/expired
 *
 * ✅ Profile Lookup
 *    - Fetch user profile from profiles table
 *    - Use auth.uid() to establish context
 *    - Return 404 if profile not found
 *
 * ✅ Auth Context Attachment
 *    - Attach authContext to request object
 *    - Include userId, email, subscription_tier
 *
 * ✅ Anon Client Usage
 *    - Use getSupabaseClient() for user operations (not service client!)
 *    - RLS policies will enforce data access control
 *
 * ✅ Correct Response Format
 *    - Always return {ok: boolean, success?: boolean, data/error}
 *    - Match ApiSuccessResponse or ApiErrorResponse types
 *
 * ✅ Error Handling
 *    - Use createValidationError, createAuthError helpers
 *    - Never expose internal database errors
 *    - Always set correct HTTP status codes
 *
 * ✅ Status Code Mapping
 *    - 400: VALIDATION_ERROR (invalid input)
 *    - 401: AUTH_REQUIRED, INVALID_TOKEN (missing/invalid auth)
 *    - 403: UNAUTHORIZED (authenticated but no permission via RLS)
 *    - 404: NOT_FOUND (resource doesn't exist)
 *    - 500: DATABASE_ERROR, INTERNAL_ERROR (server error)
 */
