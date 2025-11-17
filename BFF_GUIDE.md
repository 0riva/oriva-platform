# BFF (Backend-For-Frontend) Setup Guide

**Last Updated**: 2025-11-17
**Canonical Port**: **3002** (NEVER use 3001)

---

## 🎯 What is the BFF?

The BFF (Backend-For-Frontend) is a **Node.js Express proxy** that:

- Runs on **port 3002**
- Sits between mobile apps (o-orig, o-core) and Production Supabase
- Handles JWT injection for RLS (Row-Level Security)
- Provides `/api/v1/*` REST endpoints

**Architecture**:

```
o-orig (Metro:8084) → BFF Proxy (:3002) → Production Supabase
```

---

## ⚡ Quick Start (5 Minutes)

### 1. Start BFF

```bash
cd /Users/cosmic/o-platform
npm run dev
```

### 2. Verify

```bash
curl http://localhost:3002/health
# OR run automated verification:
./scripts/verify-bff-setup.sh
```

### 3. Start o-orig

```bash
cd /Users/cosmic/o-orig
npm start
```

**That's it!** The app should now load real profiles.

---

## 🔧 Configuration

### Environment Variables (Priority Order)

1. **Shell environment** (HIGHEST - overrides everything!)
2. `.env.local` (local overrides)
3. `.env` (production defaults) ✅ **RECOMMENDED SOURCE**

### Current Setup (Correct)

**File**: `/Users/cosmic/o-platform/.env`

```bash
SUPABASE_URL=https://cbzgvlkizkdfjmbrosav.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<production-key>
DEV_USER_ID=b5e9e6c9-e319-425a-b370-98bbd997bbf9
PORT=3002
```

**File**: `/Users/cosmic/o-platform/.env.local`

```bash
# All Supabase vars COMMENTED OUT to use .env defaults
# SUPABASE_URL=http://127.0.0.1:54341  # ❌ COMMENTED
```

**File**: `/Users/cosmic/o-platform/package.json`

```json
{
  "scripts": {
    "dev": "env -u SUPABASE_URL -u EXPO_PUBLIC_SUPABASE_URL -u SUPABASE_ANON_KEY -u EXPO_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY ts-node -r dotenv/config api/index.ts"
  }
}
```

> **Why `env -u`?** Your shell has `SUPABASE_URL=http://127.0.0.1:54341` set (probably in `.zshrc`). The `env -u` unsets these vars so dotenv can load production values from `.env`.

---

## 🚨 Common Issues & Fixes

### Issue 1: "My Profile" instead of real profiles

**Cause**: BFF connected to empty local database instead of production

**Fix**:

1. Check BFF startup logs for: `supabaseUrlValue: 'https://cbzgvlkizkdfjmbrosav.s...'`
2. If showing `http://127.0.0.1:54341`, your shell env is overriding
3. Find and remove `export SUPABASE_URL=...` from your `.zshrc`/`.bashrc`
4. Restart BFF

### Issue 2: Port 3001 vs 3002 confusion

**Cause**: Old code/docs referenced port 3001

**Fix**: Port **3002** is canonical. We've fixed:

- ✅ `o-orig/scripts/verify-bff-ready.js` → port 3002
- ✅ `o-orig/.env.local` → `API_URL=http://127.0.0.1:3002`
- ✅ All o-platform configs → port 3002

### Issue 3: BFF not starting

**Symptoms**:

```
Error: Missing SUPABASE_URL environment variable
```

**Fix**:

```bash
# Check .env file exists and has production URL
cat .env | grep SUPABASE_URL

# Should show:
# SUPABASE_URL=https://cbzgvlkizkdfjmbrosav.supabase.co

# If missing, copy from .env.production or contact team
```

### Issue 4: Metro can't find BFF

**Symptoms**: o-orig startup says "BFF proxy not responding"

**Fix**:

```bash
# 1. Kill any stray processes
lsof -ti :3002 | xargs kill -9

# 2. Start BFF FIRST
cd /Users/cosmic/o-platform && npm run dev

# 3. Verify it's running
curl http://localhost:3002/health

# 4. Then start o-orig
cd /Users/cosmic/o-orig && npm start
```

---

## 📋 Verification Checklist

Run this script to verify everything is correct:

```bash
cd /Users/cosmic/o-platform
./scripts/verify-bff-setup.sh
```

**Expected output**:

```
✅ ROOT .env exists with PORT=3002
✅ api/.env does not exist (correct)
✅ api/index.ts has correct fallback (3002)
✅ No hardcoded 3001 references in code
✅ BFF is running on port 3002
✅ Health endpoint responding: status=healthy
✅ o-orig .env.local uses port 3002
✅ o-core .env.local uses port 3002
```

---

## 🗂️ File Ownership

| File/Directory             | Owner Repo | Purpose                        |
| -------------------------- | ---------- | ------------------------------ |
| BFF Server (`api/*`)       | o-platform | Main BFF implementation        |
| Port 3002                  | o-platform | BFF listens here               |
| `/api/v1/*` endpoints      | o-platform | REST API routes                |
| `.env` (production config) | o-platform | Production Supabase connection |
| `verify-bff-ready.js`      | o-orig     | Startup check before Metro     |
| `.env.local` (`API_URL`)   | o-orig     | Points to BFF on 3002          |

---

## 🧹 Cleanup Completed (2025-11-17)

**Deleted**:

- ❌ `o-orig/api-proxy-server.js` (old duplicate proxy)
- ❌ `o-orig/local-api-proxy.js` (deprecated proxy)

**Archived** (moved to `docs/archive/`):

- `BFF_FIX_COMPLETE.md`
- `BFF_IMPLEMENTATION_SUMMARY.md`
- `HUGO_LOVE_BFF_IMPLEMENTATION_SUMMARY.md`
- `HUGO_LOVE_PHASE_2_6_BFF_SUMMARY.md`
- `BFF_ARCHITECTURE_AUDIT_AND_FIX.md`

**Active Docs** (keep these):

- `BFF_GUIDE.md` ← **YOU ARE HERE (authoritative source)**
- `BFF_QUICK_START.md` (quick reference)
- `BFF_PROXY_GUIDE.md` (detailed technical docs)
- `scripts/verify-bff-setup.sh` (automated verification)

---

## 🔮 Future Improvements

### High Priority

- [ ] Remove `SUPABASE_URL` from your shell RC files (`.zshrc`/`.bashrc`)
- [ ] Document DEV_USER_ID switching workflow
- [ ] Add pre-commit hook to prevent port 3001 references

### Medium Priority

- [ ] Migrate from dotenv to structured config loader
- [ ] Add Docker compose for full local stack
- [ ] Implement BFF health monitoring

### Low Priority

- [ ] Consolidate remaining Hugo-specific BFF docs
- [ ] Add integration test suite for BFF endpoints

---

## 📞 Support

**Having issues?**

1. Run: `./scripts/verify-bff-setup.sh`
2. Check BFF logs: Look for "supabaseUrlValue" in startup output
3. Verify port 3002 is free: `lsof -i :3002`
4. Review this guide's troubleshooting section

**Critical reminder**:

- ✅ Always use port **3002**
- ❌ Never use port 3001
- ✅ BFF must start BEFORE o-orig
- ❌ Never run multiple BFF instances

---

## 📚 Related Documentation

- `BFF_QUICK_START.md` - 5-minute setup
- `BFF_PROXY_GUIDE.md` - Detailed technical reference
- `CLAUDE.md` - Project-wide BFF references
- `docs/hugo-love-bff-integration.md` - Hugo Love specific patterns
