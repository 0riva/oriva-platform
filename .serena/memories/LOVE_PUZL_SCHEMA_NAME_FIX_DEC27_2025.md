# Love Puzl Photo Upload Fix - December 27, 2025

## Summary

Fixed "Photo Save failed" error in Love Puzl Edit Profile by correcting the `schema_name` in the `plugin_marketplace_apps` database table.

## Root Cause

The `plugin_marketplace_apps` table had `schema_name: "hugo_love"` (legacy name) instead of `schema_name: "love_puzl"`.

When Love Puzl sent requests with `X-App-ID: love_puzl` header:

1. Request hit o-platform's schemaRouter middleware
2. schemaRouter queried: `SELECT * FROM plugin_marketplace_apps WHERE schema_name = 'love_puzl'`
3. Query returned no results (schema_name was "hugo_love")
4. schemaRouter returned `404 APP_NOT_FOUND`

## Fix Applied

Updated database record:

```sql
UPDATE plugin_marketplace_apps
SET schema_name = 'love_puzl'
WHERE slug = 'love-puzl';
```

## Verification

Tested the photo upload-url endpoint:

- Before: `404 APP_NOT_FOUND`
- After: `401 API key required` (proves schemaRouter found the app)

The 401 error is expected when testing without API key. In production, Love Puzl provides API key from `NEXT_PUBLIC_ORIVA_API_KEY_LOVE_PUZL` Vercel env var.

## Photo Upload Flow

```
Love Puzl app
  → parentApiProxy.post('/apps/photos/upload-url', {...}, {'X-App-ID': 'love_puzl'})
  → o-core app-launcher (forwards to api.oriva.io with X-API-Key)
  → o-platform schemaRouter (validates X-App-ID against plugin_marketplace_apps.schema_name)
  → photos router (generates S3 presigned URL)
```

## Files Involved

- `/Users/cosmic/o-orig/apps/love-puzl/services/photoUploadService.ts` - Sets X-App-ID header
- `/Users/cosmic/o-platform/src/express/middleware/schemaRouter.ts` - Looks up schema_name
- `/Users/cosmic/o-core/apps/web/app/app-launcher/[id]/page.tsx` - Proxies API calls

## No Deployment Needed

This was a database-only fix. The schemaRouter dynamically queries the database, so the fix was live immediately after UPDATE.
