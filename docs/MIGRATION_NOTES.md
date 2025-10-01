# Migration Notes - Platform Events & Notifications System

## Database Migration Status: ⚠️ PARTIALLY BLOCKED

### Fixed Issues
✅ **IMMUTABLE Function Error** (2025-09-30) - Fixed in commit `7d66c97`
- Removed `NOW()` from index predicate
- Changed from partial index to composite index

✅ **Missing Trigger Function** (2025-09-30) - Fixed in commit `4342a3e`
- Added `update_transaction_timestamp()` function definition
- Uses CREATE OR REPLACE for idempotency
- Migration now includes all dependencies

### Remaining Issue
The Supabase migration history is out of sync between local and remote databases. Unable to push migrations using standard `supabase db push` command.

### Root Cause
- Remote database has migration entries for files that don't exist locally (20250918*, 20250928*, 20250930000003-5)
- These were marked as "reverted" but still exist in the migration history table
- When attempting to repair and push, existing tables cause conflicts
- Connection issues to Supabase pooler preventing migration repair

### Migrations Needed
1. **20250930000001_marketplace_core_tables.sql** - Marketplace tables (may already be applied)
2. **20250930000002_platform_events_notifications.sql** - **CRITICAL** - Events & Notifications tables

### Manual Migration Workaround

Since `supabase db push` is blocked, use one of these approaches:

#### Option A: Supabase Dashboard SQL Editor
1. Go to https://supabase.com/dashboard/project/cbzgvlkizkdfjmbrosav/sql
2. Copy contents of `supabase/migrations/20250930000002_platform_events_notifications.sql`
3. Paste and execute in SQL editor
4. Verify tables created:
   - `platform_events`
   - `platform_notifications`
   - `notification_state`
   - `app_webhooks`
   - `webhook_delivery_log`

#### Option B: Direct psql Connection
```bash
# Get database password from Supabase dashboard
psql "postgresql://postgres:[PASSWORD]@db.cbzgvlkizkdfjmbrosav.supabase.co:5432/postgres" \
  -f supabase/migrations/20250930000002_platform_events_notifications.sql
```

#### Option C: Node Script
```javascript
// run-migration.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sql = fs.readFileSync('supabase/migrations/20250930000002_platform_events_notifications.sql', 'utf8');

// Split on statement boundaries and execute
const statements = sql.split(/;\s*$/gm).filter(s => s.trim());
for (const stmt of statements) {
  await supabase.rpc('execute_sql', { sql: stmt });
}
```

### After Migration Applied

Update migration history:
```bash
supabase migration repair --status applied 20250930000001
supabase migration repair --status applied 20250930000002
```

### Tables Created by Migration

**platform_events** - Event tracking
- Columns: id, app_id, user_id, event_category, event_type, entity_type, entity_id, event_data, ip_address, user_agent, timestamp, created_at
- Indexes: GIN on event_data JSONB, composite indexes on common queries
- RLS: App-level isolation

**platform_notifications** - Notification content
- Columns: id, app_id, user_id, title, body, priority, category, action_url, icon_url, image_url, external_id, expires_at, metadata, created_at, updated_at
- Indexes: GIN on metadata, unique on external_id per app
- RLS: App-level isolation

**notification_state** - User-specific notification state
- Columns: notification_id, user_id, status, read_at, dismissed_at, clicked_at, metadata, created_at, updated_at
- Composite primary key: (notification_id, user_id)
- Status: unread, read, dismissed, clicked
- RLS: User-level isolation

**app_webhooks** - Webhook subscriptions
- Columns: id, app_id, webhook_url, webhook_secret, subscribed_events, is_active, last_delivery_at, consecutive_failures, created_at, updated_at
- Indexes: On app_id and is_active
- RLS: App-level isolation

**webhook_delivery_log** - Webhook delivery history
- Columns: id, webhook_id, event_id, status, response_code, response_body, error_message, attempted_at, delivered_at
- Retention: Auto-delete after 30 days via RLS policy
- RLS: App-level isolation via webhook join

### Verification Queries

After migration, verify tables exist:
```sql
-- Check tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('platform_events', 'platform_notifications', 'notification_state', 'app_webhooks', 'webhook_delivery_log');

-- Check RLS policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN ('platform_events', 'platform_notifications', 'notification_state', 'app_webhooks', 'webhook_delivery_log');

-- Check indexes
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public'
  AND tablename IN ('platform_events', 'platform_notifications', 'notification_state', 'app_webhooks', 'webhook_delivery_log');
```

### Background Workers Setup

Once migration is complete, set up cron jobs at https://console.cron-job.org/jobs:

1. **Webhook Retry Worker** - Every 5 minutes
   - URL: `https://api.oriva.com/api/workers/webhookRetry`
   - Method: POST
   - Auth: Bearer token in Authorization header

2. **Notification Expiry Worker** - Every 5 minutes
   - URL: `https://api.oriva.com/api/workers/notificationExpiry`
   - Method: POST
   - Auth: Bearer token in Authorization header

3. **Data Archival Worker** - Daily at midnight
   - URL: `https://api.oriva.com/api/workers/dataArchival`
   - Method: POST
   - Auth: Bearer token in Authorization header

### Next Steps
1. Apply migration manually (choose Option A, B, or C above)
2. Verify tables created with verification queries
3. Test one endpoint: `POST /api/v1/apps/:appId/events`
4. Set up cron jobs
5. Fix migration history for future deployments
