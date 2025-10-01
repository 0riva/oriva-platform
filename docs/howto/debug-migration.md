# Migration Debugging - No Tables Created

## Issue
Migration executed with "Success" message, but verification query returned no rows.
Tables were not created.

## Diagnostic Queries

Run these queries in Supabase SQL Editor to diagnose:

### 1. Check if tables exist in ANY schema
```sql
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename IN (
  'platform_events',
  'platform_notifications',
  'notification_state',
  'app_webhooks',
  'webhook_delivery_log'
)
ORDER BY schemaname, tablename;
```

### 2. Check if trigger function was created
```sql
SELECT proname, pronamespace::regnamespace
FROM pg_proc
WHERE proname = 'update_transaction_timestamp';
```

### 3. Check for any constraint violations
```sql
-- Check if hugo_apps table exists (required for foreign key)
SELECT tablename FROM pg_tables WHERE tablename = 'hugo_apps';
```

### 4. List all tables in public schema
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### 5. Check for recent errors in Supabase logs
Go to: https://supabase.com/dashboard/project/cbzgvlkizkdfjmbrosav/logs/postgres-logs

---

## Common Issues

### Issue A: Foreign Key Constraint Failed
**Symptom**: hugo_apps table doesn't exist
**Solution**: The migration has FK constraint to `hugo_apps(app_id)` which must exist first

Check if hugo_apps exists:
```sql
SELECT * FROM hugo_apps LIMIT 1;
```

If not, you need to run a previous migration first, OR temporarily remove the FK constraint.

### Issue B: Extensions Not Enabled
**Symptom**: uuid-ossp or pgcrypto extensions failed
**Solution**: Enable manually
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Issue C: Tables Already Exist
**Symptom**: IF NOT EXISTS prevented creation
**Solution**: Tables might exist from previous run
```sql
-- Check for existing tables with similar names
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE '%event%' OR tablename LIKE '%notif%';
```

### Issue D: RLS Policies Blocked Creation
**Symptom**: Permission denied or silent failure
**Solution**: Check current user has permission
```sql
SELECT current_user, current_database();
```

---

## Workaround: Run Migration in Chunks

If full migration fails silently, run these chunks separately:

### Chunk 1: Extensions (always safe)
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Chunk 2: Tables only (no FK constraints)
```sql
-- Copy table definitions from migration
-- BUT comment out the FK constraint line:
-- ALTER TABLE platform_events ADD CONSTRAINT fk_platform_events_app_id...
```

### Chunk 3: Foreign Keys (after verifying tables exist)
```sql
-- Add FK constraints one by one
ALTER TABLE platform_events
  ADD CONSTRAINT fk_platform_events_app_id
  FOREIGN KEY (app_id) REFERENCES hugo_apps(app_id) ON DELETE CASCADE;
```

### Chunk 4: Indexes
```sql
-- Copy all CREATE INDEX statements
```

### Chunk 5: RLS Policies
```sql
-- Copy all ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- and CREATE POLICY statements
```

### Chunk 6: Triggers
```sql
-- Copy trigger function and trigger definitions
```

---

## Next Steps

1. **Run diagnostic queries above** to understand why tables weren't created
2. **Check Supabase logs** for any error messages
3. **Verify hugo_apps table exists** (required FK dependency)
4. **Try chunk-by-chunk approach** if full migration fails
5. **Report findings** so we can fix the root cause

---

## Expected Output After Success

After successful migration, this query should return 5 rows:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'platform_events',
  'platform_notifications',
  'notification_state',
  'app_webhooks',
  'webhook_delivery_log'
);
```

Output should be:
```
      tablename
-------------------------
 app_webhooks
 notification_state
 platform_events
 platform_notifications
 webhook_delivery_log
```
