# Data Model: Platform Events & Notifications System

**Feature**: 004-events-notifications-system
**Date**: 2025-09-30
**Status**: Phase 1 Complete ✅

---

## Overview

This document defines the data model for the Platform Events & Notifications System, including all entities, relationships, validation rules, and state transitions. The model supports:

- Generic event publishing from third-party apps
- Notification content storage with app metadata
- Per-user notification state tracking
- Webhook subscription management
- Webhook delivery audit logging

---

## Entity Definitions

### 1. PlatformEvent

**Purpose**: Records all events that occur in the Oriva ecosystem for audit, analytics, and webhook distribution.

**Table**: `platform_events`

**Attributes**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| id | UUID | Yes | Primary key | Auto-generated |
| app_id | TEXT | Yes | Source app identifier | FK to apps.app_id |
| user_id | UUID | Yes | Affected user | FK to auth.users.id |
| event_category | TEXT | Yes | High-level grouping | Enum: notification, user, session, transaction |
| event_type | TEXT | Yes | Specific action | Max 100 chars, lowercase |
| entity_type | TEXT | Yes | What was affected | Max 100 chars |
| entity_id | TEXT | Yes | ID of affected entity | Max 255 chars |
| event_data | JSONB | No | Flexible event payload | Valid JSON object |
| timestamp | TIMESTAMPTZ | Yes | When event occurred | Server-generated, immutable |
| ip_address | INET | No | Request IP address | For audit trail |
| user_agent | TEXT | No | Request user agent | For audit trail |
| created_at | TIMESTAMPTZ | Yes | Record creation time | Auto-generated |

**Relationships**:
- app_id → apps.app_id (many events per app)
- user_id → auth.users.id (many events per user)
- Referenced by webhook_delivery_log.event_id

**Indexes**:
- Primary: id
- Composite: (app_id, user_id, created_at DESC) - for app/user event history
- Composite: (event_category, event_type, created_at DESC) - for analytics
- Composite: (user_id, timestamp DESC) - for user timeline
- GIN: event_data jsonb_path_ops - for JSONB queries

**Validation Rules**:
- event_category must be one of: notification, user, session, transaction (FR-001)
- event_type must be lowercase, no spaces
- entity_id cannot be empty
- timestamp cannot be in the future
- event_data must be valid JSON object (not array or primitive)

**State Transitions**: N/A (immutable records)

**Example**:
```json
{
  "id": "evt_123abc",
  "app_id": "work-buddy",
  "user_id": "user_456",
  "event_category": "notification",
  "event_type": "dismissed",
  "entity_type": "notification",
  "entity_id": "wb_notif_789",
  "event_data": {
    "dismissed_at": "2025-09-30T10:30:00Z",
    "dismissed_from": "oriva_core"
  },
  "timestamp": "2025-09-30T10:30:00.123Z",
  "created_at": "2025-09-30T10:30:00.456Z"
}
```

---

### 2. PlatformNotification

**Purpose**: Stores notification content created by third-party apps, immutable once created.

**Table**: `platform_notifications`

**Attributes**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| id | UUID | Yes | Primary key | Auto-generated |
| app_id | TEXT | Yes | Source app identifier | FK to apps.app_id |
| external_id | TEXT | Yes | App's notification ID | Max 255 chars |
| user_id | UUID | Yes | Target user | FK to auth.users.id |
| notification_type | TEXT | Yes | Notification category | Max 100 chars |
| title | TEXT | Yes | Notification title | 1-200 chars (FR-007) |
| body | TEXT | Yes | Notification body | 1-1000 chars (FR-007) |
| action_url | TEXT | No | Deep link URL | Valid URL format |
| action_label | TEXT | No | Action button text | Max 50 chars |
| image_url | TEXT | No | Rich content image | Valid URL format |
| icon_url | TEXT | No | Custom icon URL | Valid URL format |
| context_data | JSONB | No | Additional metadata | Valid JSON object |
| priority | TEXT | Yes | Display priority | Enum: low, normal, high, urgent (FR-011) |
| expires_at | TIMESTAMPTZ | No | Expiry timestamp | Must be in future if set |
| created_at | TIMESTAMPTZ | Yes | Creation timestamp | Auto-generated |
| updated_at | TIMESTAMPTZ | Yes | Last update timestamp | Auto-updated on changes |

**Relationships**:
- app_id → apps.app_id (many notifications per app)
- user_id → auth.users.id (many notifications per user)
- Has many notification_state records (one per user viewing)

**Constraints**:
- UNIQUE (app_id, external_id) - prevent duplicate notifications (FR-013)

**Indexes**:
- Primary: id
- Unique: (app_id, external_id)
- Composite: (user_id, created_at DESC) - for user notification feed
- Composite: (app_id, user_id, created_at DESC) - for app-specific queries
- Single: notification_type - for filtering
- GIN: context_data jsonb_path_ops - for JSONB queries
- Partial: (user_id, created_at DESC) WHERE expires_at IS NULL OR expires_at > NOW() - for unexpired notifications

**Validation Rules**:
- title must be 1-200 characters (FR-007)
- body must be 1-1000 characters (FR-007)
- priority must be one of: low, normal, high, urgent (FR-011)
- action_url must be valid URL if provided (FR-010)
- expires_at must be in future if provided
- external_id must be unique per app (FR-013)

**State Transitions**: N/A (immutable content)

**Example**:
```json
{
  "id": "notif_123abc",
  "app_id": "work-buddy",
  "external_id": "wb_notif_789",
  "user_id": "user_456",
  "notification_type": "session_reminder",
  "title": "Session starting in 10 minutes",
  "body": "Your session with Sarah starts soon. Get ready!",
  "action_url": "workbuddy://session/session_789",
  "action_label": "View Session",
  "priority": "high",
  "context_data": {
    "session_id": "session_789",
    "partner_name": "Sarah"
  },
  "expires_at": "2025-09-30T12:00:00Z",
  "created_at": "2025-09-30T10:00:00Z",
  "updated_at": "2025-09-30T10:00:00Z"
}
```

---

### 3. NotificationState

**Purpose**: Tracks per-user state for each notification (read, dismissed, clicked, etc.). Mutable and frequently updated.

**Table**: `notification_state`

**Attributes**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| id | UUID | Yes | Primary key | Auto-generated |
| notification_id | UUID | Yes | Related notification | FK to platform_notifications.id |
| user_id | UUID | Yes | User this state belongs to | FK to auth.users.id |
| status | TEXT | Yes | Current state | Enum: unread, read, dismissed, clicked, expired (FR-014) |
| sent_at | TIMESTAMPTZ | No | When notification was sent | Set on creation |
| delivered_at | TIMESTAMPTZ | No | When delivered to device | Set when user receives |
| read_at | TIMESTAMPTZ | No | When user read notification | Set on first read |
| dismissed_at | TIMESTAMPTZ | No | When user dismissed | Set on dismiss |
| clicked_at | TIMESTAMPTZ | No | When user clicked action | Set on click |
| dismissed_from | TEXT | No | Where dismissed | App ID or 'oriva_core' |
| click_action | TEXT | No | What action was taken | Description of click |
| created_at | TIMESTAMPTZ | Yes | Record creation | Auto-generated |
| updated_at | TIMESTAMPTZ | Yes | Last update | Auto-updated on changes |

**Relationships**:
- notification_id → platform_notifications.id (many states per notification)
- user_id → auth.users.id (many states per user)

**Constraints**:
- UNIQUE (notification_id, user_id) - one state record per user per notification
- CHECK: status transitions must be valid (see State Transitions below)

**Indexes**:
- Primary: id
- Unique: (notification_id, user_id)
- Composite: (user_id, status, updated_at DESC) - for user feeds filtered by status
- Single: notification_id - for notification queries

**Validation Rules**:
- status must be one of: unread, read, dismissed, clicked, expired (FR-014)
- State transitions must follow state machine (FR-018)
- Timestamps are immutable once set (FR-019)
- dismissed_from required when status=dismissed
- clicked_at required when status=clicked

**State Transitions** (Finite State Machine):

```
unread → read → dismissed
       ↘ clicked → dismissed
       ↘ expired

Valid transitions:
- unread → read (user opens notification)
- unread → dismissed (user dismisses without reading)
- unread → clicked (user clicks action without reading)
- unread → expired (notification expires)
- read → dismissed (user dismisses after reading)
- read → clicked (user clicks action after reading)
- clicked → dismissed (user dismisses after clicking)
- Any → dismissed (idempotent - FR-018)

Invalid transitions:
- dismissed → any (terminal state)
- expired → any (terminal state)
- clicked → read (can't unclick)
```

**Example**:
```json
{
  "id": "state_123abc",
  "notification_id": "notif_456def",
  "user_id": "user_789",
  "status": "dismissed",
  "sent_at": "2025-09-30T10:00:00Z",
  "delivered_at": "2025-09-30T10:00:01Z",
  "read_at": "2025-09-30T10:15:00Z",
  "dismissed_at": "2025-09-30T10:30:00Z",
  "dismissed_from": "oriva_core",
  "created_at": "2025-09-30T10:00:00Z",
  "updated_at": "2025-09-30T10:30:00Z"
}
```

---

### 4. AppWebhook

**Purpose**: Stores webhook subscriptions for apps to receive event notifications via HTTP callbacks.

**Table**: `app_webhooks`

**Attributes**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| id | UUID | Yes | Primary key | Auto-generated |
| app_id | TEXT | Yes | Subscribing app | FK to apps.app_id |
| webhook_url | TEXT | Yes | Callback URL | Valid HTTPS URL (FR-027) |
| webhook_secret | TEXT | Yes | HMAC signing secret | Min 32 chars, secure random (FR-031) |
| subscribed_events | TEXT[] | Yes | Event type patterns | Array of event patterns (FR-028) |
| is_active | BOOLEAN | Yes | Subscription active | Default true |
| last_delivery_at | TIMESTAMPTZ | No | Last delivery attempt | Updated on each attempt |
| last_success_at | TIMESTAMPTZ | No | Last successful delivery | Updated on 2xx response |
| last_failure_at | TIMESTAMPTZ | No | Last failed delivery | Updated on error |
| consecutive_failures | INTEGER | Yes | Failure count | Default 0, reset on success |
| total_deliveries | INTEGER | Yes | Total attempts | Default 0 |
| total_failures | INTEGER | Yes | Total failures | Default 0 |
| max_retries | INTEGER | Yes | Retry limit | Default 5 (FR-030) |
| retry_backoff_seconds | INTEGER | Yes | Initial backoff | Default 1 |
| created_at | TIMESTAMPTZ | Yes | Created timestamp | Auto-generated |
| updated_at | TIMESTAMPTZ | Yes | Updated timestamp | Auto-updated |

**Relationships**:
- app_id → apps.app_id (many webhooks per app)
- Has many webhook_delivery_log records

**Indexes**:
- Primary: id
- Single: app_id - for app webhook management
- Single: is_active - for active webhook queries

**Validation Rules**:
- webhook_url must be valid HTTPS URL (FR-027)
- webhook_secret must be at least 32 characters (FR-031)
- subscribed_events must be non-empty array (FR-028)
- Event patterns support wildcards: "notification.*", "user.profile_updated"
- max_retries must be 1-10
- Auto-disable when consecutive_failures >= 100 (FR-034)

**State Transitions**:
```
active → inactive (manual disable or 100 failures)
inactive → active (manual re-enable after fixing endpoint)
```

**Example**:
```json
{
  "id": "wh_123abc",
  "app_id": "work-buddy",
  "webhook_url": "https://workbuddy.com/api/oriva-events",
  "webhook_secret": "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscribed_events": ["notification.dismissed", "notification.clicked"],
  "is_active": true,
  "last_delivery_at": "2025-09-30T10:30:00Z",
  "last_success_at": "2025-09-30T10:30:00Z",
  "consecutive_failures": 0,
  "total_deliveries": 42,
  "total_failures": 2,
  "max_retries": 5,
  "retry_backoff_seconds": 1,
  "created_at": "2025-09-20T00:00:00Z",
  "updated_at": "2025-09-30T10:30:00Z"
}
```

---

### 5. WebhookDeliveryLog

**Purpose**: Audit trail for all webhook delivery attempts, enables debugging and monitoring.

**Table**: `webhook_delivery_log`

**Attributes**:

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| id | UUID | Yes | Primary key | Auto-generated |
| webhook_id | UUID | Yes | Related webhook | FK to app_webhooks.id |
| event_id | UUID | No | Related event | FK to platform_events.id, NULL if event deleted |
| event_type | TEXT | Yes | Event type delivered | Copy from event (for history) |
| payload | JSONB | Yes | Delivered payload | Full webhook payload |
| status_code | INTEGER | No | HTTP response code | 100-599 range |
| response_body | TEXT | No | Response body | Truncated to 10KB |
| response_headers | JSONB | No | Response headers | Selected headers only |
| delivery_attempt | INTEGER | Yes | Attempt number | 1-based, max 5 (FR-030) |
| delivered_at | TIMESTAMPTZ | Yes | Delivery timestamp | Server time |
| response_time_ms | INTEGER | No | Response time | Milliseconds |
| success | BOOLEAN | Yes | Delivery succeeded | True if 2xx response |
| error_message | TEXT | No | Error details | For failed deliveries |

**Relationships**:
- webhook_id → app_webhooks.id (many logs per webhook)
- event_id → platform_events.id (many logs per event)

**Indexes**:
- Primary: id
- Composite: (webhook_id, delivered_at DESC) - for webhook history
- Single: event_id - for event delivery tracking
- Composite: (success, delivered_at DESC) - for failure analysis

**Validation Rules**:
- delivery_attempt must be 1-5 (FR-030)
- status_code must be valid HTTP code if present
- success = true if status_code 200-299, false otherwise (FR-033)
- response_body truncated to 10KB to prevent storage bloat
- error_message required when success=false

**Retention Policy**:
- Keep 30 days in hot storage
- Archive 31-180 days to cold storage
- Delete after 180 days

**Example**:
```json
{
  "id": "log_123abc",
  "webhook_id": "wh_456def",
  "event_id": "evt_789ghi",
  "event_type": "notification.dismissed",
  "payload": {
    "event_id": "evt_789ghi",
    "event_category": "notification",
    "event_type": "dismissed",
    "entity_id": "notif_123",
    "timestamp": "2025-09-30T10:30:00Z"
  },
  "status_code": 200,
  "response_body": "{\"success\":true}",
  "delivery_attempt": 1,
  "delivered_at": "2025-09-30T10:30:01Z",
  "response_time_ms": 150,
  "success": true
}
```

---

## Entity Relationships Diagram

```
┌─────────────────┐
│      apps       │
│   (existing)    │
└────────┬────────┘
         │
         │ 1:N
         │
    ┌────▼─────────────────┐       ┌──────────────────────┐
    │  platform_events     │       │ platform_notifications│
    │                      │       │                       │
    │  - id (PK)           │       │  - id (PK)            │
    │  - app_id (FK)       │       │  - app_id (FK)        │
    │  - user_id (FK)      │       │  - user_id (FK)       │
    │  - event_category    │       │  - external_id        │
    │  - event_type        │       │  - title              │
    │  - entity_id         │       │  - body               │
    │  - event_data        │       │  - priority           │
    └─────┬────────────────┘       └──────┬───────────────┘
          │                                │
          │                                │ 1:N
          │                                │
          │                          ┌─────▼────────────────┐
          │                          │ notification_state   │
          │                          │                      │
          │                          │  - id (PK)           │
          │                          │  - notification_id   │
          │                          │  - user_id (FK)      │
          │                          │  - status            │
          │                          │  - read_at           │
          │                          │  - dismissed_at      │
          │                          └──────────────────────┘
          │
          │ N:1 (reference)
          │
    ┌─────▼────────────────┐       ┌──────────────────────┐
    │ webhook_delivery_log │◄──────┤  app_webhooks        │
    │                      │  N:1  │                      │
    │  - id (PK)           │       │  - id (PK)           │
    │  - webhook_id (FK)   │       │  - app_id (FK)       │
    │  - event_id (FK)     │       │  - webhook_url       │
    │  - payload           │       │  - subscribed_events │
    │  - success           │       │  - is_active         │
    └──────────────────────┘       └──────────────────────┘
```

---

## Data Access Patterns

### Pattern 1: User Notification Feed (High Frequency)
```sql
-- Get unread notifications for user, sorted by priority and time
SELECT n.*, ns.status, ns.read_at
FROM platform_notifications n
JOIN notification_state ns ON n.id = ns.notification_id
WHERE ns.user_id = :user_id
  AND ns.status = 'unread'
  AND (n.expires_at IS NULL OR n.expires_at > NOW())
ORDER BY
  CASE n.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  n.created_at DESC
LIMIT 50 OFFSET :offset;
```

**Index Used**: notification_state (user_id, status, updated_at DESC)

### Pattern 2: App Event History (Medium Frequency)
```sql
-- Get recent events for an app
SELECT *
FROM platform_events
WHERE app_id = :app_id
  AND event_category = :category  -- optional filter
  AND created_at > :start_date
ORDER BY created_at DESC
LIMIT 100 OFFSET :offset;
```

**Index Used**: platform_events (app_id, user_id, created_at DESC)

### Pattern 3: Notification State Update (High Frequency)
```sql
-- Dismiss notification (idempotent)
UPDATE notification_state
SET
  status = 'dismissed',
  dismissed_at = COALESCE(dismissed_at, NOW()),
  dismissed_from = :source,
  updated_at = NOW()
WHERE notification_id = :notification_id
  AND user_id = :user_id
RETURNING *;
```

**Index Used**: notification_state UNIQUE (notification_id, user_id)

### Pattern 4: Webhook Delivery (Background Worker)
```sql
-- Find webhooks needing retry
SELECT wh.*, wdl.*
FROM app_webhooks wh
LEFT JOIN webhook_delivery_log wdl ON wh.id = wdl.webhook_id
WHERE wh.is_active = true
  AND wdl.success = false
  AND wdl.delivery_attempt < wh.max_retries
  AND wdl.delivered_at < NOW() - (wh.retry_backoff_seconds * 2^wdl.delivery_attempt) * INTERVAL '1 second'
ORDER BY wdl.delivered_at ASC
LIMIT 100;
```

**Index Used**: webhook_delivery_log (success, delivered_at DESC)

---

## Data Lifecycle & Retention

| Entity | Hot Storage | Archive | Delete |
|--------|-------------|---------|--------|
| platform_events | 6 months | 6-24 months | After 24 months |
| platform_notifications | Until expired + 30 days | 30-180 days | After 180 days |
| notification_state | Until notification deleted | N/A | Cascade with notification |
| app_webhooks | Indefinite | N/A | Manual only |
| webhook_delivery_log | 30 days | 30-180 days | After 180 days |

**Archival Strategy**:
- Monthly cron job moves old records to separate archive tables
- Archive tables have reduced indexes (primary key only)
- Archive tables not queried by API (export only)

---

## Summary

**5 Core Entities**:
1. PlatformEvent - Generic event audit log
2. PlatformNotification - Notification content (immutable)
3. NotificationState - Per-user state (mutable)
4. AppWebhook - Webhook subscriptions
5. WebhookDeliveryLog - Delivery audit trail

**Key Design Principles**:
- ✅ Separation of content vs. state (performance)
- ✅ Comprehensive indexing (query optimization)
- ✅ RLS policies (security)
- ✅ State machine validation (data integrity)
- ✅ Audit trail (debugging & compliance)

**Constitutional Compliance**:
- ✅ Privacy-First: App-level data isolation via RLS
- ✅ Database Standards: Supabase patterns, structured logging
- ✅ API-First: Data model supports all API contracts

**Ready for**: Phase 1 contract generation and migration SQL

---

**Related Documents**:
- [spec.md](./spec.md) - Functional requirements
- [research.md](./research.md) - Technical decisions
- [plan.md](./plan.md) - Implementation plan
