/**
 * Common Zod schemas for reuse across endpoints
 * Single source of truth for validation rules
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════
// Base Field Schemas (Atomic building blocks)
// ═══════════════════════════════════════════════════════════════════════════

export const IdSchema = z.string().uuid('Must be a valid UUID');

export const EmailSchema = z
  .string()
  .email('Invalid email format')
  .toLowerCase()
  .max(254, 'Email too long');

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine((password) => /\d/.test(password), 'Password must contain at least one number');

/**
 * For login, we don't validate password strength, just that it exists.
 * Strength validation happens at registration time only.
 */
export const LoginPasswordSchema = z.string().min(1, 'Password is required');

export const NameSchema = z
  .string()
  .min(1, 'Name cannot be empty')
  .max(100, 'Name cannot exceed 100 characters')
  .trim();

export const UsernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username cannot exceed 50 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, hyphens, and underscores'
  );

export const BioSchema = z.string().max(500, 'Bio cannot exceed 500 characters').optional();

export const UrlSchema = z
  .string()
  .url('Invalid URL format')
  .max(500, 'URL too long')
  .optional()
  .or(z.literal(''));

export const TimestampSchema = z.string().datetime('Invalid ISO datetime format');

export const RefreshTokenSchema = z.string().min(1, 'Refresh token is required');

// ═══════════════════════════════════════════════════════════════════════════
// Composite User Schemas
// ═══════════════════════════════════════════════════════════════════════════

export const UserProfileBaseSchema = z.object({
  displayName: NameSchema,
  username: UsernameSchema,
  bio: BioSchema,
  avatarUrl: UrlSchema,
  websiteUrl: UrlSchema,
  location: z.string().max(100).optional(),
});

export const UserCreateSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: NameSchema,
});

export const UserLoginSchema = z.object({
  email: EmailSchema,
  password: LoginPasswordSchema,
});

export const UserUpdateProfileSchema = UserProfileBaseSchema.partial().strict();

export const PasswordResetRequestSchema = z.object({
  email: EmailSchema,
});

export const PasswordResetCompleteSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: PasswordSchema,
});

export const TokenRefreshSchema = z.object({
  refreshToken: RefreshTokenSchema,
});

// ═══════════════════════════════════════════════════════════════════════════
// Response Schemas (For documentation and validation of outgoing data)
// ═══════════════════════════════════════════════════════════════════════════

export const UserProfileResponseSchema = z.object({
  id: IdSchema,
  email: EmailSchema,
  displayName: NameSchema,
  username: UsernameSchema,
  bio: BioSchema,
  avatarUrl: UrlSchema,
  websiteUrl: UrlSchema,
  location: z.string().optional(),
});

export const AuthTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number().int().positive(),
  tokenType: z.literal('Bearer'),
});

export const AuthResponseSchema = z.object({
  user: UserProfileResponseSchema,
  tokens: AuthTokenResponseSchema,
});
