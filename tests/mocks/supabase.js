/**
 * Mock Supabase client for testing
 * Provides controlled responses for API key validation and other database operations
 */

const mockSupabaseResponse = (data, error = null) => ({
  data,
  error
});

// Mock API key data
const mockApiKeys = {
  'test_valid_api_key': {
    id: 'key_123',
    user_id: 'user_123',
    name: 'Test Extension',
    permissions: ['user:read', 'entries:read', 'templates:read'],
    usage_count: 42,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  'test_invalid_api_key': null, // This key doesn't exist
  'test_expired_api_key': {
    id: 'key_456',
    user_id: 'user_456',
    name: 'Expired Extension',
    permissions: ['user:read'],
    usage_count: 0,
    is_active: false, // Expired/inactive
    created_at: '2024-01-01T00:00:00Z'
  }
};

// Mock user data
const mockUsers = {
  'user_123': {
    id: 'user_123',
    username: 'testuser',
    display_name: 'Test User',
    email: 'test@example.com',
    bio: 'Test user bio',
    location: 'Test Location',
    website: 'https://example.com'
  }
};

// Mock Supabase client
const mockSupabase = {
  from: jest.fn((table) => ({
    select: jest.fn(() => ({
      eq: jest.fn((column, value) => ({
        single: jest.fn(() => {
          // Mock API key lookup
          if (table === 'developer_api_keys') {
            const apiKey = mockApiKeys[value];
            if (apiKey) {
              return Promise.resolve(mockSupabaseResponse(apiKey));
            } else {
              return Promise.resolve(mockSupabaseResponse(null, { message: 'No rows found' }));
            }
          }
          
          // Mock user lookup
          if (table === 'users') {
            const user = mockUsers[value];
            if (user) {
              return Promise.resolve(mockSupabaseResponse(user));
            } else {
              return Promise.resolve(mockSupabaseResponse(null, { message: 'No rows found' }));
            }
          }
          
          return Promise.resolve(mockSupabaseResponse(null, { message: 'No rows found' }));
        })
      }))
    }))
  }))
};

module.exports = {
  mockSupabase,
  mockApiKeys,
  mockUsers,
  mockSupabaseResponse
};
