# Quickstart Guide: Platform Events & Notifications System

**For**: Third-party app developers integrating with Oriva Platform
**Last Updated**: 2025-09-30
**Status**: Phase 1 Complete ✅

---

## Overview

This guide walks you through integrating the Platform Events & Notifications System into your third-party app. You'll learn how to:

1. Create notifications that appear in Oriva Core
2. Subscribe to events via webhooks
3. Sync notification state across apps
4. Connect to real-time WebSocket updates

**Prerequisites**:
- Registered Oriva Platform app (get your API key)
- HTTPS endpoint for webhook callbacks (required for production)

---

## 1. Authentication

All API requests require a Bearer token (your API key).

```bash
# Get your API key from Oriva Developer Dashboard
export ORIVA_API_KEY="your_api_key_here"
export ORIVA_API_BASE="https://api.oriva.io/api/v1"
```

```typescript
// TypeScript/JavaScript
const ORIVA_API_KEY = process.env.ORIVA_API_KEY;
const ORIVA_API_BASE = process.env.ORIVA_API_BASE;

const headers = {
  'Authorization': `Bearer ${ORIVA_API_KEY}`,
  'Content-Type': 'application/json'
};
```

---

## 2. Creating Notifications

### Step 1: Create a notification

When your app wants to notify a user, POST to the notifications endpoint:

```typescript
// Example: Session reminder notification
async function createSessionReminder(userId: string, sessionId: string, partnerName: string) {
  const response = await fetch(
    `${ORIVA_API_BASE}/apps/your-app-id/notifications`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        external_id: `session_reminder_${sessionId}`,
        user_id: userId,
        notification_type: 'session_reminder',
        title: 'Session starting in 10 minutes',
        body: `Your session with ${partnerName} starts soon. Get ready!`,
        action_url: `yourapp://session/${sessionId}`,
        action_label: 'View Session',
        priority: 'high',
        context_data: {
          session_id: sessionId,
          partner_name: partnerName
        },
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
      })
    }
  );

  const data = await response.json();
  console.log('Notification created:', data.notification_id);
  return data;
}
```

### Step 2: Notification appears in Oriva Core

The notification automatically appears in the user's Oriva Core notification center with your app's branding.

### Step 3: Handle notification state changes

When the user dismisses or clicks the notification, you'll receive a webhook (see section 3).

---

## 3. Webhook Subscriptions

### Step 1: Register your webhook

```typescript
async function registerWebhook() {
  const response = await fetch(
    `${ORIVA_API_BASE}/apps/your-app-id/webhooks`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        webhook_url: 'https://yourapp.com/api/oriva-webhooks',
        subscribed_events: [
          'notification.dismissed',
          'notification.clicked'
        ]
      })
    }
  );

  const data = await response.json();

  // IMPORTANT: Save webhook_secret for signature verification
  console.log('Webhook ID:', data.webhook_id);
  console.log('Webhook Secret:', data.webhook_secret); // Save this securely!

  return data;
}
```

### Step 2: Create webhook endpoint

```typescript
import crypto from 'crypto';
import express from 'express';

const app = express();
app.use(express.json());

// Your webhook endpoint
app.post('/api/oriva-webhooks', (req, res) => {
  // Step 1: Verify webhook signature
  const signature = req.headers['x-oriva-signature'] as string;
  const webhookSecret = process.env.ORIVA_WEBHOOK_SECRET!;

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Step 2: Process the event
  const event = req.body;

  switch (event.event_type) {
    case 'notification.dismissed':
      handleNotificationDismissed(event);
      break;

    case 'notification.clicked':
      handleNotificationClicked(event);
      break;

    default:
      console.log('Unknown event type:', event.event_type);
  }

  // Step 3: Respond quickly (within 10 seconds)
  res.status(200).json({ success: true });
});

async function handleNotificationDismissed(event: any) {
  console.log('Notification dismissed:', event.entity_id);
  console.log('Dismissed from:', event.event_data.dismissed_from);

  // Update your local database
  await updateNotificationStatus(event.entity_id, 'dismissed');
}

async function handleNotificationClicked(event: any) {
  console.log('Notification clicked:', event.entity_id);
  console.log('Click action:', event.event_data.click_action);

  // Track engagement metrics
  await trackNotificationClick(event.entity_id);
}
```

---

## 4. Querying Notifications

### Get user's notifications from all apps (Oriva Core)

```typescript
async function getUserNotifications(userId: string, status?: string) {
  const params = new URLSearchParams({
    limit: '50',
    offset: '0',
    ...(status && { status })
  });

  const response = await fetch(
    `${ORIVA_API_BASE}/users/${userId}/notifications?${params}`,
    { headers }
  );

  const data = await response.json();

  data.notifications.forEach((notif: any) => {
    console.log(`[${notif.app_name}] ${notif.title}`);
    console.log(`  Status: ${notif.status}`);
    console.log(`  Priority: ${notif.priority}`);
  });

  return data;
}
```

### Get app's event history

```typescript
async function getAppEvents(appId: string, category?: string) {
  const params = new URLSearchParams({
    limit: '100',
    offset: '0',
    ...(category && { event_category: category })
  });

  const response = await fetch(
    `${ORIVA_API_BASE}/apps/${appId}/events?${params}`,
    { headers }
  );

  const data = await response.json();

  console.log(`Found ${data.events.length} events`);
  return data;
}
```

---

## 5. Updating Notification State

### Dismiss a notification

```typescript
async function dismissNotification(notificationId: string, source: string) {
  const response = await fetch(
    `${ORIVA_API_BASE}/notifications/${notificationId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'dismissed',
        dismissed_from: source // e.g., 'your-app-id'
      })
    }
  );

  const data = await response.json();
  console.log('Notification dismissed:', data.notification_id);
  return data;
}
```

### Mark as read

```typescript
async function markAsRead(notificationId: string) {
  const response = await fetch(
    `${ORIVA_API_BASE}/notifications/${notificationId}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: 'read'
      })
    }
  );

  return await response.json();
}
```

---

## 6. Real-Time Updates (WebSocket)

### Connect to WebSocket stream

```typescript
import WebSocket from 'ws';

function connectToEventStream(appId: string, apiKey: string) {
  const ws = new WebSocket(
    `wss://api.oriva.io/api/v1/events/stream?app_id=${appId}&auth=${apiKey}`
  );

  ws.on('open', () => {
    console.log('Connected to event stream');

    // Subscribe to specific event types
    ws.send(JSON.stringify({
      action: 'subscribe',
      event_types: ['notification.dismissed', 'notification.clicked']
    }));
  });

  ws.on('message', (data: string) => {
    const event = JSON.parse(data);
    console.log('Real-time event:', event.event_type);

    // Handle event immediately
    handleRealtimeEvent(event);
  });

  ws.on('error', (error: Error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('Disconnected from event stream');
    // Implement reconnection logic
    setTimeout(() => connectToEventStream(appId, apiKey), 5000);
  });

  // Heartbeat to keep connection alive
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  }, 30000); // Every 30 seconds

  return ws;
}
```

---

## 7. Error Handling

### Handle rate limits

```typescript
async function createNotificationWithRetry(payload: any, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `${ORIVA_API_BASE}/apps/your-app-id/notifications`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        }
      );

      if (response.status === 429) {
        // Rate limited
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.log(`Rate limited. Retrying after ${retryAfter}s`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`Attempt ${attempt} failed, retrying...`);
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Handle webhook failures

```typescript
// In your webhook endpoint
app.post('/api/oriva-webhooks', async (req, res) => {
  try {
    // Verify signature
    verifyWebhookSignature(req);

    // Process event
    await processEvent(req.body);

    // Respond quickly
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);

    // Return 500 to trigger Oriva's retry logic
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

---

## 8. Testing Your Integration

### Test notification creation

```bash
curl -X POST "https://api.oriva.io/api/v1/apps/your-app-id/notifications" \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "test_notif_1",
    "user_id": "test_user_123",
    "notification_type": "test",
    "title": "Test Notification",
    "body": "This is a test notification from your app",
    "priority": "normal"
  }'
```

### Test webhook signature verification

```typescript
import crypto from 'crypto';

function testWebhookSignature() {
  const payload = {
    event_id: 'evt_test_123',
    event_type: 'notification.dismissed',
    entity_id: 'notif_456'
  };

  const webhookSecret = 'your_webhook_secret';

  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');

  console.log('Expected signature:', signature);

  // Use this signature in X-Oriva-Signature header when testing
}
```

---

## 9. Best Practices

### 1. Use Unique External IDs
```typescript
// Good: Prevents duplicates
external_id: `session_reminder_${sessionId}_${timestamp}`

// Bad: Could create duplicates
external_id: `reminder_${userId}`
```

### 2. Set Appropriate Expiry Times
```typescript
// For time-sensitive notifications
expires_at: new Date(sessionStartTime).toISOString()

// For persistent notifications
expires_at: null // Never expires
```

### 3. Handle Idempotent Operations
```typescript
// Dismissing twice is safe
await dismissNotification(notificationId, 'your-app');
await dismissNotification(notificationId, 'your-app'); // No error
```

### 4. Monitor Webhook Health
```typescript
// Check webhook status periodically
async function checkWebhookHealth(webhookId: string) {
  const response = await fetch(
    `${ORIVA_API_BASE}/apps/your-app-id/webhooks/${webhookId}`,
    { headers }
  );

  const webhook = await response.json();

  if (!webhook.is_active) {
    console.error('Webhook disabled! Check your endpoint.');
  }

  const failureRate = webhook.total_failures / webhook.total_deliveries;
  if (failureRate > 0.1) {
    console.warn('Webhook failure rate above 10%');
  }
}
```

### 5. Queue Local Operations
```typescript
// Queue notification creation for offline resilience
import { Queue } from 'bull';

const notificationQueue = new Queue('oriva-notifications');

notificationQueue.process(async (job) => {
  await createNotification(job.data);
});

// Add to queue instead of immediate API call
await notificationQueue.add({ userId, title, body });
```

---

## 10. Rate Limits

| Operation | Limit | Window |
|-----------|-------|--------|
| Create Notifications | 500 | 15 minutes |
| Publish Events | 1000 | 15 minutes |
| Query Notifications | 1000 | 15 minutes |
| Manage Webhooks | 50 | 15 minutes |
| WebSocket Connections | 10 concurrent | Per user |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 450
X-RateLimit-Reset: 1696089600
```

---

## 11. Complete Integration Example

### Full TypeScript Integration

```typescript
import crypto from 'crypto';
import express from 'express';
import WebSocket from 'ws';

class OrivaNotificationClient {
  private apiKey: string;
  private apiBase: string;
  private appId: string;
  private webhookSecret: string;
  private ws: WebSocket | null = null;

  constructor(apiKey: string, appId: string, webhookSecret: string) {
    this.apiKey = apiKey;
    this.apiBase = 'https://api.oriva.io/api/v1';
    this.appId = appId;
    this.webhookSecret = webhookSecret;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async createNotification(payload: {
    external_id: string;
    user_id: string;
    notification_type: string;
    title: string;
    body: string;
    action_url?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    expires_at?: string;
  }) {
    const response = await fetch(
      `${this.apiBase}/apps/${this.appId}/notifications`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create notification: ${response.status}`);
    }

    return await response.json();
  }

  async dismissNotification(notificationId: string) {
    const response = await fetch(
      `${this.apiBase}/notifications/${notificationId}`,
      {
        method: 'PATCH',
        headers: this.headers,
        body: JSON.stringify({
          status: 'dismissed',
          dismissed_from: this.appId
        })
      }
    );

    return await response.json();
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === expectedSignature;
  }

  connectWebSocket(eventTypes: string[]) {
    this.ws = new WebSocket(
      `wss://api.oriva.io/api/v1/events/stream?app_id=${this.appId}&auth=${this.apiKey}`
    );

    this.ws.on('open', () => {
      console.log('[Oriva] WebSocket connected');
      this.ws!.send(JSON.stringify({
        action: 'subscribe',
        event_types: eventTypes
      }));
    });

    this.ws.on('message', (data) => {
      const event = JSON.parse(data.toString());
      this.handleEvent(event);
    });

    this.ws.on('close', () => {
      console.log('[Oriva] WebSocket disconnected, reconnecting...');
      setTimeout(() => this.connectWebSocket(eventTypes), 5000);
    });

    // Heartbeat
    setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);

    return this.ws;
  }

  private handleEvent(event: any) {
    console.log('[Oriva] Event received:', event.event_type);
    // Override this method in subclass
  }
}

// Usage
const client = new OrivaNotificationClient(
  process.env.ORIVA_API_KEY!,
  'your-app-id',
  process.env.ORIVA_WEBHOOK_SECRET!
);

// Create notification
await client.createNotification({
  external_id: 'test_123',
  user_id: 'user_456',
  notification_type: 'test',
  title: 'Test Notification',
  body: 'Testing the integration',
  priority: 'normal'
});

// Connect WebSocket
client.connectWebSocket(['notification.dismissed', 'notification.clicked']);
```

---

## Need Help?

- **Documentation**: [https://docs.oriva.io](https://docs.oriva.io)
- **API Reference**: [https://api.oriva.io/docs](https://api.oriva.io/docs)
- **Support**: [support@oriva.io](mailto:support@oriva.io)
- **Developer Forum**: [https://community.oriva.io](https://community.oriva.io)

---

**Related Documents**:
- [spec.md](./spec.md) - Feature specification
- [data-model.md](./data-model.md) - Database schema
- [contracts/](./contracts/) - API contracts
