# 🚀 Integrated Development Approach: New Endpoints + Testing

> **Pragmatic approach: Build new endpoints with testing from day one**

## 🎯 **Strategy: Test-Driven Development for New Endpoints**

### **Why This Approach Works:**
1. **Test first** → Forces us to think about the API design
2. **Build incrementally** → Each endpoint is tested before moving to the next
3. **Catch issues early** → Problems surface during development, not in production
4. **Documentation** → Tests serve as living documentation
5. **Confidence** → We know each endpoint works before building the next

---

## 🎯 **Phase 1: Set Up Testing Infrastructure (Day 1)**

### **Step 1: Install Testing Dependencies**
```bash
cd /Users/cosmic/Documents/oriva-platform
npm install --save-dev jest supertest
```

### **Step 2: Create Test Structure**
```bash
mkdir tests
mkdir tests/api
mkdir tests/mocks
mkdir tests/fixtures
```

### **Step 3: Configure Jest**
```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.js"],
    "collectCoverageFrom": [
      "api/**/*.js",
      "!api/node_modules/**"
    ]
  }
}
```

### **Step 4: Create Test Utilities**
```javascript
// tests/utils/testHelpers.js
const request = require('supertest');
const app = require('../../api/index');

const createTestRequest = (endpoint) => {
  return request(app).get(endpoint);
};

const withAuth = (req, apiKey = 'test_api_key') => {
  return req.set('Authorization', `Bearer ${apiKey}`);
};

module.exports = {
  createTestRequest,
  withAuth
};
```

---

## 🎯 **Phase 2: Test Existing Authentication (Day 1-2)**

### **Why Start Here:**
- **Foundation** → All new endpoints will use this
- **Regression protection** → Ensure we don't break existing auth
- **Pattern establishment** → Set the testing pattern for new endpoints

### **Test: API Key Validation**
```javascript
// tests/api/auth.test.js
const { createTestRequest, withAuth } = require('../utils/testHelpers');

describe('Authentication', () => {
  describe('API Key Validation', () => {
    test('should reject requests without API key', async () => {
      const response = await createTestRequest('/api/v1/user/me');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('API key required');
    });

    test('should reject invalid API keys', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        'invalid_key'
      );
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid API key');
    });

    test('should accept valid API keys', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/user/me'),
        'valid_test_key'
      );
      expect(response.status).toBe(200);
    });
  });
});
```

### **Run Tests to Ensure They Fail (Red)**
```bash
npm test
# Should fail - we need to implement the test setup
```

---

## 🎯 **Phase 3: Build Profile Endpoints with TDD (Day 3-5)**

### **Step 1: Write Failing Test (Red)**
```javascript
// tests/api/profiles.test.js
describe('Profile Endpoints', () => {
  describe('GET /api/v1/profiles/available', () => {
    test('should return authorized profiles only', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/profiles/available'),
        'valid_test_key'
      );
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only authorized profiles
      
      // Check data sanitization
      response.body.data.forEach(profile => {
        expect(profile).toHaveProperty('profileId');
        expect(profile).toHaveProperty('profileName');
        expect(profile).not.toHaveProperty('orivaProfileId'); // Sanitized
        expect(profile).not.toHaveProperty('userId'); // Sanitized
      });
    });

    test('should return 403 for unauthorized profile access', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/profiles/unauthorized_profile'),
        'valid_test_key'
      );
      
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied to this profile');
    });
  });
});
```

### **Step 2: Implement Minimal Code (Green)**
```javascript
// api/index.js - Add new endpoint
app.get('/api/v1/profiles/available', validateApiKey, async (req, res) => {
  try {
    // Get authorized profiles for this extension
    const authorizedProfiles = await getAuthorizedProfiles(req.keyInfo.id, req.keyInfo.userId);
    
    // Sanitize data
    const sanitizedProfiles = authorizedProfiles.map(profile => ({
      profileId: `ext_${profile.orivaProfileId.slice(-16)}`,
      profileName: profile.profileName,
      isActive: profile.isActive
    }));
    
    res.json({
      success: true,
      data: sanitizedProfiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profiles'
    });
  }
});
```

### **Step 3: Refactor (Refactor)**
```javascript
// Extract to service
class ProfileService {
  constructor(supabaseClient, orivaCoreClient) {
    this.db = supabaseClient;
    this.orivaCore = orivaCoreClient;
  }

  async getAuthorizedProfiles(extensionId, userId) {
    // Implementation
  }

  sanitizeProfileData(profiles) {
    return profiles.map(profile => ({
      profileId: `ext_${profile.orivaProfileId.slice(-16)}`,
      profileName: profile.profileName,
      isActive: profile.isActive
    }));
  }
}
```

---

## 🎯 **Phase 4: Build Group Endpoints with TDD (Day 6-8)**

### **Step 1: Write Failing Test (Red)**
```javascript
// tests/api/groups.test.js
describe('Group Endpoints', () => {
  describe('GET /api/v1/groups', () => {
    test('should return user groups with sanitized data', async () => {
      const response = await withAuth(
        createTestRequest('/api/v1/groups'),
        'valid_test_key'
      );
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      
      // Check data sanitization
      response.body.data.forEach(group => {
        expect(group).toHaveProperty('groupId');
        expect(group).toHaveProperty('groupName');
        expect(group).not.toHaveProperty('orivaGroupId'); // Sanitized
        expect(group).not.toHaveProperty('ownerId'); // Sanitized
      });
    });
  });
});
```

### **Step 2: Implement Code (Green)**
```javascript
// api/index.js - Add group endpoint
app.get('/api/v1/groups', validateApiKey, async (req, res) => {
  try {
    const groups = await getAuthorizedGroups(req.keyInfo.userId);
    const sanitizedGroups = sanitizeGroupData(groups);
    
    res.json({
      success: true,
      data: sanitizedGroups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch groups'
    });
  }
});
```

---

## 🎯 **Phase 5: Test Permission System (Day 9-10)**

### **Test: Profile Switching**
```javascript
// tests/api/profile-switching.test.js
describe('Profile Switching', () => {
  test('should switch active profile', async () => {
    const response = await withAuth(
      request(app).post('/api/v1/profiles/profile_123/activate'),
      'valid_test_key'
    );
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.activeProfile).toBe('profile_123');
  });

  test('should reject unauthorized profile switch', async () => {
    const response = await withAuth(
      request(app).post('/api/v1/profiles/unauthorized_profile/activate'),
      'valid_test_key'
    );
    
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Access denied to this profile');
  });
});
```

---

## 🎯 **Phase 6: Integration Testing (Day 11-12)**

### **Test: End-to-End Scenarios**
```javascript
// tests/integration/extension-workflow.test.js
describe('Extension Workflow', () => {
  test('complete profile switching workflow', async () => {
    // 1. Get available profiles
    const profilesResponse = await withAuth(
      createTestRequest('/api/v1/profiles/available'),
      'valid_test_key'
    );
    expect(profilesResponse.status).toBe(200);
    
    // 2. Switch to a profile
    const switchResponse = await withAuth(
      request(app).post(`/api/v1/profiles/${profilesResponse.body.data[0].profileId}/activate`),
      'valid_test_key'
    );
    expect(switchResponse.status).toBe(200);
    
    // 3. Verify profile is active
    const activeResponse = await withAuth(
      createTestRequest('/api/v1/profiles/active'),
      'valid_test_key'
    );
    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.data.profileId).toBe(profilesResponse.body.data[0].profileId);
  });
});
```

---

## 🎯 **Phase 7: Error Handling & Edge Cases (Day 13-14)**

### **Test: Error Scenarios**
```javascript
// tests/api/error-handling.test.js
describe('Error Handling', () => {
  test('should handle Oriva Core connection failure', async () => {
    // Mock Oriva Core failure
    mockOrivaCore.getProfile.mockRejectedValue(new Error('Connection failed'));
    
    const response = await withAuth(
      createTestRequest('/api/v1/profiles/available'),
      'valid_test_key'
    );
    
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('Service temporarily unavailable');
  });

  test('should handle malformed requests', async () => {
    const response = await withAuth(
      request(app).post('/api/v1/profiles/invalid_id/activate'),
      'valid_test_key'
    );
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid profile ID format');
  });
});
```

---

## 🎯 **Phase 8: Performance & Load Testing (Day 15)**

### **Test: Response Times**
```javascript
// tests/performance/response-times.test.js
describe('Performance', () => {
  test('profile endpoints should respond within 200ms', async () => {
    const start = Date.now();
    
    const response = await withAuth(
      createTestRequest('/api/v1/profiles/available'),
      'valid_test_key'
    );
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
    expect(response.status).toBe(200);
  });
});
```

---

## 🎯 **Development Workflow**

### **Daily Routine:**
1. **Write failing test** (Red)
2. **Implement minimal code** (Green)
3. **Refactor if needed** (Refactor)
4. **Run all tests** (Ensure nothing broke)
5. **Commit working code**

### **Test Commands:**
```bash
# Run all tests
npm test

# Run tests in watch mode (during development)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/api/profiles.test.js
```

### **Git Workflow:**
```bash
# Start new feature
git checkout -b feature/profile-endpoints

# Make changes, run tests
npm test

# Commit working code
git add .
git commit -m "Add profile endpoints with tests"

# Push and create PR
git push origin feature/profile-endpoints
```

---

## 🎯 **Benefits of This Approach**

### **✅ Immediate Benefits:**
1. **Confidence** → Each endpoint is tested before moving to the next
2. **Documentation** → Tests serve as living API documentation
3. **Regression protection** → Existing functionality stays working
4. **Design clarity** → Writing tests first clarifies the API design

### **✅ Long-term Benefits:**
1. **Maintainability** → Easy to refactor with test coverage
2. **Onboarding** → New developers can understand the API through tests
3. **Debugging** → Tests help isolate issues quickly
4. **Deployment confidence** → We know the code works before deploying

---

## 🎯 **Success Metrics**

### **Week 1:**
- [ ] Testing infrastructure set up
- [ ] Existing auth tests passing
- [ ] First profile endpoint with tests

### **Week 2:**
- [ ] All profile endpoints implemented and tested
- [ ] Group endpoints implemented and tested
- [ ] Permission system tested

### **Week 3:**
- [ ] Integration tests passing
- [ ] Error handling tested
- [ ] Performance benchmarks met

### **Week 4:**
- [ ] CI/CD pipeline set up
- [ ] All tests passing
- [ ] Ready for production deployment

---

## 🎯 **Next Steps**

1. **Set up testing infrastructure** (Day 1)
2. **Test existing authentication** (Day 1-2)
3. **Build profile endpoints with TDD** (Day 3-5)
4. **Build group endpoints with TDD** (Day 6-8)
5. **Test permission system** (Day 9-10)
6. **Integration testing** (Day 11-12)
7. **Error handling & edge cases** (Day 13-14)
8. **Performance testing** (Day 15)

This approach ensures we **build quality code from day one** while maintaining the **pragmatic, industry-standard approach** we discussed! 🚀
