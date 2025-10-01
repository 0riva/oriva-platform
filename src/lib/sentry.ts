// Task: T074 - Sentry error tracking configuration
// Description: Error monitoring and reporting with Sentry
// @ts-nocheck - TODO: Update to new Sentry SDK API (v8+)

import * as Sentry from '@sentry/node';
import { httpIntegration, captureConsoleIntegration } from '@sentry/node';
import { VercelRequest } from '@vercel/node';

// Environment configuration
const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.VERCEL_ENV || 'development';
const SENTRY_RELEASE = process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';

// Initialize Sentry
let sentryInitialized = false;

export function initSentry(): void {
  if (sentryInitialized) {
    return;
  }

  if (!SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,

    // Performance monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Error filtering
    beforeSend(event, hint) {
      // Don't send errors in development
      if (SENTRY_ENVIRONMENT === 'development') {
        return null;
      }

      // Filter out known non-critical errors
      const error = hint.originalException;
      if (error && typeof error === 'object') {
        const errorMessage = (error as Error).message || '';

        // Ignore rate limit errors (these are expected)
        if (errorMessage.includes('RATE_LIMIT_EXCEEDED')) {
          return null;
        }

        // Ignore validation errors (client-side issues)
        if (errorMessage.includes('VALIDATION_ERROR')) {
          return null;
        }
      }

      return event;
    },

    // Breadcrumb filtering
    beforeBreadcrumb(breadcrumb) {
      // Don't log health check requests
      if (breadcrumb.category === 'http' && breadcrumb.data?.url?.includes('/health')) {
        return null;
      }

      return breadcrumb;
    },

    // Integration configuration
    integrations: [
      httpIntegration({ tracing: true }),
      captureConsoleIntegration({ levels: ['error', 'warn'] }),
    ],
  });

  sentryInitialized = true;
  console.log(`Sentry initialized: ${SENTRY_ENVIRONMENT} (${SENTRY_RELEASE})`);
}

/**
 * Capture exception with context
 */
export function captureException(
  error: Error,
  context?: {
    userId?: string;
    endpoint?: string;
    metadata?: Record<string, unknown>;
  }
): string | undefined {
  if (!sentryInitialized) {
    initSentry();
  }

  if (!SENTRY_DSN) {
    console.error('Sentry not configured, error not captured:', error);
    return undefined;
  }

  // Set user context
  if (context?.userId) {
    Sentry.setUser({ id: context.userId });
  }

  // Set tags
  if (context?.endpoint) {
    Sentry.setTag('endpoint', context.endpoint);
  }

  // Set additional context
  if (context?.metadata) {
    Sentry.setContext('metadata', context.metadata);
  }

  // Capture exception
  const eventId = Sentry.captureException(error);

  // Clear context after capture
  Sentry.setUser(null);

  return eventId;
}

/**
 * Capture message with severity level
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    userId?: string;
    endpoint?: string;
    metadata?: Record<string, unknown>;
  }
): string | undefined {
  if (!sentryInitialized) {
    initSentry();
  }

  if (!SENTRY_DSN) {
    console.log(`Sentry not configured, message not captured: ${message}`);
    return undefined;
  }

  // Set context
  if (context?.userId) {
    Sentry.setUser({ id: context.userId });
  }

  if (context?.endpoint) {
    Sentry.setTag('endpoint', context.endpoint);
  }

  if (context?.metadata) {
    Sentry.setContext('metadata', context.metadata);
  }

  // Capture message
  const eventId = Sentry.captureMessage(message, level);

  // Clear context
  Sentry.setUser(null);

  return eventId;
}

/**
 * Start a transaction for performance monitoring
 */
export function startTransaction(
  name: string,
  operation: string,
  metadata?: Record<string, unknown>
): Sentry.Transaction | null {
  if (!sentryInitialized || !SENTRY_DSN) {
    return null;
  }

  const transaction = Sentry.startTransaction({
    name,
    op: operation,
    data: metadata,
  });

  return transaction;
}

/**
 * Wrap a function with Sentry transaction tracking
 */
export async function withTransaction<T>(
  name: string,
  operation: string,
  fn: (transaction: Sentry.Transaction | null) => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const transaction = startTransaction(name, operation, metadata);

  try {
    const result = await fn(transaction);
    transaction?.setStatus('ok');
    return result;
  } catch (error) {
    transaction?.setStatus('internal_error');
    throw error;
  } finally {
    transaction?.finish();
  }
}

/**
 * Extract request context for Sentry
 */
export function extractRequestContext(req: VercelRequest): {
  userId?: string;
  endpoint: string;
  metadata: Record<string, unknown>;
} {
  const authContext = (req as any).authContext;

  return {
    userId: authContext?.userId,
    endpoint: req.url || 'unknown',
    metadata: {
      method: req.method,
      headers: {
        'user-agent': req.headers['user-agent'],
        'x-app-id': req.headers['x-app-id'],
      },
      query: req.query,
    },
  };
}

/**
 * Sentry middleware for Vercel functions
 */
export function withSentry<T extends (...args: any[]) => Promise<any>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    if (!sentryInitialized) {
      initSentry();
    }

    const [req] = args;
    const context = extractRequestContext(req);

    try {
      return await withTransaction(
        context.endpoint,
        'http.server',
        () => handler(...args),
        context.metadata
      );
    } catch (error) {
      if (error instanceof Error) {
        captureException(error, context);
      }
      throw error;
    }
  }) as T;
}

// Auto-initialize Sentry
if (typeof process !== 'undefined' && process.env.SENTRY_DSN) {
  initSentry();
}