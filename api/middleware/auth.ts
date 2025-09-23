import type { SupabaseClient } from '@supabase/supabase-js';
import type { Response, NextFunction } from 'express';
import type { Logger } from 'winston';

import type { AuthenticatedRequest, ApiMiddleware } from '../types/middleware/auth';
import { createAuthError, toErrorResponse } from '../types/errors';
import { incrementUsage, runSingle } from '../services/database';

const LEGACY_PERMISSION_MAPPING: Record<string, string[]> = {
  profiles: ['user:read', 'profiles:read', 'profiles:write'],
  groups: ['groups:read', 'groups:write'],
  marketplace: ['marketplace:read'],
  entries: ['entries:read', 'entries:write'],
  templates: ['templates:read', 'templates:write']
};

interface DeveloperApiKeyRecord {
  id: string;
  user_id: string;
  name: string;
  permissions: unknown[];
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export interface AuthMiddlewareOptions {
  supabase: SupabaseClient;
  logger: Logger;
  hashApiKey: (key: string) => Promise<string>;
}

const expandPermissions = (permissions: unknown[]): string[] => {
  if (!Array.isArray(permissions)) {
    return [];
  }

  const expanded = new Set<string>();

  permissions.forEach(permission => {
    const legacy = LEGACY_PERMISSION_MAPPING[String(permission)];

    if (legacy) {
      legacy.forEach(scope => expanded.add(scope));
    } else {
      expanded.add(String(permission));
    }
  });

  return Array.from(expanded);
};

const toApiKeyInfo = (record: DeveloperApiKeyRecord) => ({
  id: record.id,
  userId: record.user_id,
  name: record.name,
  permissions: expandPermissions(record.permissions),
  usageCount: record.usage_count,
  isActive: record.is_active,
  authType: 'api_key' as const
});

const validateApiKey = async (
  supabase: SupabaseClient,
  keyHash: string
) =>
  runSingle(
    supabase
      .from('developer_api_keys')
      .select('id, user_id, name, permissions, usage_count, is_active, created_at')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .maybeSingle()
  );

const handleApiKeyPath = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
  options: AuthMiddlewareOptions,
  token: string
): Promise<void> => {
  try {
    const keyHash = await options.hashApiKey(token);
    const { data, error } = await validateApiKey(options.supabase, keyHash);

    if (error || !data) {
      options.logger.warn('API key validation failed', {
        error: error?.message,
        hasKey: Boolean(data)
      });
      const authError = createAuthError('INVALID_API_KEY', 'Invalid API key');
      res.status(authError.status).json(toErrorResponse(authError));
      return;
    }

    const keyRecord = data as DeveloperApiKeyRecord;

    options.logger.info('API key validation succeeded', {
      keyId: keyRecord.id,
      userId: keyRecord.user_id,
      name: keyRecord.name
    });

    req.apiKey = token;
    req.keyInfo = toApiKeyInfo(keyRecord);

    incrementUsage(options.supabase, keyRecord.id, keyRecord.usage_count).catch(err => {
      options.logger.warn('Failed to update API key usage', {
        keyId: keyRecord.id,
        message: err.message
      });
    });

    next();
  } catch (error) {
    options.logger.error('API key validation error', { error });
    const authError = createAuthError('INVALID_API_KEY', 'Invalid API key');
    res.status(authError.status).json(toErrorResponse(authError));
  }
};

export const createAuthMiddleware = ({ supabase, logger, hashApiKey }: AuthMiddlewareOptions): ApiMiddleware =>
  async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const authError = createAuthError('AUTH_REQUIRED', 'API key required');
      res.status(authError.status).json(toErrorResponse(authError));
      return;
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      const authError = createAuthError('AUTH_REQUIRED', 'API key required');
      res.status(authError.status).json(toErrorResponse(authError));
      return;
    }

    const validPrefixes = ['oriva_pk_live_', 'oriva_pk_test_'];
    const isApiKey = validPrefixes.some(prefix => token.startsWith(prefix));

    if (isApiKey) {
      await handleApiKeyPath(req, res, next, { supabase, logger, hashApiKey }, token);
      return;
    }

    try {
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data?.user) {
        const authError = createAuthError('INVALID_API_KEY', 'Invalid API key');
        res.status(authError.status).json(toErrorResponse(authError));
        return;
      }

      const user = data.user;

      req.apiKey = token;
      req.keyInfo = {
        id: user.id,
        userId: user.id,
        name: user.email || user.user_metadata?.name || 'User',
        permissions: ['read', 'write'],
        usageCount: 0,
        isActive: true,
        authType: 'supabase_auth' as const
      };

      next();
    } catch (error) {
      logger.error('Supabase auth validation error', { error });
      const authError = createAuthError('INVALID_API_KEY', 'Invalid API key');
      res.status(authError.status).json(toErrorResponse(authError));
    }
  };

export const createLegacyApiKeyMiddleware = ({ supabase, logger, hashApiKey }: AuthMiddlewareOptions): ApiMiddleware =>
  async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const authError = createAuthError('AUTH_REQUIRED', 'API key required');
      res.status(authError.status).json(toErrorResponse(authError));
      return;
    }

    const apiKey = authHeader.substring(7);

    if (!apiKey || typeof apiKey !== 'string') {
      const authError = createAuthError('INVALID_API_KEY', 'Invalid API key');
      res.status(authError.status).json(toErrorResponse(authError));
      return;
    }

    const validPrefixes = ['oriva_pk_live_', 'oriva_pk_test_'];
    const hasValidPrefix = validPrefixes.some(prefix => apiKey.startsWith(prefix));

    if (!hasValidPrefix) {
      const authError = createAuthError('INVALID_API_KEY', 'Invalid API key');
      res.status(authError.status).json(toErrorResponse(authError));
      return;
    }

    try {
      const keyHash = await hashApiKey(apiKey);
      const { data, error } = await validateApiKey(supabase, keyHash);

      if (error || !data) {
        const authError = createAuthError('INVALID_API_KEY', 'Invalid API key');
        res.status(authError.status).json(toErrorResponse(authError));
        return;
      }

      const keyRecord = data as DeveloperApiKeyRecord;

      req.apiKey = apiKey;
      req.keyInfo = toApiKeyInfo(keyRecord);

      next();
    } catch (error) {
      logger.error('API key validation error', { error });
      const authError = createAuthError('INVALID_API_KEY', 'Invalid API key');
      res.status(authError.status).json(toErrorResponse(authError));
    }
  };
