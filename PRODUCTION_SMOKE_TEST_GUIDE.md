# Production Smoke Test Guide

**Date**: 2025-10-09
**Status**: iOS App Configured for Production
**Environment**: Production Supabase (cbzgvlkizkdfjmbrosav)

## Configuration Completed

### ✅ iOS App Configuration

- **Production URL**: `https://cbzgvlkizkdfjmbrosav.supabase.co`
- **Production Anon Key**: Configured
- **Build**: Debug build with production backend
- **File**: `Apps/HugoLove/HugoLove/Configuration/SupabaseConfig.swift:47`

### ✅ Backend Deployment

- **Edge Function**: chat-stream Version 4 (ACTIVE)
- **Deployed**: 2025-10-09 17:04:11 UTC
- **RLS Fix**: Applied and verified
- **Production URL**: `https://cbzgvlkizkdfjmbrosav.supabase.co/functions/v1/chat-stream`

## Smoke Test Procedure

### 1. Launch App

- ✅ App installed on iPhone 16e simulator
- ✅ App launches successfully
- ✅ Login screen displays

### 2. Skip Authentication (DEV Mode)

**Action**: Tap "Skip Login (DEV)" button
**Expected**: Navigate to main app interface (FotoFlash or tab bar)

### 3. Navigate to Chat

**Action**:

- If in single mode: Access "Speak to Hugo" floating button
- If in profile: Tap "Speak to Hugo" button

**Expected**: Chat interface opens

### 4. Send Test Message

**Action**: Type "Production test message" and send
**Expected**:

- Message displays in chat UI
- Streaming response from Hugo begins
- Response completes with "Done" indicator

### 5. Verify Production Backend

**Commands**:

```bash
# Check production database for new messages
supabase db remote --linked sql \
  "SELECT COUNT(*) as message_count, role
   FROM hugo_love.messages
   WHERE created_at > NOW() - INTERVAL '5 minutes'
   GROUP BY role;"

# Check Edge Function logs
# Visit: https://supabase.com/dashboard/project/cbzgvlkizkdfjmbrosav/logs/edge-functions
```

**Expected**:

- 1 user message in database
- 1 assistant message in database
- Edge Function logs show successful execution
- No errors in logs

## Success Criteria

### Critical (Must Pass)

- [ ] App connects to production Supabase URL
- [ ] Chat streaming works from production Edge Function
- [ ] User messages persist to production database
- [ ] Assistant messages persist to production database
- [ ] No authentication errors (DEV mode bypasses)

### Important (Should Pass)

- [ ] Streaming response smooth and complete
- [ ] Message timestamps correct
- [ ] No network timeouts
- [ ] Edge Function logs show proper execution

### Nice to Have

- [ ] RAG context included (requires OpenAI API key)
- [ ] Response uses TIC knowledge base
- [ ] Conversation context maintained

## Current Limitations

### 1. OpenAI API Key

**Status**: Placeholder key configured
**Impact**: RAG gracefully degrades, Hugo responds without TIC context
**Action**: Add real OpenAI key when ready for full functionality

### 2. Database Migration Sync

**Status**: Production and local migrations differ
**Impact**: None - Edge Function works with existing production schema
**Action**: Sync when needed for schema changes

### 3. JWT Authentication

**Status**: DEV mode bypasses authentication
**Impact**: Testing uses test user ID (00000000-0000-0000-0000-000000000001)
**Action**: Test real authentication flow before App Store

## Troubleshooting

### Issue: Chat doesn't connect

**Check**:

1. Verify SupabaseConfig.swift has production URL
2. Check app was rebuilt after config change
3. Verify Edge Function is ACTIVE in dashboard
4. Check device network connectivity

### Issue: Messages not persisting

**Check**:

1. RLS fix is applied (check index.ts:86-94)
2. Service role key is configured in production secrets
3. Check Edge Function logs for database errors
4. Verify hugo_love.messages table exists

### Issue: Streaming fails

**Check**:

1. Anthropic API key configured in production secrets
2. Edge Function not timing out (check logs)
3. Network request not blocked by firewall
4. Check iOS app logs for SSE parsing errors

## Next Steps After Smoke Test

### If Tests Pass ✅

1. Update iOS app back to local development (optional)
2. Document production endpoints for team
3. Set up production monitoring
4. Plan App Store submission

### If Tests Fail ❌

1. Check Edge Function logs for errors
2. Verify database schema in production
3. Test Edge Function directly with curl
4. Review iOS app network logs

## Verification Commands

### Test Production Edge Function Directly

```bash
curl -X POST "https://cbzgvlkizkdfjmbrosav.supabase.co/functions/v1/chat-stream" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDEwMjAsImV4cCI6MjA3MzYxNzAyMH0.GAqII3HLS7OKoKOWZxhfXhKEd55G1XpMPrM-MOJEdeg" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiemd2bGtpemtkZmptYnJvc2F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNDEwMjAsImV4cCI6MjA3MzYxNzAyMH0.GAqII3HLS7OKoKOWZxhfXhKEd55G1XpMPrM-MOJEdeg" \
  -H "Content-Type: application/json" \
  -d '{"conversationId":"00000000-0000-0000-0000-000000000001","message":"Production test"}' \
  --max-time 30
```

### Check Production Database

```bash
# Link to production
supabase link --project-ref cbzgvlkizkdfjmbrosav

# Query messages
supabase db remote --linked sql \
  "SELECT id, role, LEFT(content, 50) as content_preview, created_at
   FROM hugo_love.messages
   ORDER BY created_at DESC
   LIMIT 10;"
```

## Support Resources

- **Supabase Dashboard**: https://supabase.com/dashboard/project/cbzgvlkizkdfjmbrosav
- **Edge Function Logs**: https://supabase.com/dashboard/project/cbzgvlkizkdfjmbrosav/logs/edge-functions
- **Database Editor**: https://supabase.com/dashboard/project/cbzgvlkizkdfjmbrosav/editor
- **API Settings**: https://supabase.com/dashboard/project/cbzgvlkizkdfjmbrosav/settings/api

---

**Ready for Manual Testing**: The iOS app is configured, built, and running on simulator with production backend configuration.
