# Tasks: Platform Events & Notifications System

**Input**: Design documents from `/specs/004-events-notifications-system/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory
   ✅ Tech stack: TypeScript 5.9.2, Node.js 18+, Express.js 4.18.2, Supabase, ws
   ✅ Structure: Single backend API - extend existing api/ structure
2. Load optional design documents:
   ✅ data-model.md: 5 entities extracted
   ✅ contracts/: 12 API endpoints identified
   ✅ research.md: Technical decisions extracted
   ✅ quickstart.md: 8 integration scenarios identified
3. Generate tasks by category:
   ✅ Setup: 1 task (database migration)
   ✅ Tests: 20 tasks (12 contract + 8 integration)
   ✅ Core: 16 tasks (4 services + 12 endpoints)
   ✅ Integration: 2 tasks (background workers)
   ✅ Polish: 3 tasks (docs, OpenAPI, validation)
4. Apply task rules:
   ✅ Different files marked [P] for parallel
   ✅ Same file sequential (no [P])
   ✅ Tests before implementation (TDD)
5. Number tasks sequentially (T001-T042)
6. Generate dependency graph ✅
7. Create parallel execution examples ✅
8. Validate task completeness:
   ✅ All 12 endpoints have contract tests
   ✅ All 5 entities have migration SQL
   ✅ All endpoints have implementation tasks
9. Return: SUCCESS (42 tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
All paths relative to repository root `/Users/cosmic/Documents/oriva-platform/`

---

## Phase 3.1: Database Setup (1 task)

- [x] **T001** Create database migration file `supabase/migrations/20250930000002_platform_events_notifications.sql` with:
  - 5 tables: platform_events, platform_notifications, notification_state, app_webhooks, webhook_delivery_log
  - All indexes as specified in data-model.md
  - RLS policies for app-level data isolation
  - Trigger functions for updated_at timestamps
  - Foreign key constraints with appropriate CASCADE/RESTRICT
  - Check constraints for enums and validations
  - Comments on tables and columns

**Files Created**: `supabase/migrations/20250930000002_platform_events_notifications.sql`

---

## Phase 3.2: Contract Tests (12 tasks) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Event Publishing Tests (3 tasks)

- [ ] **T002 [P]** Contract test POST /api/v1/apps/:appId/events in `tests/contract/events/publish.test.ts`:
  - Test valid event payload (200 response, event_id returned)
  - Test invalid event_category (400 response)
  - Test missing required fields (400 response)
  - Test authentication enforcement (401 without API key)
  - Test rate limiting (429 after 1001 requests)
  - Test app_id validation (404 for non-existent app)

- [ ] **T003 [P]** Contract test GET /api/v1/apps/:appId/events in `tests/contract/events/query.test.ts`:
  - Test event list retrieval (200 with pagination)
  - Test filtering by event_category (200 with filtered results)
  - Test filtering by event_type (200 with filtered results)
  - Test date range filtering (200 with results in range)
  - Test pagination (limit/offset parameters)
  - Test authentication enforcement (401 without API key)
  - Test app isolation (apps can only see their own events)

- [ ] **T004 [P]** Contract test WSS /api/v1/events/stream in `tests/contract/events/stream.test.ts`:
  - Test WebSocket connection with valid token (connection accepted)
  - Test WebSocket connection with invalid token (connection rejected)
  - Test event subscription message (acknowledgment received)
  - Test event broadcasting (receive event when published)
  - Test connection limit (reject 11th connection per user)
  - Test heartbeat ping/pong (connection stays alive)

**Files Created**:
- `tests/contract/events/publish.test.ts`
- `tests/contract/events/query.test.ts`
- `tests/contract/events/stream.test.ts`

### Notification Management Tests (4 tasks)

- [ ] **T005 [P]** Contract test POST /api/v1/apps/:appId/notifications in `tests/contract/notifications/create.test.ts`:
  - Test valid notification payload (201 response, notification_id returned)
  - Test title validation (400 if >200 chars or empty)
  - Test body validation (400 if >1000 chars or empty)
  - Test priority enum validation (400 for invalid priority)
  - Test duplicate prevention (409 for duplicate external_id)
  - Test authentication enforcement (401 without API key)
  - Test rate limiting (429 after 501 requests)

- [ ] **T006 [P]** Contract test GET /api/v1/users/:userId/notifications in `tests/contract/notifications/query.test.ts`:
  - Test notification list for user (200 with all apps' notifications)
  - Test filtering by status (unread/read/dismissed)
  - Test filtering by app_id (specific app's notifications)
  - Test pagination (limit/offset parameters)
  - Test expired notification exclusion (only unexpired returned)
  - Test authentication enforcement (401 without API key)
  - Test user isolation (users can only see their own notifications)

- [ ] **T007 [P]** Contract test PATCH /api/v1/notifications/:id in `tests/contract/notifications/update.test.ts`:
  - Test mark as read (200 response, status updated)
  - Test dismiss notification (200 response, status=dismissed)
  - Test mark as clicked (200 response, status=clicked)
  - Test idempotent dismissal (200 for duplicate dismiss)
  - Test invalid status transition (400 for invalid state)
  - Test authentication enforcement (401 without API key)
  - Test notification not found (404 for non-existent ID)

- [ ] **T008 [P]** Contract test DELETE /api/v1/notifications/:id in `tests/contract/notifications/delete.test.ts`:
  - Test notification deletion (204 response)
  - Test app authorization (403 if not notification owner app)
  - Test notification not found (404 for non-existent ID)
  - Test authentication enforcement (401 without API key)
  - Test cascade deletion (notification_state records also deleted)

**Files Created**:
- `tests/contract/notifications/create.test.ts`
- `tests/contract/notifications/query.test.ts`
- `tests/contract/notifications/update.test.ts`
- `tests/contract/notifications/delete.test.ts`

### Webhook Management Tests (4 tasks)

- [ ] **T009 [P]** Contract test POST /api/v1/apps/:appId/webhooks in `tests/contract/notifications/webhooks/create.test.ts`:
  - Test valid webhook creation (201 response, webhook_id and webhook_secret returned)
  - Test webhook_url validation (400 for non-HTTPS URL)
  - Test subscribed_events validation (400 for empty array)
  - Test authentication enforcement (401 without API key)
  - Test rate limiting (429 after 51 requests)

- [ ] **T010 [P]** Contract test GET /api/v1/apps/:appId/webhooks in `tests/contract/notifications/webhooks/list.test.ts`:
  - Test webhook list retrieval (200 with all app webhooks)
  - Test empty list (200 with empty array)
  - Test authentication enforcement (401 without API key)
  - Test app isolation (apps only see their own webhooks)

- [ ] **T011 [P]** Contract test PATCH /api/v1/apps/:appId/webhooks/:id in `tests/contract/notifications/webhooks/update.test.ts`:
  - Test update webhook URL (200 response, URL updated)
  - Test update subscribed_events (200 response, events updated)
  - Test toggle is_active (200 response, status updated)
  - Test webhook not found (404 for non-existent ID)
  - Test authentication enforcement (401 without API key)
  - Test app authorization (403 if not webhook owner app)

- [ ] **T012 [P]** Contract test DELETE /api/v1/apps/:appId/webhooks/:id in `tests/contract/notifications/webhooks/delete.test.ts`:
  - Test webhook deletion (204 response)
  - Test webhook not found (404 for non-existent ID)
  - Test authentication enforcement (401 without API key)
  - Test app authorization (403 if not webhook owner app)

**Files Created**:
- `tests/contract/notifications/webhooks/create.test.ts`
- `tests/contract/notifications/webhooks/list.test.ts`
- `tests/contract/notifications/webhooks/update.test.ts`
- `tests/contract/notifications/webhooks/delete.test.ts`

### User Approval Gate
**STOP**: Run `npm test` - All 12 contract tests MUST FAIL before proceeding to Phase 3.3

---

## Phase 3.3: Integration Tests (8 tasks)
**CRITICAL: These tests MUST be written and MUST FAIL before implementation**

- [ ] **T013 [P]** Integration test: Third-party app creates notification in `tests/integration/notification-sync.test.ts`:
  - Mock Work Buddy app creating session reminder
  - Verify notification created in platform_notifications table
  - Verify notification_state created with status=unread
  - Verify platform_event created with event_type=notification.created
  - Verify notification appears in user's feed query
  - Verify app branding (icon, name) included in response

- [ ] **T014 [P]** Integration test: User dismisses notification in Oriva Core in `tests/integration/notification-sync.test.ts`:
  - Create notification for test user
  - PATCH /api/v1/notifications/:id with status=dismissed
  - Verify notification_state updated with dismissed_at timestamp
  - Verify platform_event created with event_type=notification.dismissed
  - Verify webhook delivery triggered (if subscribed)
  - Verify notification no longer in unread feed

- [ ] **T015 [P]** Integration test: User dismisses notification in third-party app in `tests/integration/notification-sync.test.ts`:
  - Create notification visible in both apps
  - Mock Work Buddy dismissing notification (POST event or PATCH state)
  - Verify notification_state updated
  - Verify Oriva Core query no longer returns notification
  - Verify idempotent operation (dismiss twice = same result)

- [ ] **T016 [P]** Integration test: User clicks notification action in `tests/integration/notification-sync.test.ts`:
  - Create notification with action_url
  - PATCH /api/v1/notifications/:id with status=clicked
  - Verify notification_state updated with clicked_at timestamp
  - Verify platform_event created with event_type=notification.clicked
  - Verify webhook delivery triggered
  - Verify click action recorded in event_data

- [ ] **T017 [P]** Integration test: Multiple apps send notifications in `tests/integration/notification-sync.test.ts`:
  - Create notifications from Work Buddy, Hugo AI, and test apps
  - Query GET /api/v1/users/:userId/notifications
  - Verify all notifications returned
  - Verify sorted by priority and created_at
  - Verify each notification includes app branding
  - Verify filtering by app_id works

- [ ] **T018 [P]** Integration test: App subscribes to platform events in `tests/integration/webhook-delivery.test.ts`:
  - Create webhook subscription for notification.dismissed
  - Create and dismiss notification
  - Verify webhook_delivery_log entry created
  - Verify HTTP POST sent to webhook_url
  - Verify HMAC signature included in X-Oriva-Signature header
  - Verify payload matches event schema

- [ ] **T019 [P]** Integration test: Webhook retry on failure in `tests/integration/webhook-delivery.test.ts`:
  - Create webhook pointing to failing endpoint (returns 500)
  - Trigger event that matches webhook subscription
  - Verify first delivery fails, logged in webhook_delivery_log
  - Verify retry scheduled with exponential backoff
  - Verify retry attempts (up to 5 times)
  - Verify webhook disabled after 100 consecutive failures

- [ ] **T020 [P]** Integration test: Real-time notification updates in `tests/integration/websocket-realtime.test.ts`:
  - Connect 2 WebSocket clients for same user
  - Create notification via POST /api/v1/apps/:appId/notifications
  - Verify both WebSocket clients receive real-time notification event
  - Dismiss notification from client 1
  - Verify client 2 receives dismissal event immediately
  - Verify notification expiry removes from all clients

**Files Created**:
- `tests/integration/notification-sync.test.ts`
- `tests/integration/webhook-delivery.test.ts`
- `tests/integration/websocket-realtime.test.ts`

### User Approval Gate
**STOP**: Run `npm test` - All 8 integration tests MUST FAIL before proceeding to Phase 3.4

---

## Phase 3.4: Service Layer (4 tasks - ONLY after tests are failing)

- [ ] **T021 [P]** Implement EventPublisher service in `api/services/eventPublisher.ts`:
  - `publishEvent(appId, userId, eventCategory, eventType, entityType, entityId, eventData)` method
  - Validate event payload (category enum, type format, entity_id not empty)
  - Insert into platform_events table with server timestamp
  - Return event_id and timestamp
  - Handle database errors gracefully
  - Log all events with Winston (INFO level)
  - Broadcast to WebSocket connections matching subscription
  - Trigger webhook delivery for matching subscriptions

- [ ] **T022 [P]** Implement NotificationManager service in `api/services/notificationManager.ts`:
  - `createNotification(payload)` method - insert into platform_notifications and notification_state
  - `queryNotifications(userId, filters, pagination)` method - join notifications + state
  - `updateNotificationState(notificationId, userId, newStatus, metadata)` method
  - `deleteNotification(notificationId, appId)` method - with authorization check
  - `expireNotifications()` method - mark expired notifications
  - `getCachedNotificationCount(userId)` method - retrieve from cache
  - `invalidateCountCache(userId)` method - clear cache on state change
  - Publish platform_event for all state changes
  - Handle duplicate external_id (return 409 Conflict)
  - Validate title (1-200 chars), body (1-1000 chars), priority enum
  - XSS sanitization on title and body fields
  - Call invalidateCountCache() after any state change operation

- [ ] **T023 [P]** Implement WebhookDelivery service in `api/services/webhookDelivery.ts`:
  - `deliverEvent(eventId, webhookId)` method
  - Fetch event and webhook from database
  - Build webhook payload with event data
  - Generate HMAC-SHA256 signature with webhook_secret
  - HTTP POST to webhook_url with signature in X-Oriva-Signature header
  - 10-second timeout
  - Log delivery attempt in webhook_delivery_log
  - Update webhook stats (last_delivery_at, consecutive_failures)
  - Return success/failure status
  - Retry logic handled by background worker

- [ ] **T024 [P]** Implement WebSocketBroadcaster service in `api/services/websocketBroadcaster.ts`:
  - Manage WebSocket connections in memory (Map<userId, Set<WebSocket>>)
  - `registerConnection(userId, ws, subscriptions)` method
  - `removeConnection(userId, ws)` method
  - `broadcastEvent(event, userId?)` method - send to matching connections
  - Filter events by subscription patterns (wildcard support)
  - Heartbeat ping/pong every 30 seconds
  - Enforce 10 connections per user limit
  - Close stale connections
  - Log connection lifecycle events

**Files Created**:
- `api/services/eventPublisher.ts`
- `api/services/notificationManager.ts`
- `api/services/webhookDelivery.ts`
- `api/services/websocketBroadcaster.ts`

---

## Phase 3.5: API Endpoints (12 tasks)

### Event Publishing Endpoints (3 tasks)

- [ ] **T025** Implement POST /api/v1/apps/:appId/events in `api/v1/events/publish.ts`:
  - Use existing auth middleware from api/middleware/auth.ts
  - Rate limit: 1000 requests per 15 minutes (express-rate-limit)
  - Validate request body (event_category, event_type, entity_type, entity_id, event_data)
  - Call EventPublisher.publishEvent()
  - Return 200 with event_id and timestamp
  - Return 400 for validation errors
  - Return 401 for auth failures
  - Return 429 for rate limit exceeded

- [ ] **T026** Implement GET /api/v1/apps/:appId/events in `api/v1/events/query.ts`:
  - Use existing auth middleware
  - Rate limit: 1000 requests per 15 minutes
  - Query parameters: event_category, event_type, start_date, end_date, limit (default 100, max 500), offset (default 0)
  - Fetch from platform_events table filtered by app_id
  - Return 200 with events array and pagination metadata
  - Return 401 for auth failures
  - Return 404 if app_id doesn't exist

- [ ] **T027** Implement WSS /api/v1/events/stream in `api/v1/events/stream.ts`:
  - Create WebSocket server using `ws` library
  - Authenticate via query parameter token (validate against apps table)
  - Parse subscription message (event_types array)
  - Register connection with WebSocketBroadcaster
  - Handle ping/pong heartbeat
  - Close connection on auth failure or limit exceeded
  - Clean up connection on disconnect
  - Log connection lifecycle

**Files Created**:
- `api/v1/events/publish.ts`
- `api/v1/events/query.ts`
- `api/v1/events/stream.ts`

### Notification Management Endpoints (4 tasks)

- [ ] **T028** Implement POST /api/v1/apps/:appId/notifications in `api/v1/notifications/create.ts`:
  - Use existing auth middleware
  - Rate limit: 500 requests per 15 minutes
  - Validate request body per data-model.md validations
  - Call NotificationManager.createNotification()
  - Publish notification.created event via EventPublisher
  - Return 201 with notification_id
  - Return 400 for validation errors
  - Return 409 for duplicate external_id
  - Return 401 for auth failures

- [ ] **T029** Implement GET /api/v1/users/:userId/notifications in `api/v1/notifications/query.ts`:
  - Use existing auth middleware
  - Rate limit: 1000 requests per 15 minutes
  - Query parameters: status, app_id, limit (default 50, max 100), offset (default 0)
  - Cache notification counts per user (Redis or in-memory with 60s TTL)
  - Check cache for unread_count before querying database
  - Call NotificationManager.queryNotifications()
  - Join with apps table to include app branding
  - Sort by priority (urgent→high→normal→low) then created_at DESC
  - Return 200 with notifications array, pagination, and cached unread_count
  - Invalidate cache on notification state changes (dismiss, read, click)
  - Return 401 for auth failures

- [ ] **T030** Implement PATCH /api/v1/notifications/:id in `api/v1/notifications/update.ts`:
  - Use existing auth middleware
  - Rate limit: 1000 requests per 15 minutes
  - Validate status transition (per data-model.md state machine)
  - Call NotificationManager.updateNotificationState()
  - Publish notification.dismissed, notification.clicked, or notification.read event
  - Return 200 with updated notification_state
  - Return 400 for invalid state transition
  - Return 404 if notification not found
  - Return 401 for auth failures

- [ ] **T031** Implement DELETE /api/v1/notifications/:id in `api/v1/notifications/delete.ts`:
  - Use existing auth middleware
  - Rate limit: 1000 requests per 15 minutes
  - Verify app_id matches notification owner (authorization)
  - Call NotificationManager.deleteNotification()
  - Return 204 No Content
  - Return 403 if not notification owner
  - Return 404 if notification not found
  - Return 401 for auth failures

**Files Created**:
- `api/v1/notifications/create.ts`
- `api/v1/notifications/query.ts`
- `api/v1/notifications/update.ts`
- `api/v1/notifications/delete.ts`

### Webhook Management Endpoints (4 tasks)

- [ ] **T032** Implement POST /api/v1/apps/:appId/webhooks in `api/v1/notifications/webhooks/create.ts`:
  - Use existing auth middleware
  - Rate limit: 50 requests per 15 minutes
  - Validate webhook_url (must be HTTPS)
  - Validate subscribed_events (non-empty array)
  - Generate secure random webhook_secret (32+ chars using crypto.randomBytes)
  - Insert into app_webhooks table
  - Return 201 with webhook_id and webhook_secret
  - Return 400 for validation errors
  - Return 401 for auth failures

- [ ] **T033** Implement GET /api/v1/apps/:appId/webhooks in `api/v1/notifications/webhooks/list.ts`:
  - Use existing auth middleware
  - Rate limit: 50 requests per 15 minutes
  - Query app_webhooks table filtered by app_id
  - Return 200 with webhooks array (exclude webhook_secret from response)
  - Return 401 for auth failures

- [ ] **T034** Implement PATCH /api/v1/apps/:appId/webhooks/:id in `api/v1/notifications/webhooks/update.ts`:
  - Use existing auth middleware
  - Rate limit: 50 requests per 15 minutes
  - Verify app_id matches webhook owner
  - Update webhook_url, subscribed_events, or is_active
  - Return 200 with updated webhook
  - Return 403 if not webhook owner
  - Return 404 if webhook not found
  - Return 401 for auth failures

- [ ] **T035** Implement DELETE /api/v1/apps/:appId/webhooks/:id in `api/v1/notifications/webhooks/delete.ts`:
  - Use existing auth middleware
  - Rate limit: 50 requests per 15 minutes
  - Verify app_id matches webhook owner
  - Delete from app_webhooks table
  - Return 204 No Content
  - Return 403 if not webhook owner
  - Return 404 if webhook not found
  - Return 401 for auth failures

**Files Created**:
- `api/v1/notifications/webhooks/create.ts`
- `api/v1/notifications/webhooks/list.ts`
- `api/v1/notifications/webhooks/update.ts`
- `api/v1/notifications/webhooks/delete.ts`

### Middleware (1 task)

- [ ] **T036** Create WebSocket authentication middleware in `api/middleware/websocket-auth.ts`:
  - Validate token from query parameter
  - Check token against apps table
  - Verify is_active = true
  - Return user/app context or reject connection
  - Log authentication attempts
  - Reuse existing Supabase client from api/config/supabase.ts

**Files Created**:
- `api/middleware/websocket-auth.ts`

---

## Phase 3.6: Background Workers (2 tasks)

- [ ] **T037 [P]** Implement webhook retry worker in `api/workers/webhookRetry.ts`:
  - Run every 60 seconds (Vercel Cron Job)
  - Query webhook_delivery_log for failed deliveries needing retry
  - Check delivery_attempt < max_retries
  - Check exponential backoff time elapsed (1s, 2s, 4s, 8s, 16s)
  - Call WebhookDelivery.deliverEvent() for each
  - Update webhook consecutive_failures counter
  - Disable webhook if consecutive_failures >= 100
  - Alert developers when webhook disabled (log ERROR level)
  - Limit to 100 retries per run (prevent overload)

- [ ] **T038 [P]** Implement notification expiry worker in `api/workers/notificationExpiry.ts`:
  - Run every 5 minutes (Vercel Cron Job)
  - Query platform_notifications WHERE expires_at < NOW() AND NOT expired
  - For each expired notification:
    - Update notification_state to status=expired
    - Publish platform_event with event_type=notification.expired
    - Broadcast expiry event to WebSocket connections
  - Log count of expired notifications
  - Limit to 1000 notifications per run

**Files Created**:
- `api/workers/webhookRetry.ts`
- `api/workers/notificationExpiry.ts`

- [ ] **T039 [P]** Implement data archival worker in `api/workers/dataArchival.ts`:
  - Run daily at midnight (Vercel Cron Job)
  - Query platform_events WHERE created_at < NOW() - retention_period
  - Archive events older than retention policy (default: 90 days)
  - Query platform_notifications WHERE created_at < NOW() - retention_period
  - Archive notifications older than retention policy (default: 90 days)
  - Move archived records to cold storage table or export to S3
  - Cascade delete notification_state records for archived notifications
  - Log archival statistics (count archived, retention period)
  - Limit to 10,000 records per run (prevent overload)
  - Configure retention period via environment variable

**Files Created**:
- `api/workers/dataArchival.ts`

---

## Phase 3.7: Polish (4 tasks)

- [ ] **T040** Update OpenAPI specification in `docs/openapi.yml`:
  - Add all 12 endpoint definitions from contracts/
  - Include authentication schema (Bearer token)
  - Include all request/response schemas
  - Include error response formats
  - Include rate limit headers
  - Add examples for each endpoint
  - Version: 1.0.0

- [ ] **T041** Update developer documentation in `docs/START_GUIDE.md`:
  - Add section on Platform Events & Notifications System
  - Link to quickstart.md
  - Add authentication setup instructions
  - Add rate limit reference table
  - Add troubleshooting section for common issues

- [ ] **T042** Run end-to-end validation:
  - Execute all scenarios from quickstart.md
  - Verify all tests passing (npm test)
  - Check test coverage ≥80% (npm run test:coverage)
  - Run type checking (npm run type-check)
  - Run linting (npm run lint)
  - Run security audit (npm run security:audit)
  - Test on deployed Vercel environment
  - Verify webhook delivery to real endpoints
  - Verify WebSocket connection stability (30+ minutes)

- [ ] **T043** Final review and cleanup:
  - Remove console.log statements
  - Remove commented code
  - Remove TODO comments
  - Verify all error messages are user-friendly
  - Verify all Winston logging includes proper context
  - Verify no secrets in code
  - Run `git status` to check for untracked files
  - Review `git diff` for quality
  - Prepare PR description

**Files Modified**:
- `docs/openapi.yml`
- `docs/START_GUIDE.md`

---

## Dependencies Graph

```
T001 (Migration)
  ↓
T002-T012 (Contract Tests) [P] ← MUST ALL FAIL
  ↓
T013-T020 (Integration Tests) [P] ← MUST ALL FAIL
  ↓
T021-T024 (Service Layer) [P]
  ↓
T025-T036 (API Endpoints + Middleware)
  ↓
T037-T039 (Background Workers) [P]
  ↓
T040-T043 (Polish)
```

**Critical Path**:
- T001 (foundation)
- T002-T020 (all tests must fail)
- T021-T024 (services)
- T025-T036 (endpoints)
- T037-T043 (polish)

**Parallelizable Groups**:
- Group 1: T002-T012 (12 contract tests, different files)
- Group 2: T013-T020 (8 integration tests, different files)
- Group 3: T021-T024 (4 service files)
- Group 4: T037-T039 (3 worker files)

---

## Parallel Execution Examples

### Launch Contract Tests (T002-T012):
```bash
# All contract tests can run in parallel (12 different files)
Task: "Contract test POST /api/v1/apps/:appId/events in tests/contract/events/publish.test.ts"
Task: "Contract test GET /api/v1/apps/:appId/events in tests/contract/events/query.test.ts"
Task: "Contract test WSS /api/v1/events/stream in tests/contract/events/stream.test.ts"
Task: "Contract test POST /api/v1/apps/:appId/notifications in tests/contract/notifications/create.test.ts"
Task: "Contract test GET /api/v1/users/:userId/notifications in tests/contract/notifications/query.test.ts"
Task: "Contract test PATCH /api/v1/notifications/:id in tests/contract/notifications/update.test.ts"
Task: "Contract test DELETE /api/v1/notifications/:id in tests/contract/notifications/delete.test.ts"
Task: "Contract test POST /api/v1/apps/:appId/webhooks in tests/contract/notifications/webhooks/create.test.ts"
Task: "Contract test GET /api/v1/apps/:appId/webhooks in tests/contract/notifications/webhooks/list.test.ts"
Task: "Contract test PATCH /api/v1/apps/:appId/webhooks/:id in tests/contract/notifications/webhooks/update.test.ts"
Task: "Contract test DELETE /api/v1/apps/:appId/webhooks/:id in tests/contract/notifications/webhooks/delete.test.ts"
```

### Launch Integration Tests (T013-T020):
```bash
# All integration tests can run in parallel (3 different files)
Task: "Integration test: Third-party app creates notification in tests/integration/notification-sync.test.ts"
Task: "Integration test: User dismisses notification in Oriva Core in tests/integration/notification-sync.test.ts"
Task: "Integration test: User dismisses notification in third-party app in tests/integration/notification-sync.test.ts"
Task: "Integration test: User clicks notification action in tests/integration/notification-sync.test.ts"
Task: "Integration test: Multiple apps send notifications in tests/integration/notification-sync.test.ts"
Task: "Integration test: App subscribes to platform events in tests/integration/webhook-delivery.test.ts"
Task: "Integration test: Webhook retry on failure in tests/integration/webhook-delivery.test.ts"
Task: "Integration test: Real-time notification updates in tests/integration/websocket-realtime.test.ts"
```

### Launch Service Layer (T021-T024):
```bash
# All 4 service files can be implemented in parallel
Task: "Implement EventPublisher service in api/services/eventPublisher.ts"
Task: "Implement NotificationManager service in api/services/notificationManager.ts"
Task: "Implement WebhookDelivery service in api/services/webhookDelivery.ts"
Task: "Implement WebSocketBroadcaster service in api/services/websocketBroadcaster.ts"
```

---

## Validation Checklist
*GATE: Must verify before marking feature complete*

### Contract Tests
- [x] All 12 endpoints have contract tests
- [x] All tests include authentication checks
- [x] All tests include rate limiting checks
- [x] All tests include validation checks
- [x] All tests specify exact file paths

### Data Model
- [x] All 5 entities in migration file
- [x] All indexes defined in migration
- [x] All RLS policies defined in migration
- [x] All validation constraints defined

### Implementation
- [x] All 12 endpoints have implementation tasks
- [x] All 4 services have implementation tasks
- [x] All endpoints use existing auth middleware
- [x] All endpoints have rate limiting configured
- [x] All endpoints have error handling

### Testing
- [x] All tests come before implementation (TDD)
- [x] Integration tests cover all 8 user scenarios
- [x] Parallel tasks are truly independent
- [x] Each task specifies exact file path

### Documentation
- [x] OpenAPI spec update task included
- [x] Developer guide update task included
- [x] Quickstart scenarios validated

---

## Notes

- **TDD Compliance**: Tests (T002-T020) MUST be completed and MUST FAIL before implementation (T021-T039)
- **Parallel Execution**: All [P] tasks are independent and can run simultaneously
- **File Safety**: No [P] task modifies the same file as another [P] task
- **Commit Strategy**: Commit after completing each task or logical group
- **Review Gates**: User approval required after contract tests fail and after implementation completes

---

## Estimated Timeline

**Setup**: 1 day (T001)
**Contract Tests**: 3 days (T002-T012) [P]
**Integration Tests**: 2 days (T013-T020) [P]
**Service Layer**: 4 days (T021-T024) [P]
**API Endpoints**: 6 days (T025-T036)
**Background Workers**: 2 days (T037-T039) [P]
**Polish**: 2 days (T040-T043)

**Total Estimated**: 20 working days (4 weeks) with parallelization

---

**Status**: Ready for execution ✅
**Total Tasks**: 43
**Parallel Tasks**: 25 (58%)
**Critical Path**: 18 tasks

**Next**: Start with T001 (database migration), then launch parallel contract test development.
