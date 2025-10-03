/**
 * Test setup and configuration
 * This file runs before all tests to set up the test environment
 */

// Load environment variables FIRST before any other code
require('dotenv').config();

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.NO_SERVER = 'true';

// Override with test values where needed
process.env.ORIVA_CORE_API_URL = 'https://test.oriva-core.co';
process.env.ORIVA_CORE_API_KEY = 'test_core_key';

// Ensure test API keys are set (from .env or fallback)
process.env.API_KEY_PLATFORM = process.env.API_KEY_PLATFORM || 'test-api-key';
process.env.API_KEY_HUGO_LOVE = process.env.API_KEY_HUGO_LOVE || 'test-api-key-hugo-love';
process.env.API_KEY_HUGO_CAREER = process.env.API_KEY_HUGO_CAREER || 'test-api-key-hugo-career';

// Use local Supabase for tests (Docker instance with seeded test data)
// From: supabase status
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
// Service role key bypasses RLS - required for API server
process.env.SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Global test timeout
jest.setTimeout(10000);
