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

// Supabase connection comes from .env / .env.local (loaded above, and re-loaded
// by api/index.ts for the app under test). Do NOT hardcode the URL/keys here —
// api/index.ts re-applies .env.local with override:true, so a hardcoded value
// is silently replaced anyway. One source of truth: the env files.

// Global test timeout
jest.setTimeout(10000);
