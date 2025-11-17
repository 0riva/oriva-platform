# BFF Proxy Quick Start (5-Minute Setup)

**Goal**: Get the BFF proxy running reliably in under 5 minutes.

---

## ✅ Prerequisites

- Node.js 18+ installed
- o-platform repository cloned
- .env file configured (should already exist)

---

## 🚀 Start BFF (3 Steps)

### Step 1: Navigate to o-platform

```bash
cd /Users/cosmic/o-platform
```

### Step 2: Start the BFF

```bash
npm run dev
```

### Step 3: Verify it's working

```bash
curl http://localhost:3002/health
```

**Expected response:**

```json
{
  "status": "ok",
  "timestamp": "2025-11-17T..."
}
```

---

## ✅ Success Indicators

When BFF starts successfully, you'll see:

```
🚀 Oriva Platform API
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Base URL: http://localhost:3002
❤️  Health Check: http://localhost:3002/health
🔧 API Test: http://localhost:3002/api/v1/test
👤 User API: http://localhost:3002/api/v1/user/me
🏪 Marketplace: http://localhost:3002/api/v1/marketplace/apps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 Ready for development! Try: curl http://localhost:3002/health
```

**Key**: Port must be **3002** (not 3001).

---

## 🔧 Test Endpoints

Once running, test key endpoints:

### Health Check

```bash
curl http://localhost:3002/health
```

### Profiles (DEV_USER_ID)

```bash
curl http://localhost:3002/api/v1/profiles/available
```

### Marketplace Apps

```bash
curl http://localhost:3002/api/v1/marketplace/apps
```

---

## 🚨 Troubleshooting

### "Port 3002 already in use"

**Fix:**

```bash
lsof -ti :3002 | xargs kill -9
npm run dev
```

### "Connection refused"

**Diagnosis:**

```bash
lsof -i :3002
```

**Fix:**

- If nothing listening: BFF isn't running → `npm run dev`
- If wrong process: Kill and restart → `lsof -ti :3002 | xargs kill -9 && npm run dev`

### "Environment variable not found"

**Check .env exists:**

```bash
ls -la /Users/cosmic/o-platform/.env
```

**Verify PORT is set:**

```bash
grep PORT /Users/cosmic/o-platform/.env
# Should show: PORT=3002
```

**Fix:**
If missing, create `.env` with:

```bash
PORT=3002
NODE_ENV=development
SUPABASE_URL=https://cbzgvlkizkdfjmbrosav.supabase.co
# ... (copy from .env.example)
```

---

## 📊 Canonical Configuration

**Port**: 3002 (ALWAYS)
**Repository**: o-platform (ONLY)
**Start Command**: `npm run dev` (from o-platform root)

**DO NOT:**

- ❌ Run o-orig/local-api-proxy.js (deprecated)
- ❌ Use port 3001 (old/wrong)
- ❌ Run multiple BFF instances

**DO:**

- ✅ Run ONE BFF instance on port 3002
- ✅ Start from o-platform repository
- ✅ Verify with health check

---

## 🔗 Next Steps

Once BFF is running:

1. **o-core**: Connect at `http://localhost:3002`
   - Update `.env.local`: `EXPO_PUBLIC_API_BASE_URL=http://localhost:3002`

2. **o-orig**: Connect at `http://localhost:3002`
   - Update `.env.local`: `EXPO_PUBLIC_API_URL=http://127.0.0.1:3002`

3. **Verify**: Both apps should connect to BFF without errors

---

## 📝 Related Documentation

- [BFF_PROXY_GUIDE.md](./BFF_PROXY_GUIDE.md) - Complete BFF guide
- [BFF_ARCHITECTURE_AUDIT_AND_FIX.md](./BFF_ARCHITECTURE_AUDIT_AND_FIX.md) - Full audit and fix details
- [CLAUDE.md](./CLAUDE.md) - Repository overview

---

**Questions?** See troubleshooting section or full audit document.
