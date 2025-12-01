# 3rd Party Tenant App Authentication Architecture

## Date: 2025-11-30

## Key Discoveries from o-platform Analysis

### Authentication Flow for 3rd Party Apps

3rd party tenant apps (like Travel Hub Admin) authenticate via o-platform Public API:

1. **Tenant Identification**: `X-API-Key: oriva_pk_xxx` header
2. **User Authentication**: `Authorization: Bearer <jwt>` header
3. **Middleware Chain**: `requireApiKey` → `requireAuth` → `requireAppAccess`

### Critical Architecture Points

- **BFF is development-only** - Not for production
- **3rd party apps only have tenant API key** - No direct Supabase credentials
- **All authentication goes through o-platform Public API**
- **JWT tokens come from Supabase Auth SDK** - Client-side authentication

### Key Endpoints

- `/api/v1/travel-hub/admin/me` - Get admin context, role, permissions
- `/api/v1/travel-hub/concierges/me` - Current user's concierge profile
- `/api/v1/apps/profiles` - Generic profile operations
- `/api/v1/hugo-love/profiles/me` - App-specific profile endpoints

### o-platform Middleware (`src/express/middleware/auth.ts`)

```typescript
// API Key validation
export const requireApiKey = async (req, res, next) => {
  const apiKey = req.header('X-API-Key');
  // Must start with 'oriva_pk_'
  // Hashed with SHA-256, validated against developer_api_keys table
};

// User JWT authentication
export const requireAuth = async (req, res, next) => {
  const token = req.header('Authorization').substring(7);
  // Verifies with Supabase auth
  // Loads user from oriva_platform.users
};

// App access check
export const requireAppAccess = async (req, res, next) => {
  // Checks user_app_access table
};
```

## Fixes Applied Today

### 1. Admin Layout undefined variable (layout.tsx:71)

```typescript
// Before (broken - currentProfile not defined)
const userEmail = supabaseUser?.email || currentProfile?.email || '';

// After (fixed)
const userEmail = supabaseUser?.email || '';
```

### 2. Profile interface missing email field

Added `email?: string` to:

- `apps/web/contexts/ProfileContext.tsx` - Profile interface
- `packages/shared/hooks/useOrivaProfiles.ts` - OrivaProfile interface

Also updated normalization to include email from API response.

## Authentication Chicken-and-Egg Problem (To Address)

The admin layout uses:

1. Direct Supabase auth (`supabase.auth.getSession()`) for `supabaseUser`
2. `OrivaLoginButton` which uses `useProfile()` from `ProfileContext`
3. `ProfileContext` depends on `useAuth()` which uses BFF auth store

This creates a mismatch - for production 3rd party apps:

1. Use Supabase Auth SDK to authenticate user (get JWT)
2. Call o-platform API with `X-API-Key` + `Authorization: Bearer` headers
3. Use `/api/v1/travel-hub/admin/me` to verify admin access

The current implementation works for dev (BFF) but needs adjustment for production.
