/**
 * Test Data Cleanup Utilities for Contract Tests
 *
 * Provides cleanup strategies for POST/PATCH/DELETE tests
 * to prevent test data pollution in the database.
 *
 * Note: Supabase doesn't easily support transaction rollback in tests,
 * so we use manual cleanup with service role key to bypass RLS.
 */

import { createTestDatabase } from './database';

/**
 * Track created IDs for cleanup
 */
const createdIds = new Map<string, Set<string>>();

/**
 * Register an ID for cleanup after test
 */
export const registerForCleanup = (schema: string, table: string, id: string): void => {
  const key = `${schema}.${table}`;
  if (!createdIds.has(key)) {
    createdIds.set(key, new Set());
  }
  createdIds.get(key)!.add(id);
};

/**
 * Clean up all registered test data
 * Call this in afterEach()
 */
export const cleanupRegisteredData = async (): Promise<void> => {
  const db = createTestDatabase();

  for (const [key, ids] of createdIds.entries()) {
    const [schema, table] = key.split('.');

    try {
      if (ids.size > 0) {
        await db.schema(schema).from(table).delete().in('id', Array.from(ids));
      }
    } catch (error) {
      console.warn(`Failed to cleanup ${key}:`, error);
    }
  }

  // Clear registry
  createdIds.clear();
};

/**
 * Manual cleanup utility for tests that can't use transactions
 * Use this for tests that need to verify data persistence across requests
 *
 * @example
 * afterEach(async () => {
 *   await cleanupTestData('hugo_love', 'profiles',
 *     { column: 'user_id', value: testUserId });
 * });
 */
export const cleanupTestData = async (
  schema: string,
  table: string,
  whereClause: { column: string; value: any }
): Promise<void> => {
  const db = createTestDatabase();

  try {
    // Use service role key to bypass RLS
    await db.schema(schema).from(table).delete().eq(whereClause.column, whereClause.value);
  } catch (error) {
    console.warn(`Failed to cleanup ${schema}.${table}:`, error);
  }
};

/**
 * Cleanup multiple test records by ID prefix
 * Useful for batch cleanup of test data
 *
 * @example
 * afterAll(async () => {
 *   await cleanupByPrefix('hugo_love', 'profiles', 'test-');
 * });
 */
export const cleanupByPrefix = async (
  schema: string,
  table: string,
  idPrefix: string
): Promise<void> => {
  const db = createTestDatabase();

  try {
    // Use service role key to bypass RLS
    const { data, error } = await db
      .schema(schema)
      .from(table)
      .select('id')
      .like('id', `${idPrefix}%`);

    if (error) throw error;

    if (data && data.length > 0) {
      const ids = data.map((row) => row.id);
      await db.schema(schema).from(table).delete().in('id', ids);
    }
  } catch (error) {
    console.warn(`Failed to cleanup ${schema}.${table} by prefix:`, error);
  }
};
