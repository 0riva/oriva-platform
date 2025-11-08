# Event Bus API Endpoints

**Phase**: 3.8 (Real-Time Delivery)
**Status**: ✅ Complete
**Last Updated**: 2025-10-28

## Overview

Event Bus API provides cross-app event publishing, subscription management, and real-time notification delivery. The system supports multiple notification channels (in-app, email, push, webhooks) with automatic retry logic and user preference management.

## Authentication

All endpoints require:

- **X-Api-Key** header (API key for the app)
- **Authorization** header with Bearer token (Supabase JWT)
- **X-App-ID** header (identifies the requesting app)

## Base URL

```
/api/v1/events
```

## Endpoints

### 1. Publish Event

**POST /api/v1/events**

Publish a new event to the event bus. The event is persisted to the database and automatically routed to applicable subscriptions.

#### Request Body

```typescript
{
  type: string;              // Required: Event type (e.g., SESSION_STARTED, EVENT_REGISTRATION)
  userId?: string;           // Optional: Override user ID
  organizationId?: string;   // Optional: Organization context
  data?: Record<string, any>; // Event-specific data
}
```

#### Response (201)

```typescript
{
  data: {
    id: string;              // Event ID
    type: string;            // Event type
    source: {
      appId: string;         // Publishing app ID
      appName: string;       // Publishing app name
      version: string;       // App version
    };
    userId: string;          // Event user
    organizationId?: string; // Organization context
    timestamp: number;       // Event timestamp (milliseconds)
    data: Record<string, any>; // Event data
    metadata: {
      correlationId: string; // For request tracing
      version: string;       // API version
      environment: string;   // dev/staging/prod
      ipAddress: string;     // Client IP
      userAgent: string;     // User agent
    };
    correlationId: string;   // For tracing across services
  };
  notifications: Array<{
    id: string;              // Notification ID
    userId: string;          // Recipient
    type: string;            // Notification type
    title: string;           // Notification title
    body: string;            // Notification body
    channels: string[];      // Delivery channels (in_app, email, push, webhook)
    priority: string;        // low, normal, high, urgent
    status: string;          // pending, sent, delivered, read, failed
  }>;
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/v1/events \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SESSION_STARTED",
    "data": {
      "sessionId": "sess_123",
      "title": "Focus Session"
    }
  }'
```

---

### 2. Get Event History

**GET /api/v1/events**

Retrieve user's event history with pagination.

#### Query Parameters

| Parameter | Type   | Default | Max | Description       |
| --------- | ------ | ------- | --- | ----------------- |
| limit     | number | 50      | 100 | Results per page  |
| offset    | number | 0       | -   | Pagination offset |

#### Response (200)

```typescript
{
  data: Event[];
  total: number;        // Total matching events
  hasMore: boolean;     // More results available
}
```

#### Example

```bash
curl -X GET "http://localhost:3001/api/v1/events?limit=25&offset=0" \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy"
```

---

### 3. Subscribe to Events

**POST /api/v1/events/subscriptions**

Subscribe to specific event types. Subscriptions are app-scoped and user-scoped.

#### Request Body

```typescript
{
  eventTypes: string | string[];  // Required: Event types to subscribe to
  filters?: {
    userId?: string;              // Filter by specific user
    source?: string | string[];   // Filter by source app(s)
    timeRange?: {
      startTime: number;          // Timestamp in milliseconds
      endTime: number;            // Timestamp in milliseconds
    };
  };
}
```

#### Response (201)

```typescript
{
  data: {
    id: string;                   // Subscription ID
    eventType: string[];          // Subscribed event types
    userId: string;               // Subscriber
    appId: string;                // App context
    filters: object;              // Subscription filters
    active: boolean;              // Subscription status
    createdAt: number;            // Creation timestamp
    updatedAt: number;            // Last update timestamp
  };
}
```

#### Example

```bash
curl -X POST http://localhost:3001/api/v1/events/subscriptions \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy" \
  -H "Content-Type: application/json" \
  -d '{
    "eventTypes": ["SESSION_STARTED", "SESSION_ENDED"],
    "filters": {
      "source": "work-buddy"
    }
  }'
```

---

### 4. Get Subscriptions

**GET /api/v1/events/subscriptions**

Retrieve user's event subscriptions.

#### Response (200)

```typescript
{
  data: EventSubscription[];
}
```

#### Example

```bash
curl -X GET http://localhost:3001/api/v1/events/subscriptions \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy"
```

---

### 5. Unsubscribe from Events

**DELETE /api/v1/events/subscriptions/:id**

Unsubscribe from an event subscription.

#### Response (204)

No content.

#### Example

```bash
curl -X DELETE http://localhost:3001/api/v1/events/subscriptions/sub_123 \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy"
```

---

### 6. Get Notifications

**GET /api/v1/events/notifications**

Retrieve user's notifications (polling fallback).

#### Query Parameters

| Parameter | Type   | Default | Max | Description                       |
| --------- | ------ | ------- | --- | --------------------------------- |
| limit     | number | 50      | 100 | Results per page                  |
| since     | number | -       | -   | Get notifications since timestamp |

#### Response (200)

```typescript
{
  data: Notification[];
}
```

#### Example

```bash
curl -X GET "http://localhost:3001/api/v1/events/notifications?limit=50" \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy"
```

---

### 7. Update Notification Status

**PATCH /api/v1/events/notifications/:id**

Mark notification as read or change status.

#### Request Body

```typescript
{
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}
```

#### Response (200)

```typescript
{
  data: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    channels: string[];
    status: string;
    read_at?: string;  // ISO timestamp when marked as read
  };
}
```

#### Example

```bash
curl -X PATCH http://localhost:3001/api/v1/events/notifications/notif_123 \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "read"
  }'
```

---

### 8. Get Notification Preferences

**GET /api/v1/events/preferences**

Retrieve user's notification preferences.

#### Response (200)

```typescript
{
  data: {
    id: string;
    userId: string;
    channels: {
      in_app: { enabled: boolean };
      email: { enabled: boolean };
      push: { enabled: boolean };
      webhook: { enabled: boolean };
      sms: { enabled: boolean };
    };
    notificationTypes: Record<string, {
      enabled: boolean;
      channels?: string[];
      priority?: string;
    }>;
    unsubscribedTypes: string[];
    createdAt: number;
    updatedAt: number;
  };
}
```

#### Example

```bash
curl -X GET http://localhost:3001/api/v1/events/preferences \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy"
```

---

### 9. Update Notification Preferences

**PUT /api/v1/events/preferences**

Update user's notification preferences.

#### Request Body

```typescript
{
  channels?: {
    in_app?: { enabled: boolean };
    email?: { enabled: boolean };
    push?: { enabled: boolean };
    webhook?: { enabled: boolean };
    sms?: { enabled: boolean };
  };
  notificationTypes?: Record<string, {
    enabled: boolean;
    channels?: string[];
    priority?: string;
  }>;
  unsubscribedTypes?: string[];
}
```

#### Response (200)

```typescript
{
  data: NotificationPreferences;
}
```

#### Example

```bash
curl -X PUT http://localhost:3001/api/v1/events/preferences \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy" \
  -H "Content-Type: application/json" \
  -d '{
    "channels": {
      "email": { "enabled": true },
      "push": { "enabled": false }
    },
    "unsubscribedTypes": ["USER_PROFILE_UPDATED"]
  }'
```

---

### 10. Get Connection Status

**GET /api/v1/events/connection-status**

Get real-time WebSocket connection status.

#### Response (200)

```typescript
{
  data: {
    userId: string;
    connected: boolean;
    connectionId?: string;
    connectedAt?: number;
    lastHeartbeat?: number;
    appIds: string[];
    messagesBuffered: number;
  };
}
```

#### Example

```bash
curl -X GET http://localhost:3001/api/v1/events/connection-status \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "X-App-ID: work-buddy"
```

---

## WebSocket Connection

**URL**: `ws://localhost:3001/api/v1/events/subscribe`

Real-time notification delivery via WebSocket.

### Authentication

WebSocket connection requires:

- **Authorization** query parameter with Bearer token
- **appIds** query parameter (comma-separated app IDs)

### Client Messages

#### Heartbeat

Keep connection alive:

```json
{
  "type": "heartbeat"
}
```

#### Mark as Read

Mark notification as read:

```json
{
  "type": "mark_read",
  "notificationId": "notif_123"
}
```

#### Update Subscriptions

Update app subscriptions:

```json
{
  "type": "update_subscriptions",
  "appIds": ["app1", "app2"]
}
```

### Server Messages

#### Connected

Confirmation of connection:

```json
{
  "type": "connected",
  "connectionId": "conn_123",
  "timestamp": 1635123456789
}
```

#### Notification

Incoming notification:

```json
{
  "type": "notification",
  "notification": {
    "id": "notif_123",
    "userId": "user_123",
    "type": "SESSION_STARTED",
    "title": "Session Started",
    "body": "Your session has begun",
    "channels": ["in_app"],
    "priority": "normal",
    "status": "pending"
  },
  "timestamp": 1635123456789
}
```

#### Heartbeat ACK

Acknowledgement of heartbeat:

```json
{
  "type": "heartbeat_ack",
  "timestamp": 1635123456789
}
```

#### Error

Error message:

```json
{
  "type": "error",
  "message": "Error description",
  "timestamp": 1635123456789
}
```

---

## Error Responses

All endpoints return standardized error responses:

```typescript
{
  code: string; // Error code (UNAUTHORIZED, VALIDATION_ERROR, etc.)
  message: string; // Human-readable error message
}
```

### Common Error Codes

| Code                       | Status | Description                       |
| -------------------------- | ------ | --------------------------------- |
| UNAUTHORIZED               | 401    | Missing or invalid authentication |
| VALIDATION_ERROR           | 400    | Invalid request parameters        |
| NOT_FOUND                  | 404    | Resource not found                |
| EVENT_PUBLISH_FAILED       | 400    | Failed to publish event           |
| SUBSCRIPTION_FAILED        | 400    | Failed to create subscription     |
| NOTIFICATION_UPDATE_FAILED | 400    | Failed to update notification     |
| PREFERENCES_UPDATE_FAILED  | 400    | Failed to update preferences      |
| CONNECTION_STATUS_FAILED   | 400    | Failed to get connection status   |

---

## Examples

### Complete Workflow

#### 1. Subscribe to Events

```bash
# Subscribe to SESSION_STARTED events
curl -X POST http://localhost:3001/api/v1/events/subscriptions \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-App-ID: work-buddy" \
  -H "Content-Type: application/json" \
  -d '{
    "eventTypes": ["SESSION_STARTED"],
    "filters": { "source": "work-buddy" }
  }'
```

#### 2. Connect WebSocket

```javascript
const token = 'your-jwt-token';
const appIds = 'work-buddy,schedule';

const ws = new WebSocket(
  `ws://localhost:3001/api/v1/events/subscribe?authorization=Bearer%20${token}&appIds=${appIds}`
);

ws.onopen = () => {
  console.log('Connected to event bus');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'notification') {
    console.log('Notification received:', message.notification);
  }
};

// Send heartbeat every 30 seconds
setInterval(() => {
  ws.send(JSON.stringify({ type: 'heartbeat' }));
}, 30000);
```

#### 3. Publish Event

```bash
# Publish SESSION_STARTED event
curl -X POST http://localhost:3001/api/v1/events \
  -H "X-Api-Key: your-api-key" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-App-ID: work-buddy" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SESSION_STARTED",
    "data": {
      "sessionId": "sess_456",
      "title": "Team Standup"
    }
  }'
```

---

## Rate Limiting

All endpoints are rate-limited:

- **Limit**: 1000 requests per minute per API key
- **Header**: `X-RateLimit-Remaining: 999`

---

## Implementation Notes

### Database Schema

All data is stored in the `event_bus_*` tables in the Supabase OrivaDB:

- `event_bus_events` - Immutable event log
- `event_bus_subscriptions` - User event subscriptions
- `event_bus_notifications` - Notification records
- `event_bus_delivery` - Per-channel delivery tracking
- `event_bus_preferences` - User notification settings
- `event_bus_connections` - Active WebSocket connections

### Real-Time Delivery Strategy

1. **Immediate Delivery**: Events are delivered via WebSocket if user is connected
2. **Message Buffering**: Up to 1000 messages buffered per connection for brief disconnections
3. **Polling Fallback**: If WebSocket unavailable, clients poll `/api/v1/events/notifications`
4. **Retry Logic**: Failed deliveries retry with exponential backoff (max 5 retries over 24 hours)

### User Preferences

- Users can disable entire channels or specific notification types
- Preferences are applied at notification creation time
- Changes take effect immediately for new notifications

---

## Testing

### Recommended Tools

- **API Testing**: Postman, REST Client
- **WebSocket Testing**: websocat, wscat
- **Load Testing**: Apache JMeter, k6

### Test Scenarios

1. **Basic Event Publish**: Verify events are persisted and notifications created
2. **Real-Time Delivery**: Confirm WebSocket delivery with 16+ concurrent connections
3. **Polling Fallback**: Test notification retrieval when disconnected
4. **Preference Filtering**: Verify disabled channels are excluded from delivery
5. **Retry Logic**: Simulate failures and confirm retry attempts

---

## Monitoring

### Key Metrics

- Event publish latency (p50, p95, p99)
- Notification delivery success rate
- WebSocket connection count and churn
- Message buffer utilization
- Retry attempt success rate

### Health Checks

Monitor `/health` endpoint for server status and `connection-status` for real-time delivery health.
