# Pre-Deployment Issues Report

**Date**: 2025-09-30
**Branch**: pre-deployment-review
**Status**: 🚨 CRITICAL ISSUES FOUND - DO NOT DEPLOY

## Critical Issues (Blockers)

### 1. Missing Dependencies ❌
**Severity**: CRITICAL
**Impact**: TypeScript compilation will fail, deployment will fail

Missing packages in `package.json`:
- `@vercel/node` - Required for Vercel Request/Response types
- `@sentry/node` - Required for error tracking (T074)
- `@anthropic-ai/sdk` - Required for Anthropic AI fallback

**Files Affected**:
- `api/health.ts`
- `api/alerts.ts`
- `api/lib/sentry.ts`
- `api/middleware/*.ts`
- `api/v1/hugo/chat.ts`

**Fix Required**:
```bash
npm install --save @vercel/node @sentry/node @anthropic-ai/sdk
```

### 2. TypeScript Compilation Errors ❌
**Severity**: CRITICAL
**Impact**: Deployment will fail

30+ TypeScript errors found, primarily:
- Missing type declarations for `@vercel/node`
- Missing type declarations for `@sentry/node`
- Type mismatches in database operations
- Supabase type conflicts (duplicate `Database` export)

**Must Fix Before Deployment**

### 3. Supabase Type Export Conflict ❌
**Severity**: HIGH
**Impact**: TypeScript compilation fails

File: `api/config/supabase.ts:269`
Error: `Export declaration conflicts with exported declaration of 'Database'`

The `Database` type is being exported twice.

## Major Issues (Should Fix)

### 4. Database Migrations Not Applied ⚠️
**Severity**: HIGH
**Impact**: API calls will fail due to missing tables

Remote Oriva 101 database is missing 11 migrations (T001-T011):
- Tables: users, apps, conversations, messages, knowledge_bases, knowledge_entries, personality_schemas, user_progress, user_memories
- RLS policies
- Prepared statements

**Fix Required**:
```bash
supabase db push --linked
```

### 5. 20 console.log Statements ⚠️
**Severity**: MEDIUM
**Impact**: Performance overhead, log noise in production

Should be replaced with proper logging (winston) or removed.

### 6. 2 TODO/FIXME Comments ⚠️
**Severity**: LOW
**Impact**: Incomplete implementations

Should be reviewed and completed before production.

## Configuration Issues (Fixed)

### 7. vercel.json Configuration ✅ FIXED
**Issues Found**:
- Deprecated `name` property
- Invalid `analytics` property
- Invalid `speedInsights` property
- Wrong routes (missing `/hugo/` paths)

**Status**: Fixed in commit 2c88190

## Environment Variables Review

**Required for Production**:
```
SUPABASE_URL=<set in Vercel> ✅
SUPABASE_ANON_KEY=<set in Vercel> ✅
SUPABASE_SERVICE_ROLE_KEY=<set in Vercel> ✅
NODE_ENV=production ✅
OPENAI_API_KEY=<set in Vercel> (assumed)
```

**Optional but Recommended**:
```
SENTRY_DSN=<not set> ⚠️
ANTHROPIC_API_KEY=<not set> ⚠️
DB_POOL_MAX=20
DB_POOL_MIN=2
CORS_ORIGIN=<configured> ✅
```

## Deployment Readiness Checklist

- [x] Fix missing dependencies in package.json (@vercel/node, @sentry/node, @anthropic-ai/sdk installed)
- [x] Fix Supabase Database type export conflict (removed duplicate export)
- [x] Standardize table naming (all Hugo tables now use hugo_* prefix)
- [x] Update API code to use hugo_* table names
- [ ] **CRITICAL**: Apply database migrations manually via Supabase SQL Editor (migrations 20250114000006-20250114000011)
- [ ] Fix TypeScript compilation errors (requires updated types after migrations)
- [ ] Set SENTRY_DSN environment variable
- [ ] Set ANTHROPIC_API_KEY environment variable
- [ ] Review and fix/remove console.log statements
- [ ] Review and complete TODO comments
- [ ] Run full test suite
- [ ] Test TypeScript compilation locally

## Migration Status (Updated)

**Completed Changes:**
- ✅ Renamed all tables to hugo_* prefix for clarity
- ✅ Updated all API code to reference hugo_* tables
- ✅ Removed duplicate users table migration (using existing users table)
- ✅ Fixed SQL functions to reference correct table names

**Pending Manual Steps:**
- ⚠️ Migrations 20250114000006-20250114000011 need manual application via Supabase SQL Editor
- ⚠️ CLI migration history mismatch prevents automatic push
- ⚠️ After migrations applied, regenerate types: `supabase gen types typescript --linked > api/types/database.types.ts`

**Migration Files Ready:**
- `20250114000002_create_apps.sql` → hugo_apps ✅
- `20250114000003_create_conversations.sql` → hugo_conversations ✅
- `20250114000004_create_messages.sql` → hugo_messages ✅
- `20250114000005_create_knowledge_bases.sql` → hugo_knowledge_bases ✅
- `20250114000006_create_knowledge_entries.sql` → hugo_knowledge_entries (needs manual application)
- `20250114000007_create_personality_schemas.sql` → hugo_personality_schemas (needs manual application)
- `20250114000008_create_user_progress.sql` → hugo_user_progress (needs manual application)
- `20250114000009_create_user_memories.sql` → hugo_user_memories (needs manual application)
- `20250114000010_create_rls_policies.sql` (needs manual application)
- `20250114000011_create_prepared_statements.sql` (needs manual application)

## Recommended Actions

1. **IMMEDIATE**: Install missing dependencies
2. **IMMEDIATE**: Fix TypeScript compilation errors
3. **BEFORE DEPLOY**: Apply database migrations
4. **BEFORE DEPLOY**: Set Sentry and Anthropic API keys
5. **NICE TO HAVE**: Clean up console.log statements

## Estimated Time to Production Ready

- Critical fixes: 2-3 hours
- Testing & verification: 1 hour
- **Total**: ~4 hours

---

**Generated**: 2025-09-30
**Review Branch**: pre-deployment-review
**Next Steps**: Fix critical issues, then re-run review