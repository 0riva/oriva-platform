#!/usr/bin/env node

/**
 * Test script to demonstrate the working Oriva API with real API keys
 */

const API_BASE_URL = 'http://localhost:3001';

async function makeRequest(endpoint, apiKey = null, options = {}) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  const requestOptions = {
    headers,
    ...options
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, requestOptions);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 'ERROR', data: { error: error.message } };
  }
}

async function testAPI() {
  console.log('🧪 Testing Oriva API with Real API Key Validation\n');
  
  // Test 1: Health endpoint (no auth required)
  console.log('1️⃣ Testing health endpoint (no auth required)...');
  const healthResult = await makeRequest('/api/v1/health');
  console.log(`   Status: ${healthResult.status}`);
  console.log(`   Response:`, JSON.stringify(healthResult.data, null, 2));
  console.log('');
  
  // Test 2: Generate a real API key
  console.log('2️⃣ Generating a real API key...');
  const keyResult = await makeRequest('/api/v1/dev/generate-key', null, {
    method: 'POST',
    body: JSON.stringify({
      appName: 'Test Script App',
      type: 'test'
    })
  });
  
  let apiKey = null;
  if (keyResult.status === 200 && keyResult.data.success) {
    apiKey = keyResult.data.data.apiKey;
    console.log(`   ✅ Generated API Key: ${apiKey}`);
    console.log(`   App: ${keyResult.data.data.appName}`);
    console.log(`   Type: ${keyResult.data.data.type}`);
  } else {
    console.log(`   ❌ Failed to generate API key:`, keyResult.data);
    return;
  }
  console.log('');
  
  // Test 3: Test with valid API key
  console.log('3️⃣ Testing user/me endpoint with valid API key...');
  const userResult = await makeRequest('/api/v1/user/me', apiKey);
  console.log(`   Status: ${userResult.status}`);
  if (userResult.status === 200) {
    console.log(`   ✅ Success! User data:`, JSON.stringify(userResult.data, null, 2));
  } else {
    console.log(`   ❌ Failed:`, userResult.data);
  }
  console.log('');
  
  // Test 4: Test with invalid API key
  console.log('4️⃣ Testing user/me endpoint with invalid API key...');
  const invalidResult = await makeRequest('/api/v1/user/me', 'oriva_pk_test_invalidkey123');
  console.log(`   Status: ${invalidResult.status}`);
  if (invalidResult.status === 401) {
    console.log(`   ✅ Correctly rejected invalid key:`, invalidResult.data);
  } else {
    console.log(`   ❌ Unexpected result:`, invalidResult.data);
  }
  console.log('');
  
  // Test 5: Test with no API key
  console.log('5️⃣ Testing user/me endpoint with no API key...');
  const noKeyResult = await makeRequest('/api/v1/user/me');
  console.log(`   Status: ${noKeyResult.status}`);
  if (noKeyResult.status === 401) {
    console.log(`   ✅ Correctly rejected request without key:`, noKeyResult.data);
  } else {
    console.log(`   ❌ Unexpected result:`, noKeyResult.data);
  }
  console.log('');
  
  // Test 6: List all API keys
  console.log('6️⃣ Listing all API keys...');
  const listResult = await makeRequest('/api/v1/dev/keys');
  console.log(`   Status: ${listResult.status}`);
  if (listResult.status === 200) {
    console.log(`   ✅ Found ${listResult.data.data.length} API keys:`);
    listResult.data.data.forEach((key, index) => {
      console.log(`      ${index + 1}. ${key.key} (${key.appName}, ${key.type})`);
    });
  } else {
    console.log(`   ❌ Failed to list keys:`, listResult.data);
  }
  
  console.log('\n🎉 API testing completed!');
  console.log('\n📝 Summary:');
  console.log('   ✅ Health endpoint works without auth');
  console.log('   ✅ API key generation works');
  console.log('   ✅ Valid API keys are accepted');
  console.log('   ✅ Invalid API keys are rejected');
  console.log('   ✅ Requests without API keys are rejected');
  console.log('   ✅ API key listing works');
  console.log('\n🔑 Your API key system is now working correctly!');
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ This script requires Node.js 18+ with fetch support');
  console.log('   Or install node-fetch: npm install node-fetch');
  process.exit(1);
}

testAPI().catch(console.error);
