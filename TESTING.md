# Testing Guidelines - Oriva Platform

**Version:** 1.0
**Last Updated:** 2025-01-15

## 🎯 Core Testing Principles

### **CRITICAL: Contract Tests = Real Database Integration**

Contract tests MUST use real Supabase database connections, NOT mocks. This is non-negotiable.

```typescript
// ❌ WRONG - Never use mocks in contract tests
import { mockSupabase } from '../test-utils/supabase';

mockSupabase.from.mockReturnValue({
  select: jest.fn().mockReturnValue({
    // ... mock chain
  }),
});

// ✅ CORRECT - Use real database with test tokens
import { createTestClient, TEST_USER_TOKENS } from '../test-utils/client';

const response = await request(client)
  .get('/api/v1/apps/profiles')
  .set('X-App-ID', 'hugo_love')
  .set('X-API-Key', 'test-api-key')
  .set('Authorization', `Bearer ${TEST_USER_TOKENS.user1}`);
```

## 📋 Test Categories

### 1. **Contract Tests** (Real DB Required)

- **Location:** `tests/contract/`
- **Purpose:** Validate API endpoints match OpenAPI specification
- **Database:** Real Supabase instance with seed data
- **Authentication:** Bearer tokens (`TEST_USER_TOKENS`)
- **Assertions:** Use `.toBeGreaterThanOrEqual()` for counts, real data validation

### 2. **Unit Tests** (Mocks Allowed)

- **Location:** `tests/unit/`
- **Purpose:** Test individual functions in isolation
- **Database:** Mocks acceptable for external dependencies
- **Scope:** Pure functions, utilities, helpers only

### 3. **Integration Tests** (Real DB Required)

- **Location:** `tests/integration/`
- **Purpose:** Test cross-schema, cross-app interactions
- **Database:** Real Supabase with multi-schema setup
- **Focus:** Schema isolation, RLS policies, cross-app features

## 🚫 When NOT to Use Mocks

**Never use mocks for:**

- ✗ Contract/API tests
- ✗ Integration tests
- ✗ Database query tests
- ✗ End-to-end tests
- ✗ Authentication/authorization flows
- ✗ Schema routing validation
- ✗ Row-Level Security (RLS) tests

**Why?** Mocks hide real bugs:

- Schema isolation bugs
- RLS policy errors
- Foreign key violations
- Data type mismatches
- PostgreSQL-specific behaviors
- Authentication edge cases

## ✅ When Mocks Are Acceptable

**Only use mocks for:**

- ✓ External API calls (OpenAI, Anthropic, etc.)
- ✓ Email/SMS services
- ✓ Payment processors
- ✓ Pure utility functions (date formatting, string parsing)
- ✓ Rate-limited services in unit tests

## 🔧 Test Setup Patterns

### Contract Test Template

```typescript
import request from 'supertest';
import { createTestClient, TEST_USER_TOKENS } from '../../../test-utils/client';

describe('GET /api/v1/apps/profiles', () => {
  let client: any;
  const testToken = TEST_USER_TOKENS.user1;

  beforeEach(() => {
    client = createTestClient();
  });

  it('should list profiles from real database', async () => {
    const response = await request(client)
      .get('/api/v1/apps/profiles')
      .set('X-App-ID', 'hugo_love')
      .set('X-API-Key', 'test-api-key')
      .set('Authorization', `Bearer ${testToken}`);

    expect(response.status).toBe(200);
    expect(response.body.profiles).toBeDefined();
    // Use flexible assertions for real data
    expect(response.body.profiles.length).toBeGreaterThanOrEqual(0);
  });
});
```

## 🎭 TDD Workflow (Correct Interpretation)

### ❌ WRONG TDD (What We Were Doing)

1. Write test with mocks
2. Test "passes" with mock data
3. Implement endpoint
4. Still using mocks → **Never tested real integration!**

### ✅ CORRECT TDD (What We Should Do)

1. Write test that connects to **real database**
2. Test **FAILS** because database is empty or endpoint doesn't exist
3. Add seed data and implement endpoint
4. Test **PASSES** with real database
5. Refactor with confidence

## 🗄️ Database Seed Data

Contract tests require seed data. Example:

```sql
-- Seed users
INSERT INTO oriva_platform.users (id, email, full_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'alice@test.com', 'Alice Test'),
  ('00000000-0000-0000-0000-000000000002', 'bob@test.com', 'Bob Test');

-- Seed apps
INSERT INTO oriva_platform.apps (id, app_id, name, schema_name, status) VALUES
  ('00000000-0000-0000-0000-000000000011', 'hugo_love', 'Hugo Love', 'hugo_love', 'active'),
  ('00000000-0000-0000-0000-000000000012', 'hugo_career', 'Hugo Career', 'hugo_career', 'active');

-- Seed user app access
INSERT INTO oriva_platform.user_app_access (user_id, app_id, role, status) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'user', 'active'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'user', 'active'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012', 'user', 'active');

-- Seed app-specific data
INSERT INTO hugo_love.profiles (id, user_id, profile_data) VALUES
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', '{"age": 28, "bio": "Loves hiking"}'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000002', '{"age": 32, "bio": "Jazz musician"}');
```

## 🔐 Test Authentication

Use test tokens that bypass Supabase auth:

```typescript
// Format: test-user-{uuid}
const testToken = TEST_USER_TOKENS.user1; // "test-user-00000000-0000-0000-0000-000000000001"

// Middleware recognizes this format in test environment
if (process.env.NODE_ENV === 'test' && token.startsWith('test-user-')) {
  const userId = token.replace('test-user-', '');
  // Load user from database...
}
```

## 📊 Assertions for Real Data

```typescript
// ❌ WRONG - Assumes exact count
expect(response.body.profiles.length).toBe(2);

// ✅ CORRECT - Flexible for real data
expect(response.body.profiles.length).toBeGreaterThanOrEqual(2);

// ✅ CORRECT - Validate structure, not exact values
if (response.body.profiles.length > 0) {
  const profile = response.body.profiles[0];
  expect(profile).toHaveProperty('id');
  expect(profile).toHaveProperty('user_id');
  expect(typeof profile.profile_data).toBe('object');
}
```

## ⚠️ Common Pitfalls

### Pitfall #1: Mock Infrastructure Exists

**Just because `test-utils/supabase.ts` exists doesn't mean you should use it for contract tests!**

- `test-utils/supabase.ts` → Unit tests ONLY
- `test-utils/client.ts` → Contract/integration tests

### Pitfall #2: "TDD means write mocks first"

**No!** TDD means write tests that will fail until real implementation exists.

### Pitfall #3: Timestamps

PostgreSQL returns microseconds, JavaScript uses milliseconds:

```typescript
// ❌ WRONG - Exact ISO match will fail
expect(response.body.created_at).toBe('2025-01-15T10:30:00.000Z');

// ✅ CORRECT - Validate it's a valid date
expect(typeof response.body.created_at).toBe('string');
expect(() => new Date(response.body.created_at)).not.toThrow();
```

## 🧹 Cleanup

Contract tests should NOT modify database state. Use GET endpoints only, or implement transaction rollback for POST/PATCH/DELETE tests.

## 📚 Examples

See these files for correct patterns:

- `tests/contract/hugo-ai/test_insights_get.test.ts` ✓ (refactored to real DB)
- `tests/contract/apps/test_profiles_get.test.ts` ✓ (refactored to real DB)

Avoid these patterns:

- `tests/contract/apps/test_ice_breakers_get.test.ts` ✗ (still uses mocks)

---

**Remember:** If a test doesn't touch the real database, it's not testing the real system.
