/**
 * Manifest Validation Middleware
 * Task: T088
 *
 * Validates incoming API requests against app manifests.
 * Ensures apps only access declared endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { getAppContext } from './schemaRouter';

/**
 * Convert URL path pattern to regex for matching
 * Converts /api/v1/app/path/:id to regex pattern
 */
const patternToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const withParams = escaped.replace(/:(\w+)/g, '[a-f0-9\\-]+');
  return new RegExp(`^${withParams}$`);
};

/**
 * Check if a URL matches any declared endpoint patterns
 */
const matchesEndpoint = (url: string, patterns: string[]): boolean => {
  // Extract path from URL (remove query params)
  const path = url.split('?')[0];

  return patterns.some((pattern) => {
    // Exact match
    if (pattern === path) return true;

    // Pattern match with parameters
    const regex = patternToRegex(pattern);
    return regex.test(path);
  });
};

/**
 * Manifest validation middleware
 * Validates that the request endpoint is declared in the app manifest
 */
export const manifestValidator = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip validation for platform endpoints
    const appContext = getAppContext(req);
    if (appContext.appId === 'platform') {
      next();
      return;
    }

    // Get method and path
    const method = req.method.toUpperCase();
    const path = req.path;

    // Skip non-API routes
    if (!path.startsWith('/api/')) {
      next();
      return;
    }

    // Check if endpoint is declared in manifest
    // For now, skip validation as manifest loading requires database access
    // TODO: Load manifest from app registration in oriva_platform.apps
    const manifest = (req as any).manifest;
    if (!manifest || !manifest.declaredApis) {
      res.status(403).json({
        code: 'MANIFEST_VALIDATION_FAILED',
        message: 'App manifest not found or incomplete',
      });
      return;
    }

    const declaredEndpoints = manifest.declaredApis[method] || [];
    if (!Array.isArray(declaredEndpoints)) {
      res.status(403).json({
        code: 'MANIFEST_VALIDATION_FAILED',
        message: `No ${method} endpoints declared in manifest`,
      });
      return;
    }

    // Validate endpoint matches declared APIs
    const isAllowed = matchesEndpoint(path, declaredEndpoints);
    if (!isAllowed) {
      res.status(403).json({
        code: 'ENDPOINT_NOT_DECLARED',
        message: `Endpoint ${method} ${path} is not declared in app manifest`,
        details: {
          method,
          path,
          declaredEndpoints,
        },
      });
      return;
    }

    // Continue to next middleware
    next();
  } catch (error) {
    console.error('Manifest validation error:', error);
    res.status(500).json({
      code: 'VALIDATION_ERROR',
      message: 'Manifest validation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Extend Express Request type to include manifest
 */
declare global {
  namespace Express {
    interface Request {
      manifest?: {
        appId: string;
        declaredApis: Record<string, string[]>;
        permissions?: Record<string, any>;
      };
    }
  }
}
