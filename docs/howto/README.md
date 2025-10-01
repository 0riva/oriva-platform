# How-To Guides - Platform Events & Notifications

Quick reference guides for when you need to integrate with the Platform Events & Notifications system.

## Available Guides

### 🧪 [Testing the Events API](./testing-events-api.md)
**When to use**: When building a new app that needs to publish events or create notifications

**What's inside**:
- How to get Supabase Auth JWT tokens
- Automated test scripts
- Manual testing with curl
- Troubleshooting authentication issues

**Quick example**:
```bash
# Create user, get token, test event publishing
curl -X POST 'https://cbzgvlkizkdfjmbrosav.supabase.co/auth/v1/signup' ...
```

---

### 🔧 [Debug Migration Issues](./debug-migration.md)
**When to use**: If you need to apply a new migration or troubleshoot database issues

**What's inside**:
- Diagnostic SQL queries
- Common migration issues
- Chunk-by-chunk migration approach
- Verification steps

**Quick example**:
```sql
-- Check if tables exist
SELECT tablename FROM pg_tables WHERE tablename LIKE '%platform_%';
```

---

## Integration Examples

### Publishing an Event
```typescript
// From your app code
const response = await fetch('https://api.oriva.com/api/v1/apps/my-app/events', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userJWT}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: userId,
    event_category: 'session',
    event_type: 'focus_completed',
    entity_type: 'focus_session',
    entity_id: sessionId,
    event_data: { duration_minutes: 25 }
  })
});
```

### Creating a Notification
```typescript
const response = await fetch('https://api.oriva.com/api/v1/apps/my-app/notifications', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userJWT}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_id: userId,
    title: 'Session Complete!',
    body: 'Great job completing your 25-minute focus session',
    priority: 'normal',
    category: 'achievement'
  })
});
```

### Subscribing to Webhooks
```typescript
const response = await fetch('https://api.oriva.com/api/v1/apps/my-app/webhooks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userJWT}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    webhook_url: 'https://my-app.com/webhooks/oriva',
    subscribed_events: ['notification.created', 'notification.dismissed']
  })
});
// Save the webhook_secret from response for HMAC verification!
```

---

## Main Documentation

For complete API reference and system overview, see:
- **API Reference**: [../EVENTS_NOTIFICATIONS_GUIDE.md](../EVENTS_NOTIFICATIONS_GUIDE.md)
- **OpenAPI Spec**: [../events-notifications-api.yml](../events-notifications-api.yml)
- **Implementation Summary**: [../IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
- **Migration Notes**: [../MIGRATION_NOTES.md](../MIGRATION_NOTES.md)
- **Cron Jobs Setup**: [../CRON_JOBS_SETUP.md](../CRON_JOBS_SETUP.md)

---

## When You Need This

You'll reference these guides when:
- ✅ Building a new Oriva app that needs event tracking
- ✅ Implementing notifications in your app
- ✅ Setting up webhooks to receive real-time events
- ✅ Troubleshooting authentication or API issues
- ✅ Debugging database problems
- ✅ Onboarding new developers to the platform

For now, the system is fully implemented and ready to use whenever you need it!
