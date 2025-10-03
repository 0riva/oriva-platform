// Global test setup
// Task: T017-T034 - Initialize test environment before running contract tests

// Load environment variables FIRST before any other code
require('dotenv').config();

export default async function globalSetup() {
  console.log('🔧 Setting up test environment...');

  // Set test environment variables (use Object.defineProperty to override readonly)
  if (process.env.NODE_ENV !== 'test') {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });
  }
  if (!process.env.TEST_API_URL) {
    process.env.TEST_API_URL = 'http://localhost:3000';
  }

  // Ensure test API keys are set (from .env or fallback)
  if (!process.env.API_KEY_PLATFORM) {
    process.env.API_KEY_PLATFORM = 'test-api-key';
  }
  if (!process.env.API_KEY_HUGO_LOVE) {
    process.env.API_KEY_HUGO_LOVE = 'test-api-key-hugo-love';
  }
  if (!process.env.API_KEY_HUGO_CAREER) {
    process.env.API_KEY_HUGO_CAREER = 'test-api-key-hugo-career';
  }

  console.log('✅ Test environment ready');
  console.log('[SETUP] API Keys configured:', {
    platform: process.env.API_KEY_PLATFORM,
    hugoLove: process.env.API_KEY_HUGO_LOVE,
    hugoCareer: process.env.API_KEY_HUGO_CAREER,
  });
}
