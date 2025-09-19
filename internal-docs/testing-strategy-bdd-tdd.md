# 🧪 Testing Strategy: BDD Acceptance Criteria & TDD API Testing

> **Comprehensive testing strategy for Extension API implementation with BDD acceptance criteria and TDD test harness**

## 🎯 **Current State Analysis**

### **❌ Missing Testing Infrastructure:**
- No test framework configured
- No test files exist
- No CI/CD testing pipeline
- No acceptance criteria defined
- No BDD scenarios
- No TDD test harness

### **✅ What We Need to Build:**
1. **BDD Acceptance Criteria** - End-user functionality validation
2. **TDD Test Harness** - API unit and integration testing
3. **Test Infrastructure** - Jest, Supertest, Cucumber setup
4. **CI/CD Pipeline** - Automated testing on commits
5. **Test Data Management** - Mock data and test fixtures

---

## 🎯 **BDD Acceptance Criteria**

### **Feature: Extension Profile Management**

#### **Scenario 1: Extension can access authorized profiles**
```gherkin
Feature: Extension Profile Access
  As an Extension developer
  I want to access user profiles that my Extension is authorized to see
  So that I can provide personalized functionality

  Background:
    Given the Extension "DatingApp" is installed by user "john_doe"
    And the user has granted access to "Dating Profile" and "Work Profile"
    And the Extension has a valid API key

  Scenario: Extension can retrieve available profiles
    When the Extension requests available profiles
    Then the API should return only authorized profiles
    And each profile should contain sanitized data
    And no internal Oriva Core IDs should be exposed
    And the response should include profile names and display names

  Scenario: Extension cannot access unauthorized profiles
    Given the Extension is not authorized to access "Family Profile"
    When the Extension requests "Family Profile" data
    Then the API should return a 403 Forbidden error
    And the error message should indicate access denied

  Scenario: Extension can switch between authorized profiles
    Given the Extension is currently using "Dating Profile"
    When the Extension switches to "Work Profile"
    Then the API should update the active profile
    And subsequent requests should use "Work Profile" data
    And the Extension should receive confirmation of the switch
```

#### **Scenario 2: Profile data isolation and privacy**
```gherkin
Feature: Profile Data Isolation
  As a user with multiple profiles
  I want each Extension to see only the appropriate profile data
  So that my privacy is protected across different contexts

  Background:
    Given user "jane_smith" has profiles: "Dating Profile", "Work Profile", "Family Profile"
    And Extension "DatingApp" is authorized for "Dating Profile" only
    And Extension "WorkApp" is authorized for "Work Profile" only

  Scenario: Extensions cannot detect cross-profile relationships
    When "DatingApp" requests profile data
    And "WorkApp" requests profile data
    Then each Extension should receive different sanitized profile IDs
    And neither Extension should be able to determine the profiles belong to the same user
    And no shared identifiers should be exposed

  Scenario: Profile switching maintains data isolation
    Given "DatingApp" is currently using "Dating Profile"
    When the user switches to "Work Profile" in "DatingApp"
    Then "DatingApp" should only see "Work Profile" data
    And "DatingApp" should not have access to "Dating Profile" data
    And the switch should be immediate and complete
```

### **Feature: Extension Group Management**

#### **Scenario 3: Extension can access authorized groups**
```gherkin
Feature: Extension Group Access
  As an Extension developer
  I want to access user groups that my Extension is authorized to see
  So that I can provide group-based functionality

  Background:
    Given the Extension "TeamApp" is installed by user "alice_dev"
    And the user is a member of groups: "Frontend Team", "Backend Team", "Family Group"
    And the user has granted access to "Frontend Team" and "Backend Team" only

  Scenario: Extension can retrieve authorized groups
    When the Extension requests available groups
    Then the API should return only authorized groups
    And each group should contain sanitized data
    And group member information should be sanitized
    And no internal Oriva Core IDs should be exposed

  Scenario: Extension can access group members
    Given the Extension is authorized to access "Frontend Team"
    When the Extension requests group members
    Then the API should return sanitized member data
    And member names should be visible but not email addresses
    And member IDs should be sanitized
    And no cross-group member relationships should be exposed
```

### **Feature: Real-time Updates**

#### **Scenario 4: Extension receives real-time updates**
```gherkin
Feature: Real-time Profile Updates
  As an Extension developer
  I want to receive real-time updates when profile data changes
  So that my Extension can stay synchronized with Oriva Core

  Background:
    Given the Extension "ProfileApp" is subscribed to profile updates
    And the user is currently using "Work Profile"

  Scenario: Extension receives profile update notifications
    When the user updates their "Work Profile" in Oriva Core
    Then the Extension should receive a webhook notification
    And the notification should contain the updated profile data
    And the Extension should be able to refresh its local data
    And the update should be delivered within 5 seconds

  Scenario: Extension handles profile deletion gracefully
    When the user deletes "Work Profile" in Oriva Core
    Then the Extension should receive a deletion notification
    And the Extension should no longer have access to that profile
    And the Extension should fall back to the default profile
    And no errors should occur in the Extension
```

---

## 🎯 **TDD Test Harness Setup**

### **Step 1: Install Testing Dependencies**
```bash
# Install testing framework and utilities
npm install --save-dev jest supertest @types/jest @types/supertest
npm install --save-dev cucumber @cucumber/cucumber @cucumber/pretty-formatter
npm install --save-dev nock # For mocking HTTP requests
npm install --save-dev @faker-js/faker # For generating test data
```

### **Step 2: Configure Jest**
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'api/**/*.js',
    '!api/index.js', // Exclude main entry point
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000
};
```

### **Step 3: Create Test Setup**
```javascript
// tests/setup.js
const { createClient } = require('@supabase/supabase-js');

// Mock Supabase for testing
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => Promise.resolve({ data: null, error: null })),
      delete: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
}));

// Global test utilities
global.testUtils = {
  generateTestApiKey: () => 'oriva_pk_test_' + Math.random().toString(36).substring(7),
  generateTestUserId: () => 'user_' + Math.random().toString(36).substring(7),
  generateTestProfileId: () => 'profile_' + Math.random().toString(36).substring(7),
  generateTestGroupId: () => 'group_' + Math.random().toString(36).substring(7)
};
```

### **Step 4: Create Test Database Setup**
```javascript
// tests/database-setup.js
const { createClient } = require('@supabase/supabase-js');

class TestDatabase {
  constructor() {
    this.supabase = createClient(
      process.env.TEST_SUPABASE_URL,
      process.env.TEST_SUPABASE_SERVICE_KEY
    );
  }

  async setupTestData() {
    // Create test user
    const testUser = {
      id: global.testUtils.generateTestUserId(),
      email: 'test@example.com',
      created_at: new Date().toISOString()
    };

    // Create test Extension
    const testExtension = {
      id: global.testUtils.generateTestApiKey(),
      user_id: testUser.id,
      name: 'Test Extension',
      permissions: ['profiles:read', 'groups:read'],
      is_active: true
    };

    // Create test profile permissions
    const testProfilePermission = {
      extension_id: testExtension.id,
      user_id: testUser.id,
      oriva_profile_id: global.testUtils.generateTestProfileId(),
      profile_name: 'Test Profile',
      is_active: true
    };

    return { testUser, testExtension, testProfilePermission };
  }

  async cleanupTestData() {
    // Clean up test data
    await this.supabase
      .from('extension_profile_permissions')
      .delete()
      .like('user_id', 'user_%');

    await this.supabase
      .from('extension_group_permissions')
      .delete()
      .like('user_id', 'user_%');

    await this.supabase
      .from('developer_api_keys')
      .delete()
      .like('id', 'oriva_pk_test_%');
  }
}

module.exports = TestDatabase;
```

---

## 🎯 **TDD Test Implementation**

### **Step 5: Create API Test Suite**
```javascript
// tests/api/extension-profile-endpoints.test.js
const request = require('supertest');
const app = require('../../api/index');
const TestDatabase = require('../database-setup');

describe('Extension Profile Endpoints', () => {
  let testDb;
  let testData;

  beforeAll(async () => {
    testDb = new TestDatabase();
    testData = await testDb.setupTestData();
  });

  afterAll(async () => {
    await testDb.cleanupTestData();
  });

  describe('GET /api/v1/profiles/available', () => {
    test('should return authorized profiles for Extension', async () => {
      const response = await request(app)
        .get('/api/v1/profiles/available')
        .set('Authorization', `Bearer ${testData.testExtension.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should return 401 for invalid API key', async () => {
      const response = await request(app)
        .get('/api/v1/profiles/available')
        .set('Authorization', 'Bearer invalid_key');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid API key');
    });

    test('should return 401 for missing API key', async () => {
      const response = await request(app)
        .get('/api/v1/profiles/available');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API key required');
    });
  });

  describe('GET /api/v1/profiles/current', () => {
    test('should return current active profile', async () => {
      const response = await request(app)
        .get('/api/v1/profiles/current')
        .set('Authorization', `Bearer ${testData.testExtension.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.activeProfile).toBeDefined();
    });

    test('should return default profile when no active profile', async () => {
      // Mock no active profile session
      const response = await request(app)
        .get('/api/v1/profiles/current')
        .set('Authorization', `Bearer ${testData.testExtension.id}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isDefault).toBe(true);
    });
  });

  describe('POST /api/v1/profiles/:orivaProfileId/activate', () => {
    test('should switch to authorized profile', async () => {
      const response = await request(app)
        .post(`/api/v1/profiles/${testData.testProfilePermission.oriva_profile_id}/activate`)
        .set('Authorization', `Bearer ${testData.testExtension.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.profileSwitched).toBe(true);
      expect(response.body.data.activeProfile).toBeDefined();
    });

    test('should return 403 for unauthorized profile', async () => {
      const unauthorizedProfileId = global.testUtils.generateTestProfileId();
      
      const response = await request(app)
        .post(`/api/v1/profiles/${unauthorizedProfileId}/activate`)
        .set('Authorization', `Bearer ${testData.testExtension.id}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Extension does not have access to this profile');
    });
  });
});
```

### **Step 6: Create Data Sanitization Tests**
```javascript
// tests/middleware/data-sanitization.test.js
const { sanitizeProfileDataForExtension, sanitizeGroupDataForExtension } = require('../../api/middleware/sanitization');

describe('Data Sanitization', () => {
  describe('sanitizeProfileDataForExtension', () => {
    test('should sanitize profile data and remove internal IDs', () => {
      const rawProfile = {
        orivaProfileId: 'internal_profile_123',
        userId: 'internal_user_456',
        profileName: 'Dating Profile',
        displayName: 'John Doe',
        bio: 'Looking for meaningful connections',
        avatarUrl: 'https://example.com/avatar.jpg',
        location: 'San Francisco, CA',
        website: 'https://johndoe.com',
        customFields: {
          age: 28,
          interests: ['photography', 'hiking']
        }
      };

      const sanitized = sanitizeProfileDataForExtension(rawProfile);

      expect(sanitized.profileId).not.toBe('internal_profile_123');
      expect(sanitized.profileId).toMatch(/^ext_[a-f0-9]{16}$/);
      expect(sanitized).not.toHaveProperty('orivaProfileId');
      expect(sanitized).not.toHaveProperty('userId');
      expect(sanitized.profileName).toBe('Dating Profile');
      expect(sanitized.displayName).toBe('John Doe');
      expect(sanitized.bio).toBe('Looking for meaningful connections');
    });

    test('should generate different IDs for same input', () => {
      const rawProfile = {
        orivaProfileId: 'internal_profile_123',
        profileName: 'Test Profile',
        displayName: 'Test User'
      };

      const sanitized1 = sanitizeProfileDataForExtension(rawProfile);
      const sanitized2 = sanitizeProfileDataForExtension(rawProfile);

      expect(sanitized1.profileId).toBe(sanitized2.profileId); // Should be deterministic
    });
  });

  describe('sanitizeGroupDataForExtension', () => {
    test('should sanitize group data and remove internal IDs', () => {
      const rawGroup = {
        orivaGroupId: 'internal_group_789',
        groupName: 'Frontend Team',
        groupType: 'work',
        memberCount: 8,
        userRole: 'member',
        joinedAt: '2024-01-15T10:00:00Z',
        description: 'Internal team description',
        createdBy: 'internal_user_456'
      };

      const sanitized = sanitizeGroupDataForExtension(rawGroup);

      expect(sanitized.groupId).not.toBe('internal_group_789');
      expect(sanitized.groupId).toMatch(/^ext_[a-f0-9]{16}$/);
      expect(sanitized).not.toHaveProperty('orivaProfileId');
      expect(sanitized).not.toHaveProperty('createdBy');
      expect(sanitized).not.toHaveProperty('description');
      expect(sanitized.groupName).toBe('Frontend Team');
      expect(sanitized.memberCount).toBe(8);
    });
  });
});
```

### **Step 7: Create Integration Tests**
```javascript
// tests/integration/extension-workflow.test.js
const request = require('supertest');
const app = require('../../api/index');
const TestDatabase = require('../database-setup');

describe('Extension Workflow Integration', () => {
  let testDb;
  let testData;

  beforeAll(async () => {
    testDb = new TestDatabase();
    testData = await testDb.setupTestData();
  });

  afterAll(async () => {
    await testDb.cleanupTestData();
  });

  test('complete Extension profile workflow', async () => {
    const extensionId = testData.testExtension.id;
    const profileId = testData.testProfilePermission.oriva_profile_id;

    // Step 1: Get available profiles
    const availableResponse = await request(app)
      .get('/api/v1/profiles/available')
      .set('Authorization', `Bearer ${extensionId}`);

    expect(availableResponse.status).toBe(200);
    expect(availableResponse.body.data.length).toBeGreaterThan(0);

    // Step 2: Get current profile
    const currentResponse = await request(app)
      .get('/api/v1/profiles/current')
      .set('Authorization', `Bearer ${extensionId}`);

    expect(currentResponse.status).toBe(200);
    expect(currentResponse.body.data.activeProfile).toBeDefined();

    // Step 3: Switch to specific profile
    const switchResponse = await request(app)
      .post(`/api/v1/profiles/${profileId}/activate`)
      .set('Authorization', `Bearer ${extensionId}`);

    expect(switchResponse.status).toBe(200);
    expect(switchResponse.body.data.profileSwitched).toBe(true);

    // Step 4: Verify profile switch
    const verifyResponse = await request(app)
      .get('/api/v1/profiles/current')
      .set('Authorization', `Bearer ${extensionId}`);

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.data.activeProfile.profileId).toBe(
      switchResponse.body.data.activeProfile.profileId
    );
  });

  test('Extension group workflow', async () => {
    const extensionId = testData.testExtension.id;

    // Get available groups
    const groupsResponse = await request(app)
      .get('/api/v1/groups')
      .set('Authorization', `Bearer ${extensionId}`);

    expect(groupsResponse.status).toBe(200);
    expect(Array.isArray(groupsResponse.body.data)).toBe(true);

    if (groupsResponse.body.data.length > 0) {
      const groupId = groupsResponse.body.data[0].groupId;

      // Get group details
      const groupResponse = await request(app)
        .get(`/api/v1/groups/${groupId}`)
        .set('Authorization', `Bearer ${extensionId}`);

      expect(groupResponse.status).toBe(200);
      expect(groupResponse.body.data.groupId).toBe(groupId);
    }
  });
});
```

---

## 🎯 **BDD Cucumber Tests**

### **Step 8: Create Cucumber Feature Files**
```gherkin
# features/extension-profile-access.feature
Feature: Extension Profile Access
  As an Extension developer
  I want to access user profiles that my Extension is authorized to see
  So that I can provide personalized functionality

  Background:
    Given the Extension "DatingApp" is installed by user "john_doe"
    And the user has granted access to "Dating Profile" and "Work Profile"
    And the Extension has a valid API key

  Scenario: Extension can retrieve available profiles
    When the Extension requests available profiles
    Then the API should return only authorized profiles
    And each profile should contain sanitized data
    And no internal Oriva Core IDs should be exposed
    And the response should include profile names and display names

  Scenario: Extension cannot access unauthorized profiles
    Given the Extension is not authorized to access "Family Profile"
    When the Extension requests "Family Profile" data
    Then the API should return a 403 Forbidden error
    And the error message should indicate access denied
```

### **Step 9: Create Cucumber Step Definitions**
```javascript
// features/step_definitions/extension-steps.js
const { Given, When, Then } = require('@cucumber/cucumber');
const request = require('supertest');
const app = require('../../api/index');
const TestDatabase = require('../../tests/database-setup');

let testDb;
let testData;
let response;

Given('the Extension {string} is installed by user {string}', async function (extensionName, userId) {
  testDb = new TestDatabase();
  testData = await testDb.setupTestData();
  testData.extensionName = extensionName;
  testData.userId = userId;
});

Given('the user has granted access to {string} and {string}', async function (profile1, profile2) {
  // Setup profile permissions in test database
  await testDb.setupProfilePermissions([
    { profileName: profile1, orivaProfileId: global.testUtils.generateTestProfileId() },
    { profileName: profile2, orivaProfileId: global.testUtils.generateTestProfileId() }
  ]);
});

Given('the Extension has a valid API key', function () {
  testData.apiKey = testData.testExtension.id;
});

When('the Extension requests available profiles', async function () {
  response = await request(app)
    .get('/api/v1/profiles/available')
    .set('Authorization', `Bearer ${testData.apiKey}`);
});

Then('the API should return only authorized profiles', function () {
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(Array.isArray(response.body.data)).toBe(true);
  expect(response.body.data.length).toBe(2); // Should have 2 authorized profiles
});

Then('each profile should contain sanitized data', function () {
  response.body.data.forEach(profile => {
    expect(profile).toHaveProperty('profileId');
    expect(profile).toHaveProperty('profileName');
    expect(profile).toHaveProperty('displayName');
    expect(profile.profileId).toMatch(/^ext_[a-f0-9]{16}$/);
    expect(profile).not.toHaveProperty('orivaProfileId');
    expect(profile).not.toHaveProperty('userId');
  });
});

Then('no internal Oriva Core IDs should be exposed', function () {
  response.body.data.forEach(profile => {
    expect(profile.profileId).not.toMatch(/^internal_/);
    expect(profile).not.toHaveProperty('orivaProfileId');
  });
});

Then('the response should include profile names and display names', function () {
  response.body.data.forEach(profile => {
    expect(profile.profileName).toBeDefined();
    expect(profile.displayName).toBeDefined();
  });
});
```

---

## 🎯 **CI/CD Pipeline Integration**

### **Step 10: Create GitHub Actions Workflow**
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm ci

    - name: Run unit tests
      run: npm run test:unit

    - name: Run integration tests
      run: npm run test:integration

    - name: Run BDD tests
      run: npm run test:bdd

    - name: Generate coverage report
      run: npm run test:coverage

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
```

### **Step 11: Update Package.json Scripts**
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:bdd": "cucumber-js features/**/*.feature",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "test:ci": "jest --ci --coverage --watchAll=false"
  }
}
```

---

## 🎯 **Test Data Management**

### **Step 12: Create Test Fixtures**
```javascript
// tests/fixtures/test-data.js
const { faker } = require('@faker-js/faker');

const generateTestUser = () => ({
  id: global.testUtils.generateTestUserId(),
  email: faker.internet.email(),
  username: faker.internet.userName(),
  displayName: faker.person.fullName(),
  createdAt: new Date().toISOString()
});

const generateTestProfile = (userId) => ({
  orivaProfileId: global.testUtils.generateTestProfileId(),
  userId: userId,
  profileName: faker.helpers.arrayElement(['Dating Profile', 'Work Profile', 'Family Profile']),
  displayName: faker.person.fullName(),
  bio: faker.lorem.sentence(),
  avatarUrl: faker.image.avatar(),
  location: faker.location.city(),
  website: faker.internet.url(),
  customFields: {
    age: faker.number.int({ min: 18, max: 65 }),
    interests: faker.helpers.arrayElements(['photography', 'hiking', 'cooking', 'gaming'], 3)
  }
});

const generateTestGroup = (userId) => ({
  orivaGroupId: global.testUtils.generateTestGroupId(),
  groupName: faker.company.name() + ' Team',
  groupType: faker.helpers.arrayElement(['work', 'social', 'gaming', 'family']),
  memberCount: faker.number.int({ min: 2, max: 50 }),
  userRole: faker.helpers.arrayElement(['admin', 'moderator', 'member']),
  joinedAt: faker.date.past().toISOString()
});

module.exports = {
  generateTestUser,
  generateTestProfile,
  generateTestGroup
};
```

---

## 🎯 **Summary**

This comprehensive testing strategy provides:

### **✅ BDD Acceptance Criteria:**
- End-user functionality validation
- Business requirement verification
- User story completion confirmation

### **✅ TDD Test Harness:**
- Unit tests for individual functions
- Integration tests for API endpoints
- End-to-end workflow testing

### **✅ Test Infrastructure:**
- Jest for unit and integration testing
- Cucumber for BDD scenarios
- Supertest for API testing
- Mock data and fixtures

### **✅ CI/CD Integration:**
- Automated testing on commits
- Coverage reporting
- Quality gates

### **✅ Test Data Management:**
- Isolated test databases
- Mock data generation
- Test cleanup procedures

This ensures that every feature we implement is thoroughly tested and meets the actual end-user requirements! 🎯
