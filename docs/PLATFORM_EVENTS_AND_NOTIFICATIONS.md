# Oriva Platform Events & Notifications System

**Status**: Design Phase
**Created**: 2025-09-30
**Feature**: Platform Events API + Notification Aggregation
**Priority**: High
**Requested By**: Work Buddy (Third-Party Developer)

---

## Executive Summary

This document outlines the design and implementation plan for Oriva Platform's unified **Platform Events System** with integrated **Notification Aggregation**. This system enables:

1. **Generic event publishing** from third-party apps to Oriva Platform
2. **Notification aggregation** showing all ecosystem notifications in Oriva Core
3. **Cross-app state synchronization** (dismissals, clicks, etc.)
4. **Webhook subscriptions** for bidirectional event flow
5. **Real-time updates** via WebSocket connections

### Key Benefits

**For Third-Party Developers:**
- Publish events from their apps to Oriva Platform
- Subscribe to platform events via webhooks
- Sync notification state across ecosystem
- Access unified notification feed

**For Oriva Core:**
- Display all ecosystem notifications in one place
- Aggregate events from all apps for analytics
- Provide seamless user experience across apps
- Enable powerful cross-app workflows

**For Users:**
- Consistent notification experience everywhere
- Dismiss once, dismissed everywhere
- See all app notifications in Oriva Core
- Control notification preferences centrally

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Third-Party Apps                          │
│              (Work Buddy, Hugo, etc.)                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ POST events
                     │ POST notifications
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 Oriva Platform API                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         Platform Events System                       │   │
│  │  - Event ingestion & storage                        │   │
│  │  - Webhook distribution                             │   │
│  │  - WebSocket broadcasting                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      Notification Aggregation System                 │   │
│  │  - Notification storage with full content           │   │
│  │  - User-specific state management                   │   │
│  │  - Cross-app sync                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ GET notifications
                     │ PATCH state
                     │ WebSocket updates
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Oriva Core                               │
│              (Notification Center UI)                        │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Examples

#### Example 1: Work Buddy Creates Notification
```
1. User has upcoming session in Work Buddy
2. Work Buddy creates notification locally
3. Work Buddy POSTs to /api/v1/apps/work-buddy/notifications
   {
     "notification_id": "wb_notif_123",
     "user_id": "user_456",
     "type": "session_reminder",
     "title": "Session starting in 10 minutes",
     "body": "Your session with Sarah starts soon",
     "action_url": "workbuddy://session/789",
     "session_id": "session_789"
   }
4. Oriva stores notification in central feed
5. Oriva broadcasts event to subscribed apps via webhooks
6. Oriva Core queries notifications and displays in UI
```

#### Example 2: User Dismisses in Oriva Core
```
1. User sees Work Buddy notification in Oriva Core
2. User swipes to dismiss
3. Oriva Core PATCHes /api/v1/notifications/wb_notif_123
   { "status": "dismissed" }
4. Oriva updates notification state
5. Oriva webhooks to Work Buddy: notification.dismissed event
6. Work Buddy updates its local state
7. Notification disappears from all apps
```

---

## Database Schema

### 1. Platform Events Table

Core table for all events across the platform.

```sql
CREATE TABLE IF NOT EXISTS platform_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Event Identification
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Event Classification
  event_category TEXT NOT NULL, -- 'notification', 'user', 'session', 'transaction', etc.
  event_type TEXT NOT NULL,     -- 'created', 'dismissed', 'updated', 'deleted', etc.

  -- Event Target
  entity_type TEXT NOT NULL,    -- 'notification', 'profile', 'session', etc.
  entity_id TEXT NOT NULL,      -- ID of the affected entity

  -- Event Data
  event_data JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Metadata
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- Indexes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_platform_events_app_user
  ON platform_events(app_id, user_id, created_at DESC);

CREATE INDEX idx_platform_events_category_type
  ON platform_events(event_category, event_type, created_at DESC);

CREATE INDEX idx_platform_events_entity
  ON platform_events(entity_type, entity_id);

CREATE INDEX idx_platform_events_user_timestamp
  ON platform_events(user_id, timestamp DESC);

CREATE INDEX idx_platform_events_data
  ON platform_events USING GIN (event_data jsonb_path_ops);
```

### 2. Platform Notifications Table

Stores notification content with full details.

```sql
CREATE TABLE IF NOT EXISTS platform_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Source App
  app_id TEXT NOT NULL REFERENCES apps(app_id),
  external_id TEXT NOT NULL, -- App's internal notification ID

  -- Target User
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Notification Content
  notification_type TEXT NOT NULL, -- 'reminder', 'opportunity', 'alert', 'update', etc.
  title TEXT NOT NULL CHECK (length(title) <= 200),
  body TEXT NOT NULL CHECK (length(body) <= 1000),

  -- Action & Deep Linking
  action_url TEXT,           -- Deep link to app (e.g., workbuddy://session/123)
  action_label TEXT,         -- Button text (e.g., "View Session")

  -- Rich Content (optional)
  image_url TEXT,
  icon_url TEXT,

  -- Context Data
  context_data JSONB DEFAULT '{}'::JSONB, -- Additional data (session_id, etc.)

  -- Priority & Expiry
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_app_external_notification UNIQUE (app_id, external_id)
);

-- Indexes
CREATE INDEX idx_notifications_user_created
  ON platform_notifications(user_id, created_at DESC);

CREATE INDEX idx_notifications_app_user
  ON platform_notifications(app_id, user_id, created_at DESC);

CREATE INDEX idx_notifications_type
  ON platform_notifications(notification_type);

CREATE INDEX idx_notifications_context
  ON platform_notifications USING GIN (context_data jsonb_path_ops);

CREATE INDEX idx_notifications_unexpired
  ON platform_notifications(user_id, created_at DESC)
  WHERE expires_at IS NULL OR expires_at > NOW();
```

### 3. Notification State Table

User-specific state for each notification (read, dismissed, clicked).

```sql
CREATE TABLE IF NOT EXISTS notification_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  notification_id UUID NOT NULL REFERENCES platform_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- State
  status TEXT NOT NULL DEFAULT 'unread' CHECK (
    status IN ('unread', 'read', 'dismissed', 'clicked', 'expired')
  ),

  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Metadata
  dismissed_from TEXT,      -- 'oriva_core', 'work_buddy', etc.
  click_action TEXT,        -- What action was taken

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_notification_user_state UNIQUE (notification_id, user_id)
);

-- Indexes
CREATE INDEX idx_notification_state_user_status
  ON notification_state(user_id, status, updated_at DESC);

CREATE INDEX idx_notification_state_notification
  ON notification_state(notification_id);
```

### 4. App Webhooks Table

Webhook subscriptions for apps to receive events.

```sql
CREATE TABLE IF NOT EXISTS app_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- App Reference
  app_id TEXT NOT NULL REFERENCES apps(app_id) ON DELETE CASCADE,

  -- Webhook Configuration
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL, -- For HMAC signature verification

  -- Event Subscriptions
  subscribed_events TEXT[] NOT NULL DEFAULT '{}', -- ['notification.*', 'user.profile_updated', etc.]

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Delivery Stats
  last_delivery_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,

  -- Retry Configuration
  max_retries INTEGER DEFAULT 3,
  retry_backoff_seconds INTEGER DEFAULT 60,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_app ON app_webhooks(app_id);
CREATE INDEX idx_webhooks_active ON app_webhooks(is_active);
```

### 5. Webhook Delivery Log

Audit trail for webhook deliveries.

```sql
CREATE TABLE IF NOT EXISTS webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  webhook_id UUID NOT NULL REFERENCES app_webhooks(id) ON DELETE CASCADE,
  event_id UUID REFERENCES platform_events(id) ON DELETE SET NULL,

  -- Delivery Details
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,

  -- Response
  status_code INTEGER,
  response_body TEXT,
  response_headers JSONB,

  -- Timing
  delivery_attempt INTEGER NOT NULL DEFAULT 1,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_time_ms INTEGER,

  -- Status
  success BOOLEAN NOT NULL,
  error_message TEXT
);

-- Indexes
CREATE INDEX idx_webhook_log_webhook ON webhook_delivery_log(webhook_id, delivered_at DESC);
CREATE INDEX idx_webhook_log_event ON webhook_delivery_log(event_id);
CREATE INDEX idx_webhook_log_success ON webhook_delivery_log(success, delivered_at DESC);
```

---

## API Endpoints

### 1. Event Publishing

#### POST `/api/v1/apps/{app_id}/events`

Post a generic platform event.

**Authentication**: Bearer token (API key)

**Request Body**:
```json
{
  "event_category": "notification",
  "event_type": "dismissed",
  "entity_type": "notification",
  "entity_id": "wb_notif_123",
  "user_id": "user_456",
  "event_data": {
    "dismissed_at": "2025-09-30T10:30:00Z",
    "dismissed_from": "work_buddy"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "event_id": "evt_789xyz",
  "timestamp": "2025-09-30T10:30:00Z"
}
```

### 2. Notification Management

#### POST `/api/v1/apps/{app_id}/notifications`

Create a new notification (convenience endpoint that creates both notification and event).

**Request Body**:
```json
{
  "external_id": "wb_notif_123",
  "user_id": "user_456",
  "notification_type": "session_reminder",
  "title": "Session starting in 10 minutes",
  "body": "Your session with Sarah starts soon",
  "action_url": "workbuddy://session/789",
  "action_label": "View Session",
  "priority": "high",
  "context_data": {
    "session_id": "session_789",
    "partner_name": "Sarah"
  },
  "expires_at": "2025-09-30T12:00:00Z"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "notification_id": "notif_uuid_123",
  "created_at": "2025-09-30T10:00:00Z"
}
```

#### GET `/api/v1/users/{user_id}/notifications`

Get user's notifications from all apps (for Oriva Core).

**Query Parameters**:
- `status` (optional): Filter by status (`unread`, `read`, `dismissed`)
- `app_id` (optional): Filter by specific app
- `limit` (default: 50, max: 100)
- `offset` (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "notifications": [
    {
      "id": "notif_uuid_123",
      "app_id": "work-buddy",
      "app_name": "Work Buddy",
      "app_icon": "https://...",
      "notification_type": "session_reminder",
      "title": "Session starting in 10 minutes",
      "body": "Your session with Sarah starts soon",
      "action_url": "workbuddy://session/789",
      "action_label": "View Session",
      "priority": "high",
      "status": "unread",
      "created_at": "2025-09-30T10:00:00Z",
      "context_data": {
        "session_id": "session_789"
      }
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

#### PATCH `/api/v1/notifications/{notification_id}`

Update notification state (read, dismissed, clicked).

**Request Body**:
```json
{
  "status": "dismissed",
  "dismissed_from": "oriva_core"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "notification_id": "notif_uuid_123",
  "status": "dismissed",
  "updated_at": "2025-09-30T10:35:00Z"
}
```

#### DELETE `/api/v1/notifications/{notification_id}`

Delete a notification (hard delete).

**Response** (204 No Content)

### 3. Event Querying

#### GET `/api/v1/apps/{app_id}/events`

Query historical events for an app.

**Query Parameters**:
- `event_category` (optional)
- `event_type` (optional)
- `user_id` (optional)
- `entity_id` (optional)
- `start_date` (optional, ISO8601)
- `end_date` (optional, ISO8601)
- `limit` (default: 100, max: 500)
- `offset` (default: 0)

**Response** (200 OK):
```json
{
  "success": true,
  "events": [
    {
      "id": "evt_789xyz",
      "event_category": "notification",
      "event_type": "dismissed",
      "entity_type": "notification",
      "entity_id": "wb_notif_123",
      "user_id": "user_456",
      "event_data": { ... },
      "timestamp": "2025-09-30T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

### 4. Webhook Management

#### POST `/api/v1/apps/{app_id}/webhooks`

Subscribe to platform events via webhook.

**Request Body**:
```json
{
  "webhook_url": "https://workbuddy.com/api/oriva-events",
  "subscribed_events": [
    "notification.dismissed",
    "notification.clicked",
    "user.profile_updated"
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "webhook_id": "wh_uuid_456",
  "webhook_secret": "whsec_xxxxxxxxxxxxxx",
  "created_at": "2025-09-30T10:00:00Z"
}
```

#### GET `/api/v1/apps/{app_id}/webhooks`

List app's webhooks.

#### PATCH `/api/v1/apps/{app_id}/webhooks/{webhook_id}`

Update webhook configuration.

#### DELETE `/api/v1/apps/{app_id}/webhooks/{webhook_id}`

Delete webhook subscription.

### 5. WebSocket Connection

#### WSS `/api/v1/events/stream?app_id={app_id}&auth={token}`

Real-time event stream via WebSocket.

**Connection**:
```javascript
const ws = new WebSocket(
  'wss://api.oriva.io/api/v1/events/stream?app_id=work-buddy&auth=bearer_token'
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event received:', data);
};
```

**Event Format**:
```json
{
  "event_id": "evt_789xyz",
  "event_category": "notification",
  "event_type": "dismissed",
  "entity_type": "notification",
  "entity_id": "wb_notif_123",
  "user_id": "user_456",
  "event_data": { ... },
  "timestamp": "2025-09-30T10:30:00Z"
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

**Database Setup**
- [ ] Create migration file for all tables
- [ ] Add indexes and constraints
- [ ] Create database functions and triggers
- [ ] Set up RLS policies

**API Foundation**
- [ ] Create `/api/v1/apps/{app_id}/events` endpoint
- [ ] Create `/api/v1/apps/{app_id}/notifications` endpoint
- [ ] Implement authentication and authorization
- [ ] Add request validation with express-validator
- [ ] Set up rate limiting

### Phase 2: Notification Aggregation (Week 2-3)

**Notification API**
- [ ] Create `GET /api/v1/users/{user_id}/notifications`
- [ ] Create `PATCH /api/v1/notifications/{id}`
- [ ] Create `DELETE /api/v1/notifications/{id}`
- [ ] Implement notification state management
- [ ] Add filtering and pagination

**Integration**
- [ ] Create service layer for notification operations
- [ ] Add event publishing on state changes
- [ ] Implement notification expiry logic

### Phase 3: Webhook System (Week 3-4)

**Webhook Management**
- [ ] Create webhook CRUD endpoints
- [ ] Implement webhook signature verification (HMAC)
- [ ] Create webhook delivery worker
- [ ] Add retry logic with exponential backoff
- [ ] Implement delivery logging

**Event Distribution**
- [ ] Create event matcher (check subscriptions)
- [ ] Build webhook delivery queue
- [ ] Add failure handling and alerting

### Phase 4: Real-Time Streaming (Week 4-5)

**WebSocket Server**
- [ ] Set up WebSocket server with `ws` library
- [ ] Implement connection authentication
- [ ] Create event broadcasting system
- [ ] Add connection management (ping/pong)
- [ ] Implement subscription filtering

**Integration**
- [ ] Connect event publishing to WebSocket broadcast
- [ ] Add user-specific event filtering
- [ ] Implement reconnection handling

### Phase 5: Testing & Documentation (Week 5-6)

**Testing**
- [ ] Unit tests for all endpoints
- [ ] Integration tests for event flow
- [ ] Webhook delivery tests
- [ ] WebSocket connection tests
- [ ] Load testing for scalability

**Documentation**
- [ ] API documentation in OpenAPI spec
- [ ] Developer guide for event publishing
- [ ] Webhook integration guide
- [ ] WebSocket client examples
- [ ] Update START_GUIDE.md

### Phase 6: Oriva Core Integration (Week 6-7)

**Frontend Development**
- [ ] Create notification center UI component
- [ ] Implement notification list with filtering
- [ ] Add real-time updates via WebSocket
- [ ] Create notification action handlers
- [ ] Add notification preferences UI

**Backend Integration**
- [ ] Connect Oriva Core to notifications API
- [ ] Implement WebSocket client
- [ ] Add state synchronization
- [ ] Create deep linking handler

### Phase 7: Work Buddy Integration (Week 7-8)

**Work Buddy Updates**
- [ ] Update sync endpoint to use new API
- [ ] Enable webhook subscriptions
- [ ] Add WebSocket client (optional)
- [ ] Update notification models
- [ ] Deploy and test

**Monitoring**
- [ ] Set up event tracking
- [ ] Create analytics dashboard
- [ ] Add alerting for failures
- [ ] Monitor webhook delivery rates

---

## Technical Considerations

### Scalability

**Database Partitioning**
- Partition `platform_events` by month for historical data
- Use table partitioning for high-volume queries
- Archive old events to cold storage after 6 months

**Caching Strategy**
- Cache notification counts per user (Redis)
- Cache unread notification IDs (Redis)
- Invalidate cache on state changes

**WebSocket Scaling**
- Use Redis pub/sub for multi-instance WebSocket
- Implement sticky sessions for connection affinity
- Plan for horizontal scaling with load balancer

### Security

**Authentication & Authorization**
- API key authentication for app endpoints
- JWT tokens for user-specific endpoints
- Validate app_id matches authenticated app
- Implement per-user rate limiting

**Webhook Security**
- HMAC-SHA256 signature for webhook payloads
- TLS required for webhook URLs
- Implement webhook secret rotation
- Rate limit webhook delivery attempts

**Data Privacy**
- Only expose notifications to authorized users
- Sanitize notification content for XSS
- Implement notification expiry for sensitive data
- Audit log all state changes

### Error Handling

**Webhook Failures**
- Retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Max 5 retries per event
- Disable webhook after 100 consecutive failures
- Alert app developer on webhook failures

**Event Publishing Failures**
- Return 500 errors for transient failures
- Return 400 errors for validation failures
- Log all failures for debugging
- Implement circuit breaker for database issues

### Monitoring & Observability

**Metrics**
- Event publishing rate per app
- Notification creation rate
- Webhook delivery success rate
- WebSocket connection count
- API response times

**Alerting**
- Alert on webhook failure rate > 10%
- Alert on event publishing failures
- Alert on database query slowness
- Alert on WebSocket disconnections

**Logging**
- Structured logging with Winston
- Log all API requests with request ID
- Log webhook deliveries with payload
- Log WebSocket connections and disconnects

---

## Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Event Publishing | 1,000 events | Per 15 minutes per app |
| Notification Creation | 500 notifications | Per 15 minutes per app |
| Notification Queries | 1,000 requests | Per 15 minutes per user |
| Webhook Management | 50 requests | Per 15 minutes per app |
| WebSocket Connections | 10 concurrent | Per user |

---

## Success Metrics

### Developer Adoption
- **Target**: 10+ apps using events API in first quarter
- **Target**: 5+ apps with webhook subscriptions
- **Target**: 3+ apps using WebSocket streaming

### User Engagement
- **Target**: 80% of notifications viewed in Oriva Core
- **Target**: < 5% notification delivery failures
- **Target**: Average notification action rate > 30%

### System Performance
- **Target**: 99.9% API uptime
- **Target**: < 100ms p95 response time for notification queries
- **Target**: < 5s webhook delivery time (p95)
- **Target**: > 95% webhook delivery success rate

### Platform Growth
- **Target**: 100K+ events per day
- **Target**: 10K+ notifications per day
- **Target**: 1K+ webhook deliveries per day

---

## Migration Path for Work Buddy

### Step 1: Update Environment Variables
```bash
ORIVA_API_BASE=https://api.oriva.io/api/v1
ORIVA_API_KEY=wb_xxxxxxxxxxxxxxxx
```

### Step 2: Update Notification Sync Code

**Before**:
```typescript
// Work Buddy's current code
await fetch(`${ORIVA_API_BASE}/apps/work-buddy/notifications/events`, {
  method: 'POST',
  body: JSON.stringify({
    notification_id: 'wb_123',
    status: 'dismissed'
  })
});
```

**After**:
```typescript
// Updated for new API
await fetch(`${ORIVA_API_BASE}/apps/work-buddy/notifications`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ORIVA_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    external_id: 'wb_123',
    user_id: user.id,
    notification_type: 'session_reminder',
    title: 'Session starting soon',
    body: 'Your session with Sarah starts in 10 minutes',
    action_url: 'workbuddy://session/789',
    priority: 'high',
    context_data: {
      session_id: 'session_789'
    }
  })
});
```

### Step 3: Subscribe to Webhooks
```typescript
// Register webhook to receive events
await fetch(`${ORIVA_API_BASE}/apps/work-buddy/webhooks`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ORIVA_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    webhook_url: 'https://workbuddy.com/api/oriva-events',
    subscribed_events: [
      'notification.dismissed',
      'notification.clicked'
    ]
  })
});
```

### Step 4: Handle Webhook Events
```typescript
// api/oriva-events endpoint in Work Buddy
app.post('/api/oriva-events', async (req, res) => {
  // Verify webhook signature
  const signature = req.headers['x-oriva-signature'];
  const isValid = verifyWebhookSignature(req.body, signature, webhookSecret);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  if (event.event_type === 'notification.dismissed') {
    // Update local notification state
    await NotificationRepository.updateStatus(
      event.entity_id,
      'dismissed'
    );
  }

  res.status(200).json({ success: true });
});
```

---

## Open Questions

### For Product Team
1. Should notification preferences be centralized in Oriva Core?
2. Should users be able to mute notifications from specific apps?
3. What notification retention policy should we implement?
4. Should we support notification grouping/threading?

### For Engineering Team
1. Should we implement event replay for debugging?
2. What's our strategy for database backups and disaster recovery?
3. Should we support batch event publishing?
4. Do we need a message queue (e.g., RabbitMQ) for webhook delivery?

### For Security Team
1. Should we implement webhook URL allowlist?
2. What's our policy for handling sensitive notification content?
3. Should we support encrypted notification payloads?
4. What audit logging requirements do we have?

---

## Related Documents

- [API Overview](./API_OVERVIEW.md)
- [Start Guide](./START_GUIDE.md)
- [OpenAPI Specification](./openapi.yml)
- Work Buddy: `specs/009-user-notifications-epic/`

---

**Next Steps**:
1. Review and approve this design document
2. Estimate implementation timeline (6-8 weeks)
3. Assign engineering resources
4. Schedule kickoff meeting with Work Buddy team
5. Begin Phase 1 implementation

---

**Document Status**: Draft for Review
**Last Updated**: 2025-09-30
**Author**: Claude Code (Oriva Platform Team)
