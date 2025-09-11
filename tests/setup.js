/**
 * Test setup and configuration
 * This file runs before all tests to set up the test environment
 */

const { initTestApp } = require('./utils/testHelpers');

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_key';
process.env.ORIVA_CORE_API_URL = 'https://test.oriva-core.co';
process.env.ORIVA_CORE_API_KEY = 'test_core_key';

// Mock the hashAPIKey function directly by overriding it in the API
// We'll do this after the app is loaded

// Mock Supabase before requiring the app
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn((table) => ({
      select: jest.fn(() => ({
        eq: jest.fn((column, value) => ({
          eq: jest.fn((column2, value2) => ({
            single: jest.fn(() => {
              // Mock API key lookup with chained .eq() calls
              if (table === 'developer_api_keys' && column === 'key_hash') {
                // The hash for 'oriva_pk_test_valid_key' (we'll use this as our test key)
                if (value === 'test_hash_for_valid_key') {
                  return Promise.resolve({
                    data: {
                      id: 'key_123',
                      user_id: 'user_123',
                      name: 'Test Extension',
                      permissions: ['user:read', 'entries:read', 'templates:read'],
                      usage_count: 42,
                      is_active: true,
                      created_at: '2024-01-01T00:00:00Z'
                    },
                    error: null
                  });
                } else {
                  return Promise.resolve({ data: null, error: { message: 'No rows found' } });
                }
              }
              
              // Default response
              return Promise.resolve({ data: null, error: null });
            })
          }))
        }))
      }))
    }))
  }))
}));

// Initialize the test app
const app = require('../api/index');
initTestApp(app);

// Global test timeout
jest.setTimeout(10000);

// Suppress console.log during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
