# BFF Troubleshooting Checklist

**Quick diagnostics for BFF (Backend-For-Frontend) issues**

---

## 🚨 Problem: ProfileSelector shows "My Profile"

### Diagnosis

```bash
# 1. Check what Supabase URL the BFF is using
cd /Users/cosmic/o-platform
lsof -i :3002  # Get PID
# Look in startup logs for: "supabaseUrlValue: 'https://cbzgvlkizkdfjmbrosav.s...'"
```

### Expected

```
supabaseUrlValue: 'https://cbzgvlkizkdfjmbrosav.s...'  ✅ PRODUCTION
```

### If you see

```
supabaseUrlValue: 'http://127.0.0.1:54341...'  ❌ LOCAL (WRONG)
```

### Fix

Your shell environment is overriding `.env`:

```bash
# 1. Check your shell environment
echo $SUPABASE_URL

# 2. Find where it's set (usually .zshrc or .bashrc)
grep -n "SUPABASE_URL" ~/.zshrc ~/.bashrc 2>/dev/null

# 3. Comment out or remove that line

# 4. Reload shell or restart terminal

# 5. Restart BFF
cd /Users/cosmic/o-platform
lsof -ti :3002 | xargs kill -9
npm run dev
```

---

## 🚨 Problem: BFF won't start

### Diagnosis

```bash
npm run dev
# Look for error message
```

### Error: "Missing SUPABASE_URL"

**Fix:**

```bash
# Check .env file exists
cat .env | grep SUPABASE_URL

# Should show production URL
# If missing, restore from git or ask team
```

### Error: "Port 3002 already in use"

**Fix:**

```bash
# Kill the process
lsof -ti :3002 | xargs kill -9

# Restart
npm run dev
```

---

## 🚨 Problem: o-orig can't connect to BFF

### Diagnosis

```bash
# Check if BFF is actually running
curl http://localhost:3002/health

# Check o-orig config
cat /Users/cosmic/o-orig/.env.local | grep API_URL
```

### Expected

```bash
# BFF health check should return:
{"status":"healthy"}

# o-orig should have:
EXPO_PUBLIC_API_URL=http://127.0.0.1:3002
```

### Fix

```bash
# 1. Start BFF FIRST
cd /Users/cosmic/o-platform && npm run dev

# 2. Verify it responds
curl http://localhost:3002/health

# 3. THEN start o-orig
cd /Users/cosmic/o-orig && npm start
```

---

## 🚨 Problem: Port confusion (3001 vs 3002)

### Quick Fix

**Port 3002 is CANONICAL**. Always use 3002.

### Files to check

```bash
# o-platform
grep -r "3001" . --include="*.ts" --include="*.js" --include="*.json" --exclude-dir=node_modules

# o-orig
grep -r "3001" . --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir=node_modules
```

All should show **3002**.

---

## 🔧 Automated Verification

```bash
cd /Users/cosmic/o-platform
./scripts/verify-bff-setup.sh
```

This checks:

- ✅ Correct port configurations
- ✅ No hardcoded 3001 references
- ✅ BFF is running
- ✅ Health endpoint responds
- ✅ Client configs point to correct port

---

## 📋 Pre-flight Checklist

Before starting development:

```bash
# 1. BFF running on 3002?
lsof -i :3002

# 2. BFF healthy?
curl http://localhost:3002/health

# 3. BFF using production DB?
# (check logs for "https://cbzgvlkizkdfjmbrosav")

# 4. o-orig configured for 3002?
grep "3002" /Users/cosmic/o-orig/.env.local
```

All checks pass? ✅ **You're good to go!**

---

## 🆘 Nuclear Option

If nothing works:

```bash
# 1. Kill everything
lsof -ti :3002 :8084 | xargs kill -9

# 2. Clear shell environment
unset SUPABASE_URL EXPO_PUBLIC_SUPABASE_URL

# 3. Fresh BFF start
cd /Users/cosmic/o-platform
npm run dev

# 4. Verify production connection
curl http://localhost:3002/api/v1/profiles/available | jq '.'
# Should show real profile names, NOT "My Profile"

# 5. Start o-orig
cd /Users/cosmic/o-orig
npm start
```

---

## 📞 Still Stuck?

1. Check `BFF_GUIDE.md` for detailed documentation
2. Run `./scripts/verify-bff-setup.sh` for automated diagnostics
3. Review startup logs for "supabaseUrlValue"
4. Verify `.env` file has production Supabase URL
