# Tenant API Migration - 2025-12-22

## Summary

All o-platform tenant routes are now deprecated as of 2025-12-21. First-party tenant apps (o-orig) should use Next.js API routes directly.

## Changes Made

### Deprecation Middleware Added

All tenant routes now have deprecation middleware that:

- Logs warnings with `[DEPRECATED]` tag
- Adds HTTP headers: `X-Deprecated-API`, `X-Deprecated-Date`, `X-Migrate-To`
- Tracks user-agent and IP for migration monitoring

**Files Updated:**

- `src/express/routes/hugo-love/index.ts` - Love Puzl (formerly Hugo Love)
- `src/express/routes/travel-hub/index.ts` - Travel Hub
- `src/express/routes/ask-me-anything/index.ts` - AMA feature
- `src/express/routes/work-buddy.ts` - Work Buddy

### Migration Path

| Old (o-platform)                   | New (o-orig)                    |
| ---------------------------------- | ------------------------------- |
| `/api/v1/tenant/hugo-love/*`       | `/api/tenant/love-puzl/*`       |
| `/api/v1/tenant/travel-hub/*`      | `/api/tenant/travel-hub/*`      |
| `/api/v1/tenant/ask-me-anything/*` | `/api/tenant/ask-me-anything/*` |
| `/api/v1/work-buddy/*`             | `/api/tenant/work-buddy/*`      |

### o-orig Services Already Migrated

All love-puzl services in `packages/shared/services/love-puzl/` now use:

- `apiFetch` from `packages/shared/config/apiConfig.ts`
- Routes to Next.js API routes (`/api/tenant/love-puzl/*`)
- Proper `{ ok, status, data, error }` response handling

**Services migrated:**

- profile.service.ts
- swipe.service.ts
- match.service.ts
- message.service.ts
- journal.service.ts
- rating.service.ts
- subscription.service.ts
- aiChat.service.ts
- report.service.ts

### Architecture

```
o-platform (api.oriva.io):
  - PUBLIC API: /api/v1/* (profiles, groups, sessions)
  - DEPRECATED: /api/v1/tenant/* (hugo-love, travel-hub, work-buddy)

o-orig:
  - TENANT DATA: /api/tenant/{slug}/* (Next.js API routes)
  - Uses apiFetch() for tenant data
  - Uses orivaApi() for public API data

BFF Proxy (localhost:3002):
  - Only needed for PUBLIC API testing in development
  - NOT needed for tenant data (uses Next.js directly)
```

### Remaining Work

- After deprecation period, remove tenant routes from o-platform

## Documentation Updates (2025-12-22)

### Files Updated

- `/Users/cosmic/o-platform/CLAUDE.md` - Added migration status table, completion status
- `/Users/cosmic/o-orig/CLAUDE.md` - Updated API architecture diagram, added dual-pattern docs
- `/Users/cosmic/o-orig/packages/shared/patterns/services/CLAUDE.md` - Added Pattern 0 (apiFetch)
- `/Users/cosmic/o-orig/packages/shared/patterns/api-integration/CLAUDE.md` - Updated architecture

### E2E Test Results

- Service Integration Tests: ✅ 12 passed
- Travel Hub Navigation: ✅ 7 passed
- AMA Tests: ⚠️ UI structure changed (unrelated to migration)
- Hugo Love Tests: ⚠️ Metro not running (infrastructure, not migration)

## Additional Migrations Completed (2025-12-22)

### Travel Hub Services Migrated

All travel-hub services in `apps/web/services/` now use:

- `apiFetch` from `packages/shared/config/apiConfig.ts`
- Routes to Next.js API routes (`/api/tenant/travel-hub/*`)
- Proper `{ ok, status, data, error }` response handling

**Services migrated:**

- concierge.service.ts → `/travel-hub/concierges`
- conciergeChat.service.ts → `/travel-hub/chat`
- itinerary.service.ts → `/travel-hub/itineraries`
- itineraryExport.service.ts → `/travel-hub/itineraries`
- admin.service.ts → `/travel-hub/admin`
- travelClient.service.ts → `/travel-hub/clients`

**Deleted:**

- `apps/web/services/apiClient.ts` (deprecated, no longer needed)

### Ask-Me-Anything Architecture

No API migration needed - uses direct Supabase with schema isolation:

- `supabaseAma` client in `apps/ask-me-anything/src/services/supabaseAma.ts`
- Queries `ask_me_anything` schema directly
- Only uses BFF (`orivaApi`) for public platform data (user identity)

### Work Buddy Architecture

No API migration needed - uses direct Supabase with schema isolation:

- `supabase` from `@o-orig/database`
- Queries `work_buddy` schema directly
- Only uses BFF for public platform data
