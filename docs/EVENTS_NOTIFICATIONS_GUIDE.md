# Platform Events & Notifications System - Developer Guide

## Overview

The Oriva Platform Events & Notifications System provides:
- **Platform event publishing** - Publish and track events across your app
- **Unified notification aggregation** - Aggregate notifications from multiple apps
- **Webhook subscriptions** - Receive real-time event notifications
- **WebSocket streaming** - Real-time event updates

## Quick Start

See [quickstart.md](../specs/004-events-notifications-system/quickstart.md) for complete integration scenarios.

## Authentication

All API endpoints require authentication via Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.oriva.com/v1/apps/your-app-id/events
```

### Getting Your API Key

1. Log in to the Oriva Dashboard
2. Navigate to your app settings
3. Generate an API key under "Credentials"
4. Store the API key securely (it will only be shown once)

## Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Event Publishing | 1000 requests | 15 minutes |
| Event Query | 1000 requests | 15 minutes |
| Notification Create | 500 requests | 15 minutes |
| Notification Query/Update | 1000 requests | 15 minutes |
| Webhook Management | 50 requests | 15 minutes |

Rate limit headers are included in all responses:
- `X-RateLimit-Limit` - Maximum requests per window
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Unix timestamp when window resets

## Core Concepts

### Platform Events

Events represent significant occurrences in your app:

```typescript
{
  "user_id": "uuid",
  "event_category": "notification", // or "user", "session", "transaction"
  "event_type": "created", // lowercase_with_underscores
  "entity_type": "notification",
  "entity_id": "notif_123",
  "event_data": {
    "title": "Welcome!",
    "priority": "high"
  }
}
```

**Event Categories:**
- `notification` - Notification lifecycle events
- `user` - User actions and state changes
- `session` - User session events
- `transaction` - Payment and purchase events

### Notifications

Notifications are messages displayed to users:

```typescript
{
  "user_id": "uuid",
  "title": "New Message", // 1-200 chars
  "body": "You have a new message from...", // 1-1000 chars
  "priority": "high", // low, normal, high, critical
  "category": "message",
  "action_url": "https://app.example.com/messages/123",
  "expires_at": "2025-10-01T00:00:00Z" // optional
}
```

**Notification States:**
- `unread` - Initial state
- `read` - User viewed notification
- `dismissed` - User dismissed notification
- `clicked` - User clicked notification action

### Webhooks

Webhooks deliver events to your endpoints in real-time:

```typescript
{
  "webhook_url": "https://your-app.com/webhooks/oriva",
  "subscribed_events": [
    "notification.created",
    "notification.dismissed",
    "notification.clicked"
  ]
}
```

**Webhook Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "notification.dismissed",
  "timestamp": "2025-09-30T10:00:00Z",
  "data": {
    "notification_id": "uuid",
    "user_id": "uuid"
  }
}
```

**Webhook Signature Verification:**
```typescript
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// In your webhook handler:
const signature = req.headers['x-oriva-signature'];
const isValid = verifyWebhookSignature(
  JSON.stringify(req.body),
  signature,
  YOUR_WEBHOOK_SECRET
);
```

## API Examples

### Publish Event

```bash
curl -X POST https://api.oriva.com/v1/apps/your-app-id/events \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "event_category": "session",
    "event_type": "started",
    "entity_type": "focus_session",
    "entity_id": "session_123",
    "event_data": {
      "duration_minutes": 25,
      "task_name": "Deep Work"
    }
  }'
```

### Create Notification

```bash
curl -X POST https://api.oriva.com/v1/apps/your-app-id/notifications \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-uuid",
    "title": "Session Complete",
    "body": "Great job! You completed your 25-minute focus session.",
    "priority": "normal",
    "category": "achievement",
    "action_url": "workbuddy://session/results",
    "external_id": "session_123_complete"
  }'
```

### Query User Notifications

```bash
curl https://api.oriva.com/v1/users/user-uuid/notifications?status=unread&limit=20 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Dismiss Notification

```bash
curl -X PATCH https://api.oriva.com/v1/notifications/notif-uuid \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status": "dismissed"}'
```

### Create Webhook

```bash
curl -X POST https://api.oriva.com/v1/apps/your-app-id/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_url": "https://your-app.com/webhooks/oriva",
    "subscribed_events": [
      "notification.created",
      "notification.dismissed",
      "notification.clicked"
    ]
  }'

# Response includes webhook_secret - SAVE THIS!
{
  "webhook_id": "webhook-uuid",
  "webhook_secret": "secret_abc123..."
}
```

## WebSocket Streaming

Connect to real-time event stream:

```typescript
import WebSocket from 'ws';

const ws = new WebSocket(
  `wss://api.oriva.com/v1/events/stream?app_id=your-app-id&user_id=user-uuid&auth=YOUR_API_KEY`
);

ws.on('open', () => {
  // Subscribe to notification events
  ws.send(JSON.stringify({
    type: 'subscribe',
    subscriptions: ['notification'] // or specific: ['notification.created', 'notification.dismissed']
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);

  if (event.type === 'connected') {
    console.log('Connected:', event.connection_id);
  } else if (event.type === 'event') {
    console.log('Event received:', event.event_type, event.data);
  }
});

ws.on('close', () => {
  console.log('Disconnected');
});
```

**Connection Limits:**
- Maximum 10 concurrent connections per user
- Heartbeat ping/pong every 30 seconds
- Auto-disconnect after 2 minutes of inactivity

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Verify your API key is correct
- Check that the app is active in the dashboard
- Ensure Bearer token is properly formatted

**429 Rate Limit Exceeded**
- Implement exponential backoff
- Check `X-RateLimit-Reset` header for retry time
- Consider caching or batching requests

**400 Validation Error**
- Check required fields are present
- Verify field length constraints (title: 1-200, body: 1-1000)
- Ensure event_type uses lowercase_with_underscores format

**409 Duplicate External ID**
- External IDs must be unique per app
- Use external_id for idempotency in notification creation

**Webhook Not Receiving Events**
- Verify webhook_url is HTTPS (required)
- Check webhook is active: `GET /apps/:appId/webhooks`
- Check webhook_delivery_log table for failures
- Webhooks are auto-disabled after 100 consecutive failures

**WebSocket Connection Fails**
- Verify authentication parameters in query string
- Check connection limit (max 10 per user)
- Ensure app_id and user_id are valid

### Debugging Tips

1. **Check Logs**: All API requests are logged with request IDs
2. **Test with cURL**: Verify authentication and payload format
3. **Monitor Rate Limits**: Track `X-RateLimit-*` headers
4. **Webhook Testing**: Use webhook.site or requestbin for testing
5. **Event History**: Query `/apps/:appId/events` to see published events

## Best Practices

### Event Publishing
- Use consistent event_type naming (lowercase_with_underscores)
- Include relevant context in event_data
- Publish events asynchronously (non-blocking)

### Notifications
- Keep titles concise (< 50 chars recommended)
- Provide actionable body text
- Use priority appropriately (critical sparingly)
- Set expires_at for time-sensitive notifications
- Use external_id for idempotency

### Webhooks
- Verify HMAC signatures on all webhook deliveries
- Respond with 200 OK quickly (< 10 seconds)
- Process webhook payload asynchronously
- Implement retry logic for failed processing
- Monitor consecutive_failures count

### WebSocket Streaming
- Reconnect with exponential backoff
- Handle connection limits gracefully
- Subscribe only to needed event types
- Process events asynchronously

## Security

- **Store API keys securely** - Never commit to version control
- **Verify webhook signatures** - Use HMAC verification
- **Use HTTPS** - All webhook URLs must be HTTPS
- **Rotate keys regularly** - Generate new API keys periodically
- **Monitor for abuse** - Track rate limit violations

## Support

- **API Reference**: See [OpenAPI specification](./events-notifications-api.yml)
- **Integration Examples**: See [quickstart.md](../specs/004-events-notifications-system/quickstart.md)
- **Issues**: Report bugs on GitHub
- **Questions**: Contact support@oriva.com
