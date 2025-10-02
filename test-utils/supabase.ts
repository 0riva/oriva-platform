/**
 * Mock Supabase Client
 *
 * Utilities for mocking Supabase database operations in tests.
 */

import { PostgrestError } from '@supabase/supabase-js';

/**
 * Mock Supabase response
 */
export interface MockSupabaseResponse<T> {
  data: T | null;
  error: PostgrestError | null;
}

/**
 * Create successful Supabase response
 */
export const mockSupabaseSuccess = <T>(data: T): MockSupabaseResponse<T> => ({
  data,
  error: null,
});

/**
 * Create error Supabase response
 */
export const mockSupabaseError = <T>(
  message: string,
  code: string = 'DATABASE_ERROR'
): MockSupabaseResponse<T> => ({
  data: null,
  error: {
    message,
    code,
    details: '',
    hint: '',
  } as PostgrestError,
});

/**
 * Mock test data for database entities
 */
export const mockTestData = {
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test@example.com',
    full_name: 'Test User',
    created_at: new Date().toISOString(),
  },
  app: {
    id: '00000000-0000-0000-0000-000000000011',
    app_id: 'hugo_love',
    name: 'Hugo Love',
    description: 'Dating coaching app',
    schema_name: 'hugo_love',
    status: 'active' as const,
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  session: {
    id: '00000000-0000-0000-0000-000000000021',
    user_id: '00000000-0000-0000-0000-000000000001',
    app_id: '00000000-0000-0000-0000-000000000011',
    session_type: 'coaching' as const,
    started_at: new Date().toISOString(),
    message_count: 0,
    context_data: {},
    insights_generated: [],
    created_at: new Date().toISOString(),
  },
  insight: {
    id: '00000000-0000-0000-0000-000000000031',
    session_id: '00000000-0000-0000-0000-000000000021',
    user_id: '00000000-0000-0000-0000-000000000001',
    source_app_id: '00000000-0000-0000-0000-000000000011',
    insight_type: 'pattern' as const,
    content: 'User shows consistent improvement in conversation confidence',
    confidence: 0.85,
    cross_app_visibility: true,
    supporting_data: {},
    metadata: {},
    created_at: new Date().toISOString(),
  },
  profile: {
    id: '00000000-0000-0000-0000-000000000041',
    user_id: '00000000-0000-0000-0000-000000000001',
    profile_data: {
      age: 28,
      location: 'San Francisco',
      interests: ['hiking', 'photography'],
    },
    preferences: {
      coaching_style: 'direct',
      session_frequency: 'weekly',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  iceBreaker: {
    id: '00000000-0000-0000-0000-000000000051',
    user_id: '00000000-0000-0000-0000-000000000001',
    text: 'I noticed you like hiking! What\'s your favorite trail?',
    category: 'shared_interest' as const,
    style: 'casual' as const,
    context_tags: ['outdoors', 'hiking'],
    usage_count: 0,
    metadata: {},
    created_at: new Date().toISOString(),
  },
};

/**
 * Mock Supabase client builder
 */
export class MockSupabaseQueryBuilder {
  private mockData: any;
  private mockError: PostgrestError | null = null;

  constructor(data?: any, error?: PostgrestError | null) {
    this.mockData = data;
    this.mockError = error || null;
  }

  select(columns?: string) {
    return this;
  }

  insert(data: any) {
    this.mockData = data;
    return this;
  }

  update(data: any) {
    this.mockData = { ...this.mockData, ...data };
    return this;
  }

  delete() {
    this.mockData = null;
    return this;
  }

  eq(column: string, value: any) {
    return this;
  }

  neq(column: string, value: any) {
    return this;
  }

  gt(column: string, value: any) {
    return this;
  }

  gte(column: string, value: any) {
    return this;
  }

  lt(column: string, value: any) {
    return this;
  }

  lte(column: string, value: any) {
    return this;
  }

  in(column: string, values: any[]) {
    return this;
  }

  or(query: string) {
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    return this;
  }

  limit(count: number) {
    return this;
  }

  range(from: number, to: number) {
    return this;
  }

  single() {
    return Promise.resolve({
      data: this.mockData,
      error: this.mockError,
    });
  }

  maybeSingle() {
    return Promise.resolve({
      data: this.mockData,
      error: this.mockError,
    });
  }

  then(resolve: any) {
    return resolve({
      data: this.mockData,
      error: this.mockError,
    });
  }
}

/**
 * Create mock Supabase client
 */
export const mockSupabase = (mockData?: any, mockError?: PostgrestError | null) => {
  return {
    from: (table: string) => new MockSupabaseQueryBuilder(mockData, mockError),
    rpc: (fn: string, params?: any) =>
      Promise.resolve({
        data: mockData,
        error: mockError,
      }),
    auth: {
      getUser: (token: string) =>
        Promise.resolve({
          data: { user: mockTestData.user },
          error: mockError,
        }),
    },
  };
};

/**
 * Mock database errors
 */
export const mockDatabaseErrors = {
  notFound: {
    message: 'Record not found',
    code: 'PGRST116',
    details: '',
    hint: '',
  } as PostgrestError,
  duplicate: {
    message: 'Duplicate record',
    code: '23505',
    details: '',
    hint: '',
  } as PostgrestError,
  foreignKey: {
    message: 'Foreign key violation',
    code: '23503',
    details: '',
    hint: '',
  } as PostgrestError,
  notNull: {
    message: 'Not null violation',
    code: '23502',
    details: '',
    hint: '',
  } as PostgrestError,
};
