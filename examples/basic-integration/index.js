/**
 * Basic Oriva Platform API Integration Example
 *
 * This example demonstrates:
 * - API key authentication
 * - Making API calls
 * - Error handling
 * - Working with responses
 *
 * Setup:
 * 1. npm install node-fetch dotenv
 * 2. Create .env file with ORIVA_API_KEY=your_key_here
 * 3. Run: node index.js
 */

require('dotenv').config();
const fetch = require('node-fetch');

const ORIVA_BASE_URL = process.env.ORIVA_BASE_URL || 'https://api.oriva.io';
const ORIVA_API_KEY = process.env.ORIVA_API_KEY;

/**
 * Reusable API client function
 * @param {string} endpoint - API endpoint (e.g., '/api/v1/user/me')
 * @param {object} options - Fetch options
 * @returns {Promise<object>} API response data
 */
async function callOrivaAPI(endpoint, options = {}) {
  if (!ORIVA_API_KEY) {
    throw new Error('ORIVA_API_KEY not configured in environment variables');
  }

  const url = `${ORIVA_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ORIVA_API_KEY}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Oriva-Example/1.0',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Example 1: Get current authenticated user
 */
async function getCurrentUser() {
  console.log('📝 Fetching current user...');
  try {
    const response = await callOrivaAPI('/api/v1/user/me');
    console.log('✅ Success! User data:', {
      id: response.data.id,
      name: response.data.name,
      email: response.data.email
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching user:', error.message);
    throw error;
  }
}

/**
 * Example 2: List available profiles
 */
async function listProfiles() {
  console.log('\n📂 Fetching available profiles...');
  try {
    const response = await callOrivaAPI('/api/v1/profiles/available');
    console.log(`✅ Found ${response.data.length} profile(s)`);
    response.data.forEach((profile, index) => {
      console.log(`  ${index + 1}. ${profile.name} (${profile.id})`);
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching profiles:', error.message);
    throw error;
  }
}

/**
 * Example 3: Browse marketplace apps
 */
async function browseMarketplace(limit = 5) {
  console.log('\n🏪 Browsing marketplace apps...');
  try {
    const response = await callOrivaAPI(`/api/v1/marketplace/apps?limit=${limit}`);
    console.log(`✅ Found ${response.data.length} app(s):`);
    response.data.forEach((app, index) => {
      console.log(`  ${index + 1}. ${app.name} - ${app.tagline || app.description}`);
      console.log(`     Category: ${app.category} | Installs: ${app.install_count || 0}`);
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching marketplace:', error.message);
    throw error;
  }
}

/**
 * Example 4: Get trending apps
 */
async function getTrendingApps(limit = 5) {
  console.log('\n📈 Fetching trending apps...');
  try {
    const response = await callOrivaAPI(`/api/v1/marketplace/trending?limit=${limit}`);
    console.log(`✅ Top ${response.data.length} trending apps:`);
    response.data.forEach((app, index) => {
      console.log(`  ${index + 1}. ${app.name} - ${app.install_count} installs`);
    });
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching trending apps:', error.message);
    throw error;
  }
}

/**
 * Example 5: Error handling demonstration
 */
async function demonstrateErrorHandling() {
  console.log('\n⚠️  Demonstrating error handling...');
  try {
    // Intentionally call non-existent endpoint
    await callOrivaAPI('/api/v1/invalid/endpoint');
  } catch (error) {
    console.log('✅ Error caught successfully:', error.message);
  }
}

/**
 * Main function - runs all examples
 */
async function main() {
  console.log('🚀 Oriva Platform API Integration Examples\n');
  console.log('═'.repeat(50));

  try {
    // Run examples in sequence
    await getCurrentUser();
    await listProfiles();
    await browseMarketplace();
    await getTrendingApps();
    await demonstrateErrorHandling();

    console.log('\n═'.repeat(50));
    console.log('✨ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for use in other files
module.exports = {
  callOrivaAPI,
  getCurrentUser,
  listProfiles,
  browseMarketplace,
  getTrendingApps
};
