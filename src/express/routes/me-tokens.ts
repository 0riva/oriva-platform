/**
 * Personal Access Token (PAT) routes
 * Mounted at /api/v1 (subpaths: /me/tokens, /me/tokens/:id)
 *
 * Auth: inline JWT verify via supabase.auth.getUser() — deliberately NOT using the
 * shared validateAuth middleware (which auto-loads/creates a public.profiles row).
 * PATs are auth.users-scoped only. Rate-limited via authRateLimiter.
 * NOT authenticated by API key — these are the routes that CREATE the keys.
 *
 * Key format: oriva_pk_live_<48 hex chars> — uses the live_ qualifier so the
 * shared validateApiKey middleware accepts it (it requires test_/live_ prefix).
 * Key stored: SHA-256 hash only — full value returned once on creation.
 */

import crypto from 'node:crypto';
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { RequestHandler } from 'express';
import { respondWithError } from '../utils/response';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { z } from 'zod';

// ── Validation ─────────────────────────────────────────────────────────────

const CreateTokenBodySchema = z.object({
  name: z.string().min(1).max(100),
  expires_at: z.string().datetime().optional(),
});

// ── Factory ────────────────────────────────────────────────────────────────

export function createMeTokensRouter(
  supabase: SupabaseClient,
  logger: Logger,
  _validateAuth?: RequestHandler[]
): Router {
  const router = Router();

  /**
   * Helper: resolve auth.users.id from the Supabase JWT on the request.
   *
   * PAT routes deliberately do NOT use the shared validateAuth middleware
   * because that middleware auto-creates a row in public.profiles when one
   * doesn't exist for the user. PATs are auth.users-scoped (not profile-
   * scoped), so the profile dependency is wrong here — and the auto-create
   * fails for some users with "Failed to create user profile" (a separate
   * bug). We instead inline JWT verify + user resolution.
   */
  async function resolveAuthUserId(req: any): Promise<string | null> {
    try {
      const authHeader = req.headers.authorization as string | undefined;
      if (!authHeader?.startsWith('Bearer ')) return null;
      const token = authHeader.slice(7);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) return null;
      return user.id;
    } catch {
      return null;
    }
  }

  // ── POST /me/tokens — create a PAT ────────────────────────────────────────

  router.post('/me/tokens', authRateLimiter, async (req: any, res: any) => {
    try {
      const parse = CreateTokenBodySchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return respondWithError(
          res,
          400,
          'VALIDATION_ERROR',
          parse.error.issues[0]?.message ?? 'Invalid request body'
        );
      }
      const { name, expires_at } = parse.data;

      const authUserId = await resolveAuthUserId(req);
      if (!authUserId) {
        return respondWithError(res, 401, 'AUTH_REQUIRED', 'Could not resolve authenticated user');
      }

      // Generate token: oriva_pk_live_<48 random hex chars>
      // The `live_` qualifier is required by the shared validateApiKey middleware,
      // which only accepts oriva_pk_test_ or oriva_pk_live_ prefixed keys.
      const tokenValue = `oriva_pk_live_${crypto.randomBytes(24).toString('hex')}`;
      const keyHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
      // Store first 24 chars as display prefix (safe to show in lists — includes oriva_pk_live_)
      const keyPrefix = tokenValue.slice(0, 24);

      const insertPayload: Record<string, unknown> = {
        user_id: authUserId,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        key_type: 'personal',
        permissions: ['read', 'write'],
        is_active: true,
        usage_count: 0,
      };
      if (expires_at) insertPayload.expires_at = expires_at;

      const { data: row, error: insertError } = await supabase
        .from('developer_api_keys')
        .insert(insertPayload)
        .select('id, name, key_prefix, created_at, expires_at')
        .single();

      if (insertError || !row) {
        logger.error('Failed to insert PAT', { error: insertError, authUserId });
        return respondWithError(res, 500, 'TOKEN_CREATE_ERROR', 'Failed to create token');
      }

      res.status(201).json({
        ok: true,
        success: true,
        data: {
          token: tokenValue,
          id: row.id,
          name: row.name,
          prefix: row.key_prefix,
          created_at: row.created_at,
          expires_at: row.expires_at ?? null,
        },
      });
    } catch (err) {
      logger.error('PAT creation error', { err });
      respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  // ── GET /me/tokens — list PATs ────────────────────────────────────────────

  router.get('/me/tokens', authRateLimiter, async (req: any, res: any) => {
    try {
      const authUserId = await resolveAuthUserId(req);
      if (!authUserId) {
        return respondWithError(res, 401, 'AUTH_REQUIRED', 'Could not resolve authenticated user');
      }

      const { data: rows, error } = await supabase
        .from('developer_api_keys')
        .select('id, name, key_prefix, created_at, last_used_at, expires_at, is_active')
        .eq('user_id', authUserId)
        .eq('key_type', 'personal')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to list PATs', { error, authUserId });
        return respondWithError(res, 500, 'TOKEN_LIST_ERROR', 'Failed to list tokens');
      }

      res.json({
        ok: true,
        success: true,
        data: (rows ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          prefix: r.key_prefix,
          created_at: r.created_at,
          last_used_at: r.last_used_at ?? null,
          expires_at: r.expires_at ?? null,
          is_active: r.is_active,
        })),
      });
    } catch (err) {
      logger.error('PAT list error', { err });
      respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  // ── DELETE /me/tokens/:id — revoke a PAT ─────────────────────────────────

  router.delete('/me/tokens/:id', authRateLimiter, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        return respondWithError(res, 400, 'VALIDATION_ERROR', 'Invalid token id');
      }

      const authUserId = await resolveAuthUserId(req);
      if (!authUserId) {
        return respondWithError(res, 401, 'AUTH_REQUIRED', 'Could not resolve authenticated user');
      }

      // Verify ownership before mutating
      const { data: existing, error: lookupError } = await supabase
        .from('developer_api_keys')
        .select('id')
        .eq('id', id)
        .eq('user_id', authUserId)
        .eq('key_type', 'personal')
        .maybeSingle();

      if (lookupError) {
        logger.error('PAT revoke lookup error', { error: lookupError, id, authUserId });
        return respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
      }
      if (!existing) {
        return respondWithError(res, 404, 'NOT_FOUND', 'Token not found');
      }

      const { error: updateError } = await supabase
        .from('developer_api_keys')
        .update({ is_active: false })
        .eq('id', id)
        .eq('user_id', authUserId);

      if (updateError) {
        logger.error('Failed to revoke PAT', { error: updateError, id, authUserId });
        return respondWithError(res, 500, 'TOKEN_REVOKE_ERROR', 'Failed to revoke token');
      }

      res.status(204).send();
    } catch (err) {
      logger.error('PAT revoke error', { err });
      respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
    }
  });

  return router;
}
