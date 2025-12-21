/**
 * SQL Sanitization Utilities
 *
 * SECURITY: Provides robust escaping for dynamic SQL in exec_sql RPC calls.
 * PostgreSQL-specific escaping that handles edge cases beyond simple quote doubling.
 *
 * Note: This is defense-in-depth. The primary defense is:
 * 1. UUID validation at auth middleware (prevents injection via profileId)
 * 2. Input validation before this layer
 *
 * TODO: Long-term, migrate to parameterized RPC functions for complete protection.
 */

import { ValidationError } from '../../../utils/validation-express';

/**
 * Escape a string value for PostgreSQL SQL.
 * Handles: single quotes, backslashes, null bytes, and Unicode.
 *
 * @param value - The string to escape
 * @returns Escaped string safe for SQL interpolation (without surrounding quotes)
 */
export function escapeString(value: string): string {
  if (typeof value !== 'string') {
    throw new Error('escapeString requires a string value');
  }

  return (
    value
      // Remove null bytes (SQL injection vector)
      .replace(/\0/g, '')
      // Escape backslashes first (PostgreSQL standard)
      .replace(/\\/g, '\\\\')
      // Escape single quotes by doubling
      .replace(/'/g, "''")
  );
}

/**
 * Quote a value for PostgreSQL SQL, returning a safe SQL literal.
 * Handles multiple types with appropriate escaping.
 *
 * @param value - Any value to convert to SQL literal
 * @returns SQL-safe literal string including quotes where appropriate
 */
export function sqlQuote(value: unknown): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 'NULL';
  }

  // Handle strings
  if (typeof value === 'string') {
    return `'${escapeString(value)}'`;
  }

  // Handle numbers (validate to prevent NaN/Infinity injection)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Cannot quote non-finite number');
    }
    return String(value);
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  // Handle objects (convert to JSONB)
  if (typeof value === 'object') {
    const jsonStr = JSON.stringify(value);
    return `'${escapeString(jsonStr)}'::JSONB`;
  }

  // Fallback for other types
  return `'${escapeString(String(value))}'`;
}

/**
 * Quote a value as PostgreSQL JSONB.
 *
 * @param value - Object or array to convert to JSONB literal
 * @returns SQL JSONB literal
 */
export function sqlQuoteJsonb(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  const jsonStr = JSON.stringify(value);
  return `'${escapeString(jsonStr)}'::JSONB`;
}

/**
 * Quote an array as PostgreSQL TEXT[].
 *
 * @param values - Array of strings to convert to TEXT[] literal
 * @returns SQL TEXT[] literal
 */
export function sqlQuoteTextArray(values: unknown): string {
  if (values === null || values === undefined || !Array.isArray(values) || values.length === 0) {
    return "'{}'::TEXT[]";
  }

  const escaped = values.map((v) => `'${escapeString(String(v))}'`).join(',');
  return `ARRAY[${escaped}]::TEXT[]`;
}

/**
 * Validate and escape a UUID for SQL.
 * UUIDs only contain hex chars and dashes - validates format first.
 *
 * @param value - The UUID string to validate and escape
 * @param fieldName - Field name for error messages
 * @returns Escaped UUID string (without quotes)
 * @throws ValidationError if not a valid UUID format
 */
export function validateAndEscapeUuid(value: string, fieldName: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    throw new ValidationError(`Invalid ${fieldName} format`, { field: fieldName });
  }

  // UUIDs only contain safe chars, but escape anyway for defense-in-depth
  return escapeString(value);
}

/**
 * Create a parameterized-style SQL query builder.
 * Provides a safer pattern for building dynamic SQL.
 *
 * @example
 * const query = sqlBuilder()
 *   .append('SELECT * FROM users WHERE id = ')
 *   .appendValue(userId)
 *   .append(' AND status = ')
 *   .appendValue('active')
 *   .build();
 */
export function sqlBuilder() {
  const parts: string[] = [];

  return {
    append(sql: string) {
      parts.push(sql);
      return this;
    },
    appendValue(value: unknown) {
      parts.push(sqlQuote(value));
      return this;
    },
    appendUuid(value: string, fieldName: string) {
      parts.push(`'${validateAndEscapeUuid(value, fieldName)}'`);
      return this;
    },
    build() {
      return parts.join('');
    },
  };
}
