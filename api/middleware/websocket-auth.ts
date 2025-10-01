// Task: T036 - WebSocket authentication middleware
// Description: Validate WebSocket connections against app credentials

import { getSupabaseClient } from '../config/supabase';
import { logger } from '../utils/logger';

export interface WebSocketAuthResult {
  authenticated: boolean;
  appId?: string;
  userId?: string;
  error?: string;
}

/**
 * Authenticate WebSocket connection
 * - Validates token from query parameter
 * - Checks token against hugo_apps table
 * - Verifies is_active = true
 * - Returns user/app context or rejects connection
 */
export async function authenticateWebSocket(
  appId: string,
  userId: string,
  authToken: string
): Promise<WebSocketAuthResult> {
  try {
    if (!appId || !userId || !authToken) {
      logger.warn('WebSocket authentication missing required parameters', {
        hasAppId: !!appId,
        hasUserId: !!userId,
        hasToken: !!authToken,
      });
      return {
        authenticated: false,
        error: 'Missing required authentication parameters',
      };
    }

    const supabase = getSupabaseClient();

    // Verify app exists and is active
    const { data: app, error: appError } = await supabase
      .from('hugo_apps')
      .select('app_id, is_active, api_key')
      .eq('app_id', appId)
      .eq('is_active', true)
      .single();

    if (appError || !app) {
      logger.warn('WebSocket authentication failed: app not found or inactive', {
        app_id: appId,
        error: appError?.message,
      });
      return {
        authenticated: false,
        error: 'Invalid app',
      };
    }

    // Verify API key matches
    // Note: In production, use more secure token validation
    if (app.api_key !== authToken) {
      logger.warn('WebSocket authentication failed: invalid token', {
        app_id: appId,
      });
      return {
        authenticated: false,
        error: 'Invalid authentication token',
      };
    }

    // Verify user exists
    const { data: userExists, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !userExists) {
      logger.warn('WebSocket authentication failed: user not found', {
        user_id: userId,
        error: userError?.message,
      });
      return {
        authenticated: false,
        error: 'Invalid user',
      };
    }

    logger.info('WebSocket authentication successful', {
      app_id: appId,
      user_id: userId,
    });

    return {
      authenticated: true,
      appId,
      userId,
    };
  } catch (error) {
    logger.error('WebSocket authentication error', {
      error: error instanceof Error ? error.message : String(error),
      app_id: appId,
      user_id: userId,
    });

    return {
      authenticated: false,
      error: 'Authentication error',
    };
  }
}
