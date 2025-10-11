/**
 * Real Database Test Utilities
 *
 * IMPORTANT: Contract and integration tests MUST use real database.
 * See TESTING.md for guidelines.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Create real Supabase client for tests
 */
export const createTestDatabase = (): SupabaseClient => {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-local-service-role-key';

  return createClient(supabaseUrl, supabaseServiceKey);
};

/**
 * Seed data helpers
 */
export const testSeedData = {
  users: {
    alice: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'alice@test.com',
      full_name: 'Alice Test',
    },
    bob: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'bob@test.com',
      full_name: 'Bob Test',
    },
    admin: {
      id: '00000000-0000-0000-0000-000000000099',
      email: 'admin@test.com',
      full_name: 'Admin Test',
    },
  },
  apps: {
    hugoLove: {
      id: '00000000-0000-0000-0000-000000000011',
      app_id: 'hugo_love',
      name: 'Hugo Love',
      schema_name: 'hugo_love',
      status: 'active' as const,
    },
    hugoCareer: {
      id: '00000000-0000-0000-0000-000000000012',
      app_id: 'hugo_career',
      name: 'Hugo Career',
      schema_name: 'hugo_career',
      status: 'active' as const,
    },
  },
};

/**
 * Verify database is ready for tests
 */
export const verifyTestDatabase = async (db: SupabaseClient): Promise<boolean> => {
  try {
    // Check if users table exists and has seed data
    const { data, error } = await db
      .schema('oriva_platform')
      .from('users')
      .select('id')
      .eq('id', testSeedData.users.alice.id)
      .single();

    if (error || !data) {
      console.warn('⚠️  Test database not seeded. Run seed script first.');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

/**
 * Clean up test data (use for POST/PATCH/DELETE tests)
 */
export const cleanupTestData = async (
  db: SupabaseClient,
  schema: string,
  table: string,
  whereClause: { column: string; value: any }
): Promise<void> => {
  try {
    await db.schema(schema).from(table).delete().eq(whereClause.column, whereClause.value);
  } catch (error) {
    console.warn(`Failed to cleanup ${schema}.${table}:`, error);
  }
};
