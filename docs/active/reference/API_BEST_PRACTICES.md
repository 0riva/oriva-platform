# API Development Best Practices

**Purpose**: Clean code principles and industry standards for API development in Oriva Platform

## 🎯 Core Principles

### Single Responsibility Principle (SRP)
Break down endpoints into focused middleware functions:

```javascript
// ✅ Good: Separated concerns
app.post('/api/v1/profiles/:id/activate',
  validateApiKey,
  validateProfileAccess,
  fetchProfileFromOrivaCore,
  updateActiveProfile,
  sanitizeProfileData,
  sendResponse
);

// ❌ Bad: One function doing everything
app.post('/api/v1/profiles/:id/activate', async (req, res) => {
  // Validate API key + Check permissions + Fetch profile + Update + Sanitize + Send response
});
```

### Dependency Injection
Make dependencies explicit for testability:

```javascript
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
```

### Centralized Error Handling

```javascript
class APIError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const errorHandler = (err, req, res, next) => {
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
};
```

## 🏗️ API Design Standards

### RESTful Endpoints
```javascript
// ✅ Good: RESTful design
GET    /api/v1/profiles              // List profiles
GET    /api/v1/profiles/{id}         // Get specific profile
POST   /api/v1/profiles/{id}/activate // Action on profile
GET    /api/v1/groups/{id}/members   // Nested resource

// ❌ Bad: Non-RESTful
GET    /api/v1/getProfiles
POST   /api/v1/switchProfile
```

### Consistent Response Format
```javascript
// Success response
{
  "success": true,
  "data": { /* actual data */ },
  "meta": {
    "timestamp": "2024-01-15T10:00:00Z",
    "version": "1.0.0"
  }
}

// Error response
{
  "success": false,
  "error": "Profile not found",
  "code": "PROFILE_NOT_FOUND"
}
```

### Input Validation Middleware
```javascript
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

## 🧪 Testing Strategy (80/20 Rule)

### What to Test
- **Authentication & Authorization** (critical path)
- **Data validation** (user input)
- **Business logic** (core functionality)
- **Error conditions** (edge cases)

### What NOT to Test
- Simple CRUD operations without business logic
- Framework code (Express, Supabase)
- Third-party libraries

### Test Structure
```javascript
describe('Profile API', () => {
  describe('Authentication', () => {
    test('should reject requests without API key', async () => {
      const response = await request(app)
        .get('/api/v1/profiles/available');

      expect(response.status).toBe(401);
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

## 🔒 Security Implementation

### API Key Validation
```javascript
const validatePlatformAPIKey = async (req, res, next) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    const extensionId = req.headers['x-extension-id'];

    if (!apiKey || !extensionId) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key or extension ID'
      });
    }

    const keyData = await validateAPIKey(apiKey);
    if (!keyData || keyData.extension_id !== extensionId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key or extension ID mismatch'
      });
    }

    req.keyData = keyData;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
```

### Data Sanitization
```javascript
const sanitizeProfileData = (profile) => {
  return {
    oriva_profile_id: profile.id,
    profile_name: profile.name,
    is_active: profile.is_active,
    created_at: profile.created_at,
    updated_at: profile.updated_at
  };
};
```

## ⚡ Performance Standards

### Response Time Targets
- Profile endpoints: < 200ms
- Group endpoints: < 300ms
- Permission endpoints: < 150ms

### Caching Strategy
- Cache permission data for 5 minutes
- Cache profile/group data for 1 minute
- Invalidate cache on permission changes

## 📋 Common Mistakes to Avoid

### ❌ Over-Engineering
- Complex BDD with Cucumber for simple APIs
- Multiple testing frameworks
- Over-mocking everything

### ❌ Under-Testing
- Skipping authentication tests
- Ignoring error conditions
- Missing data validation tests

### ❌ Poor API Design
- Inconsistent response formats
- Ignoring HTTP status codes
- Exposing internal implementation details

## 🚀 Implementation Workflow

### TDD for APIs
1. **Write failing test** for expected behavior
2. **Write minimal code** to pass the test
3. **Refactor** if needed while keeping tests green

### Acceptance Criteria Template
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

## 📊 Quality Gates

Before merging API changes:
- [ ] All tests pass
- [ ] Code coverage > 80% for new code
- [ ] Performance requirements met
- [ ] Security validation complete
- [ ] Documentation updated

---

**Related**: [API_PATTERNS.md](API_PATTERNS.md) | [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md) | [API_TROUBLESHOOTING.md](API_TROUBLESHOOTING.md)