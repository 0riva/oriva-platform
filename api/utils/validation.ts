/**
 * Validation Utilities
 * Task: T023
 *
 * Request validation helpers for multi-tenant API endpoints.
 * Validates UUIDs, enums, confidence scores, and common patterns.
 */

import { Request, Response, NextFunction } from 'express';

/**
 * UUID validation regex (RFC 4122)
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
export const isValidUuid = (value: string): boolean => {
  return UUID_REGEX.test(value);
};

/**
 * Validate and return UUID or throw error
 */
export const validateUuid = (value: string, fieldName: string): string => {
  if (!isValidUuid(value)) {
    throw new ValidationError(`Invalid ${fieldName} format. Must be a valid UUID.`, {
      field: fieldName,
      value,
    });
  }
  return value;
};

/**
 * Validate enum value
 */
export const validateEnum = <T extends string>(
  value: T,
  allowedValues: readonly T[],
  fieldName: string
): T => {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`,
      {
        field: fieldName,
        value,
        allowedValues,
      }
    );
  }
  return value;
};

/**
 * Validate confidence score (0-1 range)
 */
export const validateConfidence = (value: number, fieldName = 'confidence'): number => {
  if (typeof value !== 'number' || value < 0 || value > 1) {
    throw new ValidationError(`${fieldName} must be a number between 0 and 1`, {
      field: fieldName,
      value,
    });
  }
  return value;
};

/**
 * Validate quality score (0-100 range)
 */
export const validateQualityScore = (value: number, fieldName = 'quality_score'): number => {
  if (typeof value !== 'number' || value < 0 || value > 100) {
    throw new ValidationError(`${fieldName} must be a number between 0 and 100`, {
      field: fieldName,
      value,
    });
  }
  return value;
};

/**
 * Validate required field
 */
export const validateRequired = <T>(value: T | undefined | null, fieldName: string): T => {
  if (value === undefined || value === null) {
    throw new ValidationError(`${fieldName} is required`, {
      field: fieldName,
    });
  }
  return value;
};

/**
 * Validate email format
 */
export const validateEmail = (value: string, fieldName = 'email'): string => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    throw new ValidationError(`Invalid ${fieldName} format`, {
      field: fieldName,
      value,
    });
  }
  return value;
};

/**
 * Validate PostgreSQL schema name format
 * Must be lowercase alphanumeric with underscores, no spaces
 */
export const validateSchemaName = (value: string, fieldName = 'schema_name'): string => {
  const schemaRegex = /^[a-z][a-z0-9_]*$/;
  if (!schemaRegex.test(value)) {
    throw new ValidationError(
      `Invalid ${fieldName}. Must be lowercase alphanumeric with underscores, starting with a letter.`,
      {
        field: fieldName,
        value,
      }
    );
  }
  return value;
};

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR';
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Middleware to validate request body schema
 */
export const validateBody =
  <T extends Record<string, unknown>>(
    validator: (body: unknown) => T
  ): ((req: Request, res: Response, next: NextFunction) => void) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = validator(req.body);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          code: error.code,
          message: error.message,
          details: error.details,
        });
      } else {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Validation failed',
        });
      }
    }
  };

/**
 * Session type enum
 */
export const SESSION_TYPES = ['chat', 'analysis', 'coaching', 'practice'] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

/**
 * Insight type enum
 */
export const INSIGHT_TYPES = ['pattern', 'recommendation', 'goal_progress'] as const;
export type InsightType = (typeof INSIGHT_TYPES)[number];

/**
 * App status enum
 */
export const APP_STATUSES = ['active', 'inactive', 'extracting'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

/**
 * Ice breaker category enum
 */
export const ICE_BREAKER_CATEGORIES = [
  'humor',
  'observation',
  'question',
  'compliment',
  'shared_interest',
] as const;
export type IceBreakerCategory = (typeof ICE_BREAKER_CATEGORIES)[number];

/**
 * Ice breaker style enum
 */
export const ICE_BREAKER_STYLES = ['casual', 'playful', 'sincere', 'witty'] as const;
export type IceBreakerStyle = (typeof ICE_BREAKER_STYLES)[number];

/**
 * User role enum
 */
export const USER_ROLES = ['user', 'admin', 'owner'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * User app status enum
 */
export const USER_APP_STATUSES = ['active', 'suspended', 'deleted'] as const;
export type UserAppStatus = (typeof USER_APP_STATUSES)[number];

/**
 * Extraction target format enum
 */
export const EXTRACTION_FORMATS = ['json', 'csv'] as const;
export type ExtractionFormat = (typeof EXTRACTION_FORMATS)[number];

/**
 * Extraction status enum
 */
export const EXTRACTION_STATUSES = ['prepared', 'executing', 'completed', 'failed'] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

/**
 * Ice breaker category enum
 */
export const ICE_BREAKER_CATEGORIES = [
  'shared_interest',
  'photo_comment',
  'conversation_starter',
] as const;
export type IceBreakerCategory = (typeof ICE_BREAKER_CATEGORIES)[number];

/**
 * Validate session type
 */
export const validateSessionType = (value: string): SessionType => {
  return validateEnum(value as SessionType, SESSION_TYPES, 'session_type');
};

/**
 * Validate insight type
 */
export const validateInsightType = (value: string): InsightType => {
  return validateEnum(value as InsightType, INSIGHT_TYPES, 'insight_type');
};

/**
 * Validate app status
 */
export const validateAppStatus = (value: string): AppStatus => {
  return validateEnum(value as AppStatus, APP_STATUSES, 'status');
};

/**
 * Validate extraction format
 */
export const validateExtractionFormat = (value: string): ExtractionFormat => {
  return validateEnum(value as ExtractionFormat, EXTRACTION_FORMATS, 'target_format');
};

/**
 * Apply 0.7 confidence threshold for cross-app visibility
 */
export const calculateCrossAppVisibility = (confidence: number): boolean => {
  return confidence >= 0.7;
};

/**
 * Validate pagination parameters
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

export const validatePagination = (query: {
  limit?: string;
  offset?: string;
}): PaginationParams => {
  const limit = query.limit ? parseInt(query.limit, 10) : 50;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('limit must be between 1 and 100', {
      field: 'limit',
      value: query.limit,
    });
  }

  if (isNaN(offset) || offset < 0) {
    throw new ValidationError('offset must be a non-negative integer', {
      field: 'offset',
      value: query.offset,
    });
  }

  return { limit, offset };
};
