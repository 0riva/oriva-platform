/**
 * Mock Supabase client for testing
 * Provides controlled responses for database operations in unit tests
 */

export interface MockSupabaseClient {
  from: jest.Mock;
}

/**
 * Creates a mock Supabase client for testing
 * Returns a jest.fn() that can be configured per test
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  return {
    from: jest.fn(),
  };
}

/**
 * Helper to create a mock Supabase response
 */
export function mockSupabaseResponse<T>(data: T | null, error: any = null) {
  return {
    data,
    error,
  };
}
