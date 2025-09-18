#!/usr/bin/env node

/**
 * Oriva Platform API Explorer
 *
 * Interactive tool to discover API endpoints and their response properties.
 * Run with: node api-explorer.js
 *
 * Features:
 * - Automatic property discovery
 * - Response schema generation
 * - TypeScript interface generation
 * - Interactive endpoint testing
 */

const https = require('https');
const readline = require('readline');

// Configuration
const API_BASE_URL = 'https://api.oriva.io';
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'oriva-api-explorer/1.0.0 (nodejs)',
  'X-Client-ID': 'api-explorer'
};

// API Endpoints to explore
const ENDPOINTS = {
  core: {
    'User Profile': '/api/v1/user/me',
    'Health Check': '/api/v1/health',
    'Test Endpoint': '/api/v1/test'
  },
  profiles: {
    'Available Profiles': '/api/v1/profiles/available',
    'Active Profile': '/api/v1/profiles/active'
  },
  groups: {
    'User Groups': '/api/v1/groups'
  },
  marketplace: {
    'Marketplace Apps': '/api/v1/marketplace/apps?limit=5',
    'Trending Apps': '/api/v1/marketplace/trending?limit=3',
    'Featured Apps': '/api/v1/marketplace/featured?limit=3',
    'App Categories': '/api/v1/marketplace/categories'
  },
  sessions: {
    'User Sessions': '/api/v1/sessions',
    'Upcoming Sessions': '/api/v1/sessions/upcoming'
  },
  team: {
    'Team Members': '/api/v1/team/members'
  },
  analytics: {
    'Analytics Summary': '/api/v1/analytics/summary'
  }
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Utility functions
function makeRequest(endpoint, apiKey) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      ...DEFAULT_HEADERS,
      'Authorization': `Bearer ${apiKey}`
    };

    const options = {
      method: 'GET',
      headers
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function analyzeDataStructure(obj, path = '', depth = 0) {
  if (depth > 5) return {}; // Prevent infinite recursion

  const schema = {};

  if (Array.isArray(obj)) {
    if (obj.length > 0) {
      schema.type = 'array';
      schema.items = analyzeDataStructure(obj[0], `${path}[0]`, depth + 1);
      schema.example_length = obj.length;
    } else {
      schema.type = 'array';
      schema.items = 'unknown (empty array)';
    }
  } else if (obj !== null && typeof obj === 'object') {
    schema.type = 'object';
    schema.properties = {};

    for (const [key, value] of Object.entries(obj)) {
      const keyPath = path ? `${path}.${key}` : key;
      schema.properties[key] = analyzeDataStructure(value, keyPath, depth + 1);
    }
  } else {
    schema.type = typeof obj;
    schema.value = obj;

    // Add format hints for common patterns
    if (typeof obj === 'string') {
      if (obj.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        schema.format = 'ISO 8601 timestamp';
      } else if (obj.match(/^https?:\/\//)) {
        schema.format = 'URL';
      } else if (obj.match(/^ext_[a-f0-9]{16}$/)) {
        schema.format = 'External ID';
      } else if (obj.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        schema.format = 'Email';
      }
    }
  }

  return schema;
}

function generateTypeScriptInterface(schema, name = 'ApiResponse') {
  function typeToTS(schema, indent = 0) {
    const spaces = '  '.repeat(indent);

    if (schema.type === 'array') {
      if (schema.items && schema.items.type === 'object') {
        return `Array<{\n${typeToTS(schema.items, indent + 1)}\n${spaces}>`;
      } else {
        return `${typeToTS(schema.items, 0)}[]`;
      }
    } else if (schema.type === 'object' && schema.properties) {
      let result = '';
      for (const [key, value] of Object.entries(schema.properties)) {
        const optional = value.value === null || value.value === undefined ? '?' : '';
        result += `${spaces}${key}${optional}: ${typeToTS(value, 0)};\n`;
      }
      return result.slice(0, -1); // Remove last newline
    } else {
      switch (schema.type) {
        case 'string': return 'string';
        case 'number': return 'number';
        case 'boolean': return 'boolean';
        case 'null': return 'null';
        default: return 'unknown';
      }
    }
  }

  return `interface ${name} {\n${typeToTS(schema, 1)}\n}`;
}

function printSchema(schema, indent = 0) {
  const spaces = '  '.repeat(indent);

  if (schema.type === 'array') {
    console.log(`${spaces}Array of ${schema.items ? schema.items.type : 'unknown'} (${schema.example_length || 0} items)`);
    if (schema.items && schema.items.properties) {
      printSchema(schema.items, indent + 1);
    }
  } else if (schema.type === 'object' && schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const formatHint = value.format ? ` (${value.format})` : '';
      const exampleValue = value.value !== undefined ? ` = ${JSON.stringify(value.value)}` : '';
      console.log(`${spaces}${key}: ${value.type}${formatHint}${exampleValue}`);

      if (value.type === 'object' && value.properties) {
        printSchema(value, indent + 1);
      } else if (value.type === 'array' && value.items) {
        printSchema(value, indent + 1);
      }
    }
  }
}

async function exploreEndpoint(endpoint, apiKey) {
  console.log(`\n🔍 Testing: ${endpoint}`);
  console.log('━'.repeat(50));

  try {
    const response = await makeRequest(endpoint, apiKey);

    console.log(`Status: ${response.status}`);

    if (response.parseError) {
      console.log(`❌ JSON Parse Error: ${response.parseError}`);
      console.log(`Raw Response: ${response.data.substring(0, 200)}...`);
      return;
    }

    if (response.status === 401) {
      console.log('❌ Authentication failed. Check your API key.');
      return;
    }

    if (response.status !== 200) {
      console.log(`❌ Request failed with status ${response.status}`);
      console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
      return;
    }

    console.log('✅ Success!\n');

    // Analyze response structure
    const schema = analyzeDataStructure(response.data);

    console.log('📊 Response Schema:');
    printSchema(schema);

    console.log('\n📝 TypeScript Interface:');
    const interfaceName = endpoint.split('/').pop().replace(/[^a-zA-Z0-9]/g, '') + 'Response';
    console.log(generateTypeScriptInterface(schema, interfaceName));

    console.log('\n📋 Example Response:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}

async function exploreCategory(category, endpoints, apiKey) {
  console.log(`\n🗂️  Exploring ${category.toUpperCase()} endpoints:`);
  console.log('═'.repeat(60));

  for (const [name, endpoint] of Object.entries(endpoints)) {
    await exploreEndpoint(endpoint, apiKey);

    // Pause between requests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function interactiveMode(apiKey) {
  console.log('\n🎮 Interactive Mode');
  console.log('Enter an endpoint to test (e.g., /api/v1/user/me) or "quit" to exit:');

  const getInput = () => new Promise(resolve => {
    rl.question('> ', resolve);
  });

  while (true) {
    const input = await getInput();

    if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
      break;
    }

    if (input.startsWith('/')) {
      await exploreEndpoint(input, apiKey);
    } else {
      console.log('Please enter a valid endpoint starting with "/" or "quit" to exit.');
    }
  }
}

async function main() {
  console.log('🚀 Oriva Platform API Explorer');
  console.log('═'.repeat(40));

  // Get API key
  const apiKey = await new Promise(resolve => {
    rl.question('Enter your Oriva API key: ', resolve);
  });

  if (!apiKey.startsWith('oriva_pk_')) {
    console.log('❌ Invalid API key format. Expected format: oriva_pk_live_... or oriva_pk_test_...');
    rl.close();
    return;
  }

  console.log('\n📚 Available exploration modes:');
  console.log('1. Explore all endpoints');
  console.log('2. Explore specific category');
  console.log('3. Interactive mode');

  const mode = await new Promise(resolve => {
    rl.question('Select mode (1-3): ', resolve);
  });

  switch (mode) {
    case '1':
      // Explore all endpoints
      for (const [category, endpoints] of Object.entries(ENDPOINTS)) {
        await exploreCategory(category, endpoints, apiKey);
      }
      break;

    case '2':
      // Explore specific category
      console.log('\nAvailable categories:');
      Object.keys(ENDPOINTS).forEach((cat, i) => {
        console.log(`${i + 1}. ${cat}`);
      });

      const catChoice = await new Promise(resolve => {
        rl.question('Select category: ', resolve);
      });

      const categories = Object.keys(ENDPOINTS);
      const selectedCategory = categories[parseInt(catChoice) - 1];

      if (selectedCategory) {
        await exploreCategory(selectedCategory, ENDPOINTS[selectedCategory], apiKey);
      } else {
        console.log('Invalid category selection.');
      }
      break;

    case '3':
      // Interactive mode
      await interactiveMode(apiKey);
      break;

    default:
      console.log('Invalid mode selection.');
  }

  console.log('\n✨ Exploration complete!');
  rl.close();
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  rl.close();
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  rl.close();
  process.exit(0);
});

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  makeRequest,
  analyzeDataStructure,
  generateTypeScriptInterface,
  exploreEndpoint
};