#!/usr/bin/env node

/**
 * Test script for API key validation
 * Tests the updated API server against real API keys from Supabase
 */

const https = require('https');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.oriva.io';
const TEST_API_KEY = process.env.TEST_API_KEY || '';

if (!TEST_API_KEY) {
  console.error('❌ Please provide a TEST_API_KEY environment variable');
  console.error('   Usage: TEST_API_KEY=oriva_pk_test_... node test-api-key-validation.js');
  process.exit(1);
}

console.log('🔍 Testing API key validation...');
console.log(`📍 API Base URL: ${API_BASE_URL}`);
console.log(`🔑 Using API key: ${TEST_API_KEY.substring(0, 20)}...`);

// Test function
async function testEndpoint(path, description) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE_URL);
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TEST_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Oriva-API-Test/1.0'
      }
    };

    console.log(`\n🧪 Testing: ${description}`);
    console.log(`   GET ${url.toString()}`);

    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`   Status: ${res.statusCode}`);
          
          if (res.statusCode === 200) {
            console.log('   ✅ SUCCESS');
            if (jsonData.data?.apiKeyInfo) {
              console.log(`   🔑 Key Info: ${JSON.stringify(jsonData.data.apiKeyInfo, null, 6)}`);
            }
          } else {
            console.log('   ❌ FAILED');
            console.log(`   Error: ${jsonData.error || 'Unknown error'}`);
          }
          
          resolve({
            status: res.statusCode,
            data: jsonData,
            success: res.statusCode === 200
          });
        } catch (parseError) {
          console.log(`   ❌ PARSE ERROR: ${parseError.message}`);
          console.log(`   Raw response: ${data}`);
          resolve({
            status: res.statusCode,
            error: parseError.message,
            success: false
          });
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ REQUEST ERROR: ${error.message}`);
      resolve({
        error: error.message,
        success: false
      });
    });

    req.setTimeout(10000, () => {
      console.log('   ❌ TIMEOUT');
      req.abort();
      resolve({
        error: 'Timeout',
        success: false
      });
    });

    req.end();
  });
}

// Run tests
async function runTests() {
  console.log('\n=== API Key Validation Test Suite ===');
  
  const tests = [
    {
      path: '/api/v1/health',
      description: 'Health Check (no auth required)',
      requiresAuth: false
    },
    {
      path: '/api/v1/user/me',
      description: 'User Profile (with API key)',
      requiresAuth: true
    },
    {
      path: '/api/v1/entries',
      description: 'Entries List (with API key)', 
      requiresAuth: true
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    const result = await testEndpoint(test.path, test.description);
    
    if (test.requiresAuth && result.success) {
      passedTests++;
    } else if (!test.requiresAuth && result.status === 200) {
      passedTests++;
    }
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=== Test Results ===');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! API key validation is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the API server configuration.');
  }
}

// Test with invalid key first
async function testInvalidKey() {
  console.log('\n🧪 Testing with invalid API key...');
  
  const originalKey = process.env.TEST_API_KEY;
  process.env.TEST_API_KEY = 'oriva_pk_test_invalid_key_12345';
  
  const result = await testEndpoint('/api/v1/user/me', 'Invalid API Key Test');
  
  if (result.status === 401) {
    console.log('   ✅ Invalid key correctly rejected');
  } else {
    console.log('   ❌ Invalid key should have been rejected');
  }
  
  process.env.TEST_API_KEY = originalKey;
}

// Run all tests
async function main() {
  try {
    await testInvalidKey();
    await runTests();
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();