#!/usr/bin/env node

/**
 * Endpoint Property Audit Script
 *
 * Compares documented API properties against actual endpoint responses
 * to identify missing properties or documentation mismatches.
 */

const fs = require('fs');
const path = require('path');

// Expected properties from documentation
const DOCUMENTED_PROPERTIES = {
  '/api/v1/user/me': {
    data: {
      id: 'string',
      username: 'string',
      displayName: 'string',
      email: 'string',
      bio: 'string | null',
      location: 'string | null',
      website: 'string | null',
      avatar: 'string | null',
      createdAt: 'string',
      updatedAt: 'string',
      apiKeyInfo: {
        keyId: 'string',
        name: 'string',
        userId: 'string',
        permissions: 'array',
        usageCount: 'number'
      }
    }
  },

  '/api/v1/profiles/available': {
    data: [
      {
        profileId: 'string',
        profileName: 'string',
        isActive: 'boolean',
        avatar: 'string | null'  // Recently identified as missing
      }
    ]
  },

  '/api/v1/profiles/active': {
    data: {
      profileId: 'string',
      profileName: 'string',
      isActive: 'boolean',
      avatar: 'string | null'  // Recently identified as missing
    }
  },

  '/api/v1/groups': {
    data: [
      {
        groupId: 'string',
        groupName: 'string',
        memberCount: 'number',
        isActive: 'boolean'
      }
    ]
  },

  '/api/v1/groups/{groupId}/members': {
    data: [
      {
        memberId: 'string',
        displayName: 'string',
        role: 'string',
        joinedAt: 'string'
      }
    ]
  },

  '/api/v1/marketplace/apps': {
    data: [
      {
        id: 'string',
        name: 'string',
        slug: 'string',
        tagline: 'string',
        description: 'string',
        category: 'string',
        icon_url: 'string | null',
        screenshots: 'array',
        version: 'string',
        pricing_model: 'string',
        pricing_config: 'object',
        install_count: 'number',
        developer_id: 'string',
        developer_name: 'string',
        created_at: 'string',
        updated_at: 'string'
      }
    ]
  },

  '/api/v1/marketplace/trending': {
    data: [
      {
        id: 'string',
        name: 'string',
        slug: 'string',
        tagline: 'string',
        category: 'string',
        icon_url: 'string | null',
        install_count: 'number',
        developer_name: 'string'
      }
    ]
  },

  '/api/v1/marketplace/featured': {
    data: [
      {
        id: 'string',
        name: 'string',
        slug: 'string',
        tagline: 'string',
        category: 'string',
        icon_url: 'string | null',
        install_count: 'number',
        developer_name: 'string'
      }
    ]
  },

  '/api/v1/marketplace/categories': {
    data: [
      {
        category: 'string',
        count: 'number'
      }
    ]
  },

  '/api/v1/sessions': {
    data: [
      {
        sessionId: 'string',
        title: 'string',
        description: 'string',
        startTime: 'string',
        endTime: 'string',
        attendeeCount: 'number',
        status: 'string',
        type: 'string'
      }
    ],
    meta: {
      pagination: {
        page: 'number',
        limit: 'number',
        total: 'number',
        totalPages: 'number'
      }
    }
  },

  '/api/v1/sessions/upcoming': {
    data: [
      {
        sessionId: 'string',
        title: 'string',
        startTime: 'string',
        attendeeCount: 'number',
        status: 'string'
      }
    ]
  },

  '/api/v1/team/members': {
    data: [
      {
        memberId: 'string',
        name: 'string',
        email: 'string',
        role: 'string',
        avatar: 'string | null',
        status: 'string',
        joinedAt: 'string'
      }
    ],
    meta: {
      total: 'number',
      roles: 'array'
    }
  },

  '/api/v1/analytics/summary': {
    data: {
      overview: {
        totalSessions: 'number',
        totalUsers: 'number',
        totalTeams: 'number',
        activeApps: 'number'
      },
      metrics: {
        sessionGrowth: 'string',
        userEngagement: 'string',
        appUsage: 'string',
        teamActivity: 'string'
      },
      recentActivity: [
        {
          type: 'string',
          description: 'string',
          timestamp: 'string',
          userId: 'string'
        }
      ],
      timeRange: {
        start: 'string',
        end: 'string'
      }
    }
  },

  '/api/v1/auth/profile': {
    data: {
      id: 'string',
      email: 'string',
      displayName: 'string',
      avatar: 'string | null',
      authType: 'string',
      permissions: 'array',
      lastLogin: 'string',
      accountStatus: 'string',
      twoFactorEnabled: 'boolean',
      emailVerified: 'boolean'
    }
  }
};

function extractEndpointImplementations() {
  const apiFilePath = path.join(__dirname, '../../api/index.js');
  const apiContent = fs.readFileSync(apiFilePath, 'utf8');

  const implementations = {};

  // Extract endpoint implementations using regex
  const endpointRegex = /app\.get\(['"`]([^'"`]+)['"`][^{]*\{[^}]*res\.json\((\{[^}]+\}|\{[\s\S]*?\n\s*\})/g;

  let match;
  while ((match = endpointRegex.exec(apiContent)) !== null) {
    const endpoint = match[1];
    const responseCode = match[2];

    try {
      // This is a simplified extraction - in reality we'd need more sophisticated parsing
      implementations[endpoint] = {
        found: true,
        responsePattern: responseCode
      };
    } catch (error) {
      implementations[endpoint] = {
        found: false,
        error: error.message
      };
    }
  }

  return implementations;
}

function checkPropertyImplementation(endpoint) {
  const apiFilePath = path.join(__dirname, '../../api/index.js');
  const apiContent = fs.readFileSync(apiFilePath, 'utf8');

  // Find the specific endpoint implementation
  const endpointPattern = new RegExp(`app\\.get\\(['"\`]${endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`][\\s\\S]*?res\\.json\\([\\s\\S]*?\\);`, 'g');
  const match = endpointPattern.exec(apiContent);

  if (!match) {
    return { found: false, reason: 'Endpoint not found in implementation' };
  }

  const implementation = match[0];
  const documented = DOCUMENTED_PROPERTIES[endpoint];

  if (!documented) {
    return { found: false, reason: 'No documented properties found' };
  }

  // Check for specific properties in the implementation
  const issues = [];

  function checkProperties(props, path = '') {
    for (const [key, type] of Object.entries(props)) {
      const fullPath = path ? `${path}.${key}` : key;

      if (typeof type === 'object' && !Array.isArray(type)) {
        // Nested object
        checkProperties(type, fullPath);
      } else {
        // Check if property exists in implementation
        if (!implementation.includes(`${key}:`)) {
          issues.push(`Missing property: ${fullPath} (${type})`);
        }
      }
    }
  }

  if (documented.data) {
    if (Array.isArray(documented.data)) {
      checkProperties(documented.data[0], 'data[0]');
    } else {
      checkProperties(documented.data, 'data');
    }
  }

  if (documented.meta) {
    checkProperties(documented.meta, 'meta');
  }

  return {
    found: true,
    issues: issues,
    implementation: implementation.substring(0, 200) + '...'
  };
}

function auditAllEndpoints() {
  console.log('🔍 Oriva API Endpoint Property Audit');
  console.log('=' .repeat(50));

  const results = {};
  let totalIssues = 0;

  for (const endpoint of Object.keys(DOCUMENTED_PROPERTIES)) {
    console.log(`\n📊 Checking: ${endpoint}`);
    console.log('-'.repeat(40));

    const result = checkPropertyImplementation(endpoint);
    results[endpoint] = result;

    if (!result.found) {
      console.log(`❌ ${result.reason}`);
      totalIssues++;
    } else if (result.issues.length > 0) {
      console.log(`⚠️  Found ${result.issues.length} issues:`);
      result.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
      totalIssues += result.issues.length;
    } else {
      console.log('✅ All documented properties implemented');
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📋 AUDIT SUMMARY`);
  console.log(`Total endpoints checked: ${Object.keys(DOCUMENTED_PROPERTIES).length}`);
  console.log(`Total issues found: ${totalIssues}`);

  if (totalIssues > 0) {
    console.log('\n🚨 CRITICAL: Documentation does not match implementation!');
    console.log('   Developers will expect properties that are not provided.');
    console.log('\n💡 RECOMMENDED ACTIONS:');
    console.log('   1. Add missing properties to endpoint implementations');
    console.log('   2. Update documentation to match actual responses');
    console.log('   3. Test all endpoints with the API explorer tool');
  } else {
    console.log('\n✅ SUCCESS: All documented properties are implemented!');
  }

  return results;
}

// Generate fix recommendations
function generateFixRecommendations(results) {
  console.log('\n🔧 FIX RECOMMENDATIONS');
  console.log('='.repeat(50));

  for (const [endpoint, result] of Object.entries(results)) {
    if (result.issues && result.issues.length > 0) {
      console.log(`\n${endpoint}:`);
      result.issues.forEach(issue => {
        if (issue.includes('avatar')) {
          console.log(`   • Add avatar: 'https://example.com/avatar.jpg' to response`);
        } else if (issue.includes('meta')) {
          console.log(`   • Add meta object with pagination/counts`);
        } else {
          console.log(`   • ${issue}`);
        }
      });
    }
  }
}

if (require.main === module) {
  const results = auditAllEndpoints();
  generateFixRecommendations(results);
}

module.exports = {
  DOCUMENTED_PROPERTIES,
  checkPropertyImplementation,
  auditAllEndpoints
};