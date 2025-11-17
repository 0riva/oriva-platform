# Vercel Deployment Issue - Function Limit

**Date**: 2025-11-10  
**Issue**: Vercel Hobby plan limit (12 functions) exceeded

## Problem

Vercel is detecting **20 TypeScript files** in the `api/` directory and creating a serverless function for each, but the **Hobby plan only allows 12 functions**.

## Current Status

- ❌ Production deployment: **Failed** (too many functions)
- ❌ Preview deployment: **Failed** (too many functions)
- ✅ Last successful deployment: **40 days ago** (still working)

## Solutions

### Option 1: Upgrade Vercel Plan (Recommended - Quickest)

**Upgrade to Pro plan** ($20/month):

- Unlimited serverless functions
- No deployment restrictions
- Better performance and features

**Steps**:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your team/project
3. Go to **Settings** → **Billing**
4. Upgrade to **Pro plan**
5. Redeploy: `vercel --prod`

### Option 2: Consolidate API Files (Free, but requires code changes)

Reduce the number of API files to ≤12 by consolidating routes:

**Current files** (20):

- `api/index.ts` ✅ (main entry)
- `api/health.ts` ✅
- `api/v1/auth.ts` ✅ (NEW - password reset)
- `api/v1/hugo.ts`
- `api/v1/hugo-love.ts`
- `api/v1/integrations.ts`
- `api/v1/marketplace.ts`
- `api/affiliate/index.ts`
- `api/affiliate/resolve/[shortCode].ts`
- `api/advertising/serve.ts`
- `api/semantic/index.ts`
- `api/payments.ts`
- `api/workers.ts`
- ... (7 more)

**Consolidation strategy**:

1. Move all routes into `api/index.ts` (single function)
2. OR consolidate related routes (e.g., all v1 routes into one file)
3. OR move non-function files out of `api/` directory

**Estimated time**: 1-2 hours

### Option 3: Use Existing Deployment (Temporary)

The last successful deployment from 40 days ago is still working. The auth changes are in the code but not deployed yet.

**To deploy auth changes**:

- Must resolve function limit first (Option 1 or 2)

## Recommendation

**Upgrade to Pro plan** for immediate deployment. The $20/month cost is worth it for:

- Unlimited functions
- No deployment blockers
- Better performance
- Team features

## Next Steps

1. **If upgrading**: Run `vercel --prod` after upgrade
2. **If consolidating**: I can help consolidate the API files
3. **If using existing**: Auth changes won't be live until deployment succeeds

---

**Current Production URL**: `https://api.oriva.io`  
**Last Successful Deployment**: 40 days ago  
**Auth Changes Status**: Code ready, deployment blocked
