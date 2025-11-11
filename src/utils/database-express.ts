/**
 * Database Client Utilities
 * Task: T024
 *
 * Schema-aware database client helpers for multi-tenant queries.
 * Wraps Supabase client with schema routing and error handling.
 */

import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Request } from 'express';
import { getSupabase, getAppContext } from '../express/middleware/schemaRouter';

/**
 * Database error class
 */
export class DatabaseError extends Error {
  public readonly code: string;
  public readonly details?: PostgrestError;

  constructor(message: string, code: string, details?: PostgrestError) {
    super(message);
    this.name = 'DatabaseError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Handle Supabase errors and convert to DatabaseError
 */
export const handleDatabaseError = (error: PostgrestError, operation: string): never => {
  console.error(`Database error during ${operation}:`, error);

  // Map PostgreSQL error codes to user-friendly messages
  switch (error.code) {
    case '23505': // Unique violation
      throw new DatabaseError(
        'A record with this identifier already exists',
        'DUPLICATE_RECORD',
        error
      );

    case '23503': // Foreign key violation
      throw new DatabaseError('Referenced record does not exist', 'FOREIGN_KEY_VIOLATION', error);

    case '23502': // Not null violation
      throw new DatabaseError('Required field is missing', 'MISSING_REQUIRED_FIELD', error);

    case 'PGRST116': // No rows returned
      throw new DatabaseError('Record not found', 'NOT_FOUND', error);

    case '42P01': // Undefined table
      throw new DatabaseError('Schema or table not found', 'SCHEMA_ERROR', error);

    default:
      throw new DatabaseError(
        error.message || 'Database operation failed',
        'DATABASE_ERROR',
        error
      );
  }
};

/**
 * Query builder for app-specific schema
 */
export class SchemaQueryBuilder {
  private supabase: SupabaseClient;
  private schemaName: string;

  constructor(req: Request) {
    this.supabase = getSupabase(req);
    this.schemaName = getAppContext(req).schemaName;
  }

  /**
   * Determine schema for a given table name
   */
  private getSchemaForTable(tableName: string): string {
    // Hugo AI tables always use hugo_ai schema
    if (['sessions', 'insights'].includes(tableName)) {
      return 'hugo_ai';
    }

    // Platform tables always use oriva_platform schema
    if (['users', 'apps', 'user_app_access', 'extraction_manifests'].includes(tableName)) {
      return 'oriva_platform';
    }

    // App-specific tables use current schema
    return this.schemaName;
  }

  /**
   * Select query with schema routing
   */
  public from(tableName: string): ReturnType<SupabaseClient['from']> {
    const schema = this.getSchemaForTable(tableName);
    return this.supabase.schema(schema).from(tableName);
  }

  /**
   * RPC call
   */
  public async rpc<T>(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<{ data: T | null; error: PostgrestError | null }> {
    return this.supabase.rpc(functionName, params);
  }

  /**
   * Get Supabase client (for advanced usage)
   */
  public getClient(): SupabaseClient {
    return this.supabase;
  }
}

/**
 * Create schema-aware query builder from request
 */
export const createQueryBuilder = (req: Request): SchemaQueryBuilder => {
  return new SchemaQueryBuilder(req);
};

/**
 * Execute database operation with error handling
 */
export async function executeQuery<T>(
  operation: () =>
    | Promise<{ data: T | null; error: PostgrestError | null }>
    | PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  operationName: string
): Promise<T> {
  const { data, error } = await operation();

  if (error) {
    handleDatabaseError(error, operationName);
  }

  if (!data) {
    throw new DatabaseError('No data returned', 'NO_DATA', undefined);
  }

  return data;
}

/**
 * Execute database operation that may return null (e.g., optional selects)
 */
export async function executeQueryOptional<T>(
  operation: () =>
    | Promise<{ data: T | null; error: PostgrestError | null }>
    | PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  operationName: string
): Promise<T | null> {
  const { data, error } = await operation();

  if (error) {
    handleDatabaseError(error, operationName);
  }

  return data;
}

/**
 * Calculate duration in seconds from start and end timestamps
 */
export const calculateDuration = (startedAt: string, endedAt: string | null): number | null => {
  if (!endedAt) {
    return null;
  }

  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const durationMs = end.getTime() - start.getTime();

  return Math.floor(durationMs / 1000);
};

/**
 * Generate 7-day expiration timestamp
 */
export const generateExpirationDate = (daysFromNow = 7): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

/**
 * Check if timestamp is expired
 */
export const isExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt) < new Date();
};

/**
 * Transaction helper (for RLS-compatible transactions)
 */
export interface TransactionContext {
  supabase: SupabaseClient;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

/**
 * Execute operations in a transaction-like pattern
 * Note: Supabase RLS doesn't support true transactions, so this is a best-effort pattern
 */
export async function withTransaction<T>(
  req: Request,
  callback: (ctx: TransactionContext) => Promise<T>
): Promise<T> {
  const supabase = getSupabase(req);
  const operations: Array<() => Promise<void>> = [];

  const ctx: TransactionContext = {
    supabase,
    commit: async (): Promise<void> => {
      // Execute all queued operations
      for (const op of operations) {
        await op();
      }
    },
    rollback: async (): Promise<void> => {
      // Best effort rollback (log for manual intervention if needed)
      console.warn('Transaction rollback requested - manual cleanup may be required');
    },
  };

  try {
    const result = await callback(ctx);
    await ctx.commit();
    return result;
  } catch (error) {
    await ctx.rollback();
    throw error;
  }
}

/**
 * Build JSONB query conditions
 */
export const buildJsonbFilter = (field: string, key: string, value: unknown): string => {
  return `${field}->>'${key}'.eq.${value}`;
};

/**
 * Sanitize user input for database queries
 */
export const sanitizeInput = (input: string): string => {
  // Remove potentially dangerous characters
  return input.replace(/[';-]/g, '');
};
