# 🚀 API Development Best Practices - Clean Code & Industry Standards

> **Pragmatic approach to API development with clean code principles and industry best practices**

## 🎯 **What Actually Matters for API Development**

### **❌ Over-Engineering (What I Initially Suggested):**
- Complex BDD with Cucumber (overkill for most APIs)
- Extensive test harnesses (unnecessary complexity)
- Multiple testing frameworks (maintenance burden)
- Complex CI/CD pipelines (premature optimization)

### **✅ Industry Best Practices (What Actually Works):**

---

## 🎯 **1. Clean Code Principles for APIs**

### **Single Responsibility Principle (SRP)**
```javascript
// ❌ Bad: One function doing too much
app.post('/api/v1/profiles/:id/activate', async (req, res) => {
  // Validate API key
  // Check permissions
  // Fetch profile from Oriva Core
  // Update active profile
  // Sanitize data
  // Send response
  // Log activity
});

// ✅ Good: Separated concerns
app.post('/api/v1/profiles/:id/activate', 
  validateApiKey,
  validateProfileAccess,
  fetchProfileFromOrivaCore,
  updateActiveProfile,
  sanitizeProfileData,
  sendResponse
);
```

### **Dependency Injection**
```javascript
// ✅ Good: Dependencies injected, easy to test
class ProfileService {
  constructor(orivaCoreClient, supabaseClient, sanitizer) {
    this.orivaCore = orivaCoreClient;
    this.db = supabaseClient;
    this.sanitizer = sanitizer;
  }

  async getProfile(userId, profileId) {
    const profile = await this.orivaCore.getProfile(userId, profileId);
    return this.sanitizer.sanitize(profile);
  }
}

// Easy to mock for testing
const mockOrivaCore = { getProfile: jest.fn() };
const mockSupabase = { from: jest.fn() };
const mockSanitizer = { sanitize: jest.fn() };
const service = new ProfileService(mockOrivaCore, mockSupabase, mockSanitizer);
```

### **Error Handling Strategy**
```javascript
// ✅ Good: Centralized error handling
class APIError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Middleware for error handling
const errorHandler = (err, req, res, next) => {
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  // Log unexpected errors
  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};
```

---

## 🎯 **2. Practical Testing Strategy**

### **What to Test (The 80/20 Rule)**
```javascript
// ✅ Test the important stuff:
// 1. Authentication & Authorization
// 2. Data validation
// 3. Business logic
// 4. Error conditions

// ❌ Don't over-test:
// - Simple CRUD operations
// - Framework code
// - Third-party libraries
```

### **Simple Test Structure**
```javascript
// tests/api/profiles.test.js
const request = require('supertest');
const app = require('../../api/index');

describe('Profile API', () => {
  describe('Authentication', () => {
    test('should reject requests without API key', async () => {
      const response = await request(app)
        .get('/api/v1/profiles/available');
      
      expect(response.status).toBe(401);
    });

    test('should reject invalid API keys', async () => {
      const response = await request(app)
        .get('/api/v1/profiles/available')
        .set('Authorization', 'Bearer invalid_key');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Authorization', () => {
    test('should only return authorized profiles', async () => {
      // Mock authorized profiles
      const response = await request(app)
        .get('/api/v1/profiles/available')
        .set('Authorization', 'Bearer valid_key');
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2); // Only authorized profiles
    });
  });

  describe('Data Sanitization', () => {
    test('should not expose internal IDs', async () => {
      const response = await request(app)
        .get('/api/v1/profiles/available')
        .set('Authorization', 'Bearer valid_key');
      
      response.body.data.forEach(profile => {
        expect(profile.profileId).toMatch(/^ext_[a-f0-9]{16}$/);
        expect(profile).not.toHaveProperty('orivaProfileId');
      });
    });
  });
});
```

### **Mock Strategy (Keep It Simple)**
```javascript
// tests/mocks/supabase.js
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ 
          data: { id: 'test', name: 'Test Profile' }, 
          error: null 
        }))
      }))
    }))
  }))
};

module.exports = mockSupabase;
```

---

## 🎯 **3. API Design Best Practices**

### **RESTful Design**
```javascript
// ✅ Good: RESTful endpoints
GET    /api/v1/profiles              // List profiles
GET    /api/v1/profiles/{id}         // Get specific profile
POST   /api/v1/profiles/{id}/activate // Action on profile
GET    /api/v1/groups                // List groups
GET    /api/v1/groups/{id}/members   // Nested resource

// ❌ Bad: Non-RESTful
GET    /api/v1/getProfiles
POST   /api/v1/switchProfile
GET    /api/v1/getGroupMembers
```

### **Consistent Response Format**
```javascript
// ✅ Good: Consistent response structure
{
  "success": true,
  "data": { /* actual data */ },
  "meta": {
    "timestamp": "2024-01-15T10:00:00Z",
    "version": "1.0.0"
  }
}

// Error responses
{
  "success": false,
  "error": "Profile not found",
  "code": "PROFILE_NOT_FOUND"
}
```

### **Input Validation**
```javascript
// ✅ Good: Input validation middleware
const validateProfileId = (req, res, next) => {
  const { orivaProfileId } = req.params;
  
  if (!orivaProfileId || !orivaProfileId.match(/^profile_[a-zA-Z0-9]+$/)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid profile ID format',
      code: 'INVALID_PROFILE_ID'
    });
  }
  
  next();
};
```

---

## 🎯 **4. Practical Development Workflow**

### **TDD for APIs (Simplified)**
```javascript
// 1. Write failing test
test('should return 404 for non-existent profile', async () => {
  const response = await request(app)
    .get('/api/v1/profiles/nonexistent')
    .set('Authorization', 'Bearer valid_key');
  
  expect(response.status).toBe(404);
});

// 2. Write minimal code to pass
app.get('/api/v1/profiles/:id', validateApiKey, async (req, res) => {
  const profile = await getProfile(req.params.id);
  if (!profile) {
    return res.status(404).json({ success: false, error: 'Profile not found' });
  }
  res.json({ success: true, data: profile });
});

// 3. Refactor if needed
```

### **Acceptance Criteria (Simple)**
```markdown
## Feature: Profile Switching

### Acceptance Criteria:
- [ ] Extension can switch between authorized profiles
- [ ] Profile switch is immediate and complete
- [ ] Unauthorized profile access returns 403
- [ ] Profile data is sanitized (no internal IDs)
- [ ] API responds within 200ms

### Test Cases:
1. Valid profile switch → 200 OK
2. Invalid profile ID → 400 Bad Request
3. Unauthorized profile → 403 Forbidden
4. Missing API key → 401 Unauthorized
```

---

## 🎯 **5. Industry-Standard Tools**

### **Testing Stack (Minimal)**
```json
{
  "devDependencies": {
    "jest": "^29.0.0",           // Test framework
    "supertest": "^6.0.0",      // API testing
    "nock": "^13.0.0"           // HTTP mocking
  }
}
```

### **Code Quality Tools**
```json
{
  "devDependencies": {
    "eslint": "^8.0.0",         // Code linting
    "prettier": "^2.0.0",       // Code formatting
    "husky": "^8.0.0",          // Git hooks
    "lint-staged": "^13.0.0"    // Pre-commit linting
  }
}
```

### **Simple CI/CD**
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run lint
```

---

## 🎯 **6. What NOT to Do (Common Mistakes)**

### **❌ Over-Engineering**
- Don't use Cucumber for simple APIs
- Don't create complex test harnesses
- Don't over-mock everything
- Don't write tests for framework code

### **❌ Under-Testing**
- Don't skip authentication tests
- Don't ignore error conditions
- Don't forget data validation tests
- Don't skip integration tests

### **❌ Poor API Design**
- Don't use inconsistent response formats
- Don't ignore HTTP status codes
- Don't expose internal implementation details
- Don't forget input validation

---

## 🎯 **7. Recommended Approach for Our Extension API**

### **Phase 1: Core Testing (Week 1)**
```bash
# Install minimal testing stack
npm install --save-dev jest supertest

# Create basic test structure
mkdir tests
mkdir tests/api
mkdir tests/mocks
```

### **Phase 2: Essential Tests (Week 2)**
```javascript
// Focus on these test categories:
1. Authentication tests (API key validation)
2. Authorization tests (profile/group access)
3. Data sanitization tests
4. Error handling tests
5. Basic integration tests
```

### **Phase 3: Code Quality (Week 3)**
```bash
# Add linting and formatting
npm install --save-dev eslint prettier husky lint-staged

# Configure pre-commit hooks
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

### **Phase 4: CI/CD (Week 4)**
```yaml
# Simple GitHub Actions workflow
# Run tests on every PR
# Deploy on main branch
```

---

## 🎯 **Summary: What Actually Matters**

### **✅ Do This:**
1. **Test the important stuff** (auth, validation, business logic)
2. **Use simple, focused tests** (Jest + Supertest)
3. **Follow RESTful conventions**
4. **Implement proper error handling**
5. **Use consistent response formats**
6. **Add input validation**
7. **Keep tests fast and reliable**

### **❌ Don't Do This:**
1. **Over-engineer testing** (Cucumber for simple APIs)
2. **Test framework code** (Express, Supabase)
3. **Create complex test harnesses**
4. **Ignore performance** (slow tests)
5. **Skip error conditions**
6. **Use inconsistent patterns**

### **🎯 The 80/20 Rule:**
- **20% of testing effort** covers **80% of bugs**
- Focus on **authentication, authorization, validation, and error handling**
- Keep tests **simple, fast, and maintainable**

This approach is **pragmatic, industry-standard, and actually works** for API development! 🚀
