import { z } from 'zod';
import { registry } from '../registry';

// ── Request body schemas ────────────────────────────────────────────────────
// These mirror what each handler actually reads from req.body, not the stricter
// common.ts schemas (which use camelCase fields the handlers don't check).

// POST /api/v1/auth/register
// Handler requires: email (valid format), password (8+ chars, upper/lower/digit)
// Handler accepts optionally: name, username, preferences
export const RegisterBodySchema = z
  .object({
    email: z.string().email(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/\d/, 'Password must contain a number'),
    name: z.string().optional(),
    username: z.string().optional(),
    preferences: z.unknown().optional(),
  })
  .passthrough();

// POST /api/v1/auth/login
export const LoginBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required'),
  })
  .passthrough();

// POST /api/v1/auth/token/refresh
// Handler reads refresh_token (snake_case), not refreshToken (camelCase)
export const TokenRefreshBodySchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
});

// PATCH /api/v1/auth/profile
// Handler requires at least one field — documented but not validated via Zod
// to avoid rejecting callers who send unknown extra keys
export const PatchProfileBodySchema = z
  .object({
    name: z.string().optional(),
    bio: z.string().optional(),
    avatar_url: z.string().url().optional(),
    location: z.string().optional(),
    website_url: z.string().url().optional(),
  })
  .passthrough();

// PUT /api/v1/auth/profile (superset of PATCH — adds preferences + data_retention_days)
export const PutProfileBodySchema = z
  .object({
    name: z.string().optional(),
    bio: z.string().optional(),
    avatar_url: z.string().url().optional(),
    location: z.string().optional(),
    website_url: z.string().url().optional(),
    preferences: z.record(z.unknown()).optional(),
    data_retention_days: z.number().int().min(30).optional(),
  })
  .passthrough();

// ── Response schemas ────────────────────────────────────────────────────────

// Shared session response returned by register + login
const SessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable(),
  display_name: z.string().nullable(),
  username: z.string().nullable(),
  subscription_tier: z.string(),
  created_at: z.string().datetime(),
});

export const AuthSessionResponseSchema = registry.register(
  'AuthSessionResponse',
  z.object({
    user: SessionUserSchema,
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number().int(),
  })
);

// GET /api/v1/auth/profile — served by the withAuthContext handler at line ~1554
// (Express uses the first registration; the second one at ~4062 is shadowed)
export const AuthProfileResponseSchema = registry.register(
  'AuthProfileResponse',
  z.object({
    ok: z.boolean(),
    success: z.boolean(),
    data: z.object({
      id: z.string().uuid(),
      email: z.string().email().nullable(),
      displayName: z.string(),
      avatar: z.string().url().nullable(),
      authType: z.string(),
      permissions: z.array(z.string()),
      lastLogin: z.string().datetime(),
      accountStatus: z.string(),
      twoFactorEnabled: z.boolean(),
      emailVerified: z.boolean(),
    }),
  })
);

// Raw DB profile row returned by PATCH/PUT /api/v1/auth/profile
export const RawProfileResponseSchema = registry.register(
  'RawProfileResponse',
  z.object({
    id: z.string(),
    display_name: z.string().nullable(),
    username: z.string().nullable(),
    bio: z.string().nullable(),
    avatar_url: z.string().url().nullable(),
    location: z.string().nullable(),
    website_url: z.string().url().nullable(),
  })
);

export const TokenRefreshResponseSchema = registry.register(
  'TokenRefreshResponse',
  z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number().int(),
  })
);

// ── Path registrations ──────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  request: {
    body: { content: { 'application/json': { schema: RegisterBodySchema } } },
  },
  responses: {
    201: {
      description: 'User registered and session created',
      content: { 'application/json': { schema: AuthSessionResponseSchema } },
    },
    400: { description: 'Validation error — weak password or invalid email' },
    409: { description: 'Email already registered' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['Auth'],
  summary: 'Log in',
  request: {
    body: { content: { 'application/json': { schema: LoginBodySchema } } },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: { 'application/json': { schema: AuthSessionResponseSchema } },
    },
    400: { description: 'Validation error — missing email or password' },
    401: { description: 'Invalid credentials' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  tags: ['Auth'],
  summary: 'Log out',
  description: 'Invalidates the current session. Requires Authorization header.',
  security: [{ BearerAuth: [] }],
  responses: {
    204: { description: 'Logged out' },
    401: { description: 'Missing authorization header' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/token/refresh',
  tags: ['Auth'],
  summary: 'Refresh access token',
  request: {
    body: { content: { 'application/json': { schema: TokenRefreshBodySchema } } },
  },
  responses: {
    200: {
      description: 'New tokens issued',
      content: { 'application/json': { schema: TokenRefreshResponseSchema } },
    },
    400: { description: 'Validation error — missing refresh_token' },
    401: { description: 'Invalid or expired refresh token' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/auth/profile',
  tags: ['Auth'],
  summary: 'Get auth profile',
  description: 'Returns the authenticated user identity and API key metadata.',
  security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
  responses: {
    200: {
      description: 'Auth profile',
      content: { 'application/json': { schema: AuthProfileResponseSchema } },
    },
    401: { description: 'Unauthorized' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/auth/profile',
  tags: ['Auth'],
  summary: 'Update profile (partial)',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: PatchProfileBodySchema } } },
  },
  responses: {
    200: {
      description: 'Updated profile row',
      content: { 'application/json': { schema: RawProfileResponseSchema } },
    },
    400: { description: 'No fields provided' },
    401: { description: 'Unauthorized' },
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/auth/profile',
  tags: ['Auth'],
  summary: 'Update profile (full)',
  description: 'Superset of PATCH — also accepts preferences and data_retention_days (min 30).',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: PutProfileBodySchema } } },
  },
  responses: {
    200: {
      description: 'Updated profile row',
      content: { 'application/json': { schema: RawProfileResponseSchema } },
    },
    400: { description: 'No fields provided, or data_retention_days < 30' },
    401: { description: 'Unauthorized' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/auth/account',
  tags: ['Auth'],
  summary: 'Delete account',
  security: [{ BearerAuth: [] }],
  responses: {
    204: { description: 'Account deleted' },
    401: { description: 'Unauthorized' },
  },
});
