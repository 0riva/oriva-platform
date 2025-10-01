# Implementation Plan: Platform Events & Notifications System

**Branch**: `004-events-notifications-system` | **Date**: 2025-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-events-notifications-system/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   ✅ Feature spec loaded successfully
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   ✅ Project Type: Single backend API (existing api/ structure)
   ✅ Structure Decision: Use existing api/ structure with new v1/events and v1/notifications routes
3. Fill the Constitution Check section
   ✅ All constitutional principles documented below
4. Evaluate Constitution Check section
   ✅ No violations - follows API-First, TDD, Privacy-First architecture
   ✅ Update Progress Tracking: Initial Constitution Check PASSED
5. Execute Phase 0 → research.md
   ✅ Technical decisions resolved from docs/PLATFORM_EVENTS_AND_NOTIFICATIONS.md
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent file
   ✅ All Phase 1 artifacts ready for generation
7. Re-evaluate Constitution Check section
   ✅ No new violations
   ✅ Update Progress Tracking: Post-Design Constitution Check PASSED
8. Plan Phase 2 → Task generation approach described
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

The Platform Events & Notifications System creates a unified event publishing and notification aggregation infrastructure for the Oriva ecosystem. Third-party apps (like Work Buddy, Hugo AI) publish notifications and events to the platform, which stores them centrally and synchronizes state across all apps and devices. Users experience seamless notification management in Oriva Core's centralized notification center, with cross-app state synchronization (dismiss once, dismissed everywhere). The system includes webhook subscriptions for bidirectional event flow and real-time WebSocket updates for instant synchronization.

**Technical Approach**: RESTful API with five core database tables (platform_events, platform_notifications, notification_state, app_webhooks, webhook_delivery_log), WebSocket server for real-time updates, webhook delivery worker with retry logic, and comprehensive rate limiting and security measures.

## Technical Context
**Language/Version**: TypeScript 5.9.2 + Node.js 18+
**Primary Dependencies**: Express.js 4.18.2, @supabase/supabase-js 2.57.4, Winston 3.17.0, express-rate-limit 8.1.0, ws (for WebSocket), crypto (for HMAC)
**Storage**: Supabase/PostgreSQL with RLS policies
**Testing**: Jest 30.1.3 with supertest 7.1.4 for contract/integration tests
**Target Platform**: Vercel serverless (existing deployment)
**Project Type**: Single backend API - extend existing api/ structure
**Performance Goals**: Handle 1,000+ events/min, <5s notification delivery, support 10,000+ concurrent WebSocket connections
**Constraints**: <100ms p95 API response time, WebSocket heartbeat every 30s, webhook retry max 5 attempts
**Scale/Scope**: 5 database tables, 12 API endpoints, 3 background workers, integration with existing apps table

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### ✅ I. API-First Development
- **Compliance**: All 12 endpoints will have OpenAPI 3.0 contracts before implementation
- **Authentication**: Bearer token authentication using existing API key system (apps table)
- **JSON Format**: All endpoints use JSON request/response with structured errors
- **Rate Limiting**: express-rate-limit configured per endpoint type (events: 1000/15min, webhooks: 50/15min)
- **CORS**: Existing CORS middleware applies to all new endpoints

### ✅ II. Test-Driven Development (NON-NEGOTIABLE)
- **TDD Cycle**: Contract tests written first → User approval → Tests fail → Implementation
- **Contract Tests**: 12 contract test files in tests/contract/events/ and tests/contract/notifications/
- **Integration Tests**: 8 integration tests for user scenarios from spec.md
- **Coverage Targets**: ≥80% unit tests, ≥70% integration tests (existing CI enforces)
- **Pre-Merge**: All tests must pass before merge (existing GitHub Actions workflow)

### ✅ III. Privacy-First Architecture
- **ID Sanitization**: No ext_ prefix needed - apps already use isolated app_id scope
- **Data Isolation**: Apps can only create/query their own notifications (enforced by RLS policies)
- **User Control**: Users control which apps can create notifications (via app installation)
- **No PII Exposure**: Notification content is app-scoped, user_id references auth.users without exposing internal data
- **Audit Logging**: All notification creation and state changes logged via Winston

### ✅ IV. Phase-Based Implementation
- **Phase 0**: Research - Technical decisions from docs/PLATFORM_EVENTS_AND_NOTIFICATIONS.md
- **Phase 1**: Design & Contracts - data-model.md, contracts/, quickstart.md
- **Phase 2**: Task Planning - tasks.md with TDD ordering
- **Phase 3+**: Implementation with continuous validation
- **Documentation**: All required artifacts in specs/004-events-notifications-system/

### ✅ V. Database Integration Standards
- **Supabase Client**: Use existing getSupabaseClient() from api/config/supabase.ts
- **Service Role**: Validation using existing auth middleware from api/middleware/auth.ts
- **Structured Logging**: Winston logger from api/lib/metrics.ts
- **Error Handling**: Existing error-handler middleware applies
- **Schema Validation**: New migration file with RLS policies following existing patterns

### Summary
✅ **PASS** - No constitutional violations. Feature follows all five core principles and leverages existing infrastructure patterns.

## Project Structure

### Documentation (this feature)
```
specs/004-events-notifications-system/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (created below)
├── data-model.md        # Phase 1 output (created below)
├── quickstart.md        # Phase 1 output (created below)
├── contracts/           # Phase 1 output (created below)
│   ├── events-publish.yml
│   ├── events-query.yml
│   ├── notifications-create.yml
│   ├── notifications-query.yml
│   ├── notifications-update.yml
│   ├── notifications-delete.yml
│   ├── webhooks-create.yml
│   ├── webhooks-list.yml
│   ├── webhooks-update.yml
│   ├── webhooks-delete.yml
│   └── websocket-stream.yml
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
api/
├── v1/
│   ├── events/
│   │   ├── publish.ts           # POST /api/v1/apps/:appId/events
│   │   ├── query.ts             # GET /api/v1/apps/:appId/events
│   │   └── stream.ts            # WSS /api/v1/events/stream
│   └── notifications/
│       ├── create.ts            # POST /api/v1/apps/:appId/notifications
│       ├── query.ts             # GET /api/v1/users/:userId/notifications
│       ├── update.ts            # PATCH /api/v1/notifications/:id
│       ├── delete.ts            # DELETE /api/v1/notifications/:id
│       └── webhooks/
│           ├── create.ts        # POST /api/v1/apps/:appId/webhooks
│           ├── list.ts          # GET /api/v1/apps/:appId/webhooks
│           ├── update.ts        # PATCH /api/v1/apps/:appId/webhooks/:id
│           └── delete.ts        # DELETE /api/v1/apps/:appId/webhooks/:id
├── services/
│   ├── eventPublisher.ts        # Event publishing service
│   ├── notificationManager.ts   # Notification CRUD service
│   ├── webhookDelivery.ts       # Webhook delivery worker
│   └── websocketBroadcaster.ts  # WebSocket connection manager
├── middleware/
│   └── websocket-auth.ts        # WebSocket authentication
└── workers/
    ├── notificationExpiry.ts    # Background worker for expiring notifications
    └── webhookRetry.ts          # Background worker for webhook retries

tests/
├── contract/
│   ├── events/
│   │   ├── publish.test.ts
│   │   ├── query.test.ts
│   │   └── stream.test.ts
│   └── notifications/
│       ├── create.test.ts
│       ├── query.test.ts
│       ├── update.test.ts
│       ├── delete.test.ts
│       └── webhooks/
│           ├── create.test.ts
│           ├── list.test.ts
│           ├── update.test.ts
│           └── delete.test.ts
└── integration/
    ├── notification-sync.test.ts
    ├── webhook-delivery.test.ts
    └── websocket-realtime.test.ts

supabase/migrations/
└── 20250930000002_platform_events_notifications.sql
```

**Structure Decision**: Use existing single backend API structure (api/) with new routes under api/v1/events/ and api/v1/notifications/

## Phase 0: Outline & Research

### Research Tasks Completed

All technical decisions have been resolved using the comprehensive design document at `docs/PLATFORM_EVENTS_AND_NOTIFICATIONS.md`. No unknowns remain.

### Research Findings

See [research.md](./research.md) for detailed findings on:

1. **Event Publishing Architecture**
   - Decision: Generic event schema with category/type/entity pattern
   - Rationale: Flexible schema supports future event types beyond notifications
   - Database: JSONB for event_data enables schema evolution

2. **Notification Storage Strategy**
   - Decision: Separate tables for notification content vs. state
   - Rationale: State changes frequently, content is immutable - optimize for updates
   - Tables: platform_notifications (content) + notification_state (per-user state)

3. **Webhook Delivery Mechanism**
   - Decision: Background worker with exponential backoff retry
   - Rationale: Decouples webhook delivery from API request/response cycle
   - Implementation: Queue-based with webhook_delivery_log audit trail

4. **WebSocket Real-Time Updates**
   - Decision: ws library with Redis pub/sub for multi-instance scaling
   - Rationale: Lightweight, production-ready, supports horizontal scaling
   - Authentication: Query param token validation on connection

5. **Rate Limiting Strategy**
   - Decision: Tiered rate limits per endpoint type
   - Rationale: Balance bulk operations (event publishing) vs. management (webhooks)
   - Limits: Events 1000/15min, Notifications 500/15min, Webhooks 50/15min

6. **Database Schema Design**
   - Decision: 5 tables with RLS policies, GIN indexes for JSONB queries
   - Rationale: Leverage Supabase RLS for security, optimize for query patterns
   - Indexes: User+timestamp for feeds, app+user for isolation, JSONB for filtering

**Output**: [research.md](./research.md) - All technical unknowns resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete ✅*

### 1. Data Model Design

See [data-model.md](./data-model.md) for comprehensive entity definitions:

**Core Entities**:
- **PlatformEvent**: Generic event record (category, type, entity, data)
- **PlatformNotification**: Notification content (title, body, action, metadata)
- **NotificationState**: Per-user state tracking (status, timestamps)
- **AppWebhook**: Webhook subscription configuration
- **WebhookDeliveryLog**: Audit trail for webhook attempts

**Key Relationships**:
- PlatformNotification ←→ NotificationState (1:many per user)
- AppWebhook → WebhookDeliveryLog (1:many attempts)
- PlatformEvent ← WebhookDeliveryLog (many:1 reference)

**Validation Rules** (from FR requirements):
- Notification title max 200 chars (FR-007)
- Notification body max 1000 chars (FR-007)
- Priority enum: low, normal, high, urgent (FR-011)
- Status enum: unread, read, dismissed, clicked, expired (FR-014)
- Webhook retry max 5 attempts with exponential backoff (FR-030)

### 2. API Contracts

12 OpenAPI contract files generated in [contracts/](./contracts/):

**Event Publishing**:
- `events-publish.yml` - POST /api/v1/apps/:appId/events
- `events-query.yml` - GET /api/v1/apps/:appId/events
- `websocket-stream.yml` - WSS /api/v1/events/stream

**Notification Management**:
- `notifications-create.yml` - POST /api/v1/apps/:appId/notifications
- `notifications-query.yml` - GET /api/v1/users/:userId/notifications
- `notifications-update.yml` - PATCH /api/v1/notifications/:id
- `notifications-delete.yml` - DELETE /api/v1/notifications/:id

**Webhook Management**:
- `webhooks-create.yml` - POST /api/v1/apps/:appId/webhooks
- `webhooks-list.yml` - GET /api/v1/apps/:appId/webhooks
- `webhooks-update.yml` - PATCH /api/v1/apps/:appId/webhooks/:id
- `webhooks-delete.yml` - DELETE /api/v1/apps/:appId/webhooks/:id

Each contract includes:
- Request/response schemas
- Authentication requirements (Bearer token)
- Rate limit headers
- Error response formats
- Validation rules

### 3. Contract Tests

12 failing contract test files created in tests/contract/:

**Test Structure** (per contract):
```typescript
describe('POST /api/v1/apps/:appId/events', () => {
  it('should accept valid event payload', async () => {
    // Arrange: Valid event data
    // Act: POST to endpoint
    // Assert: 200 response, event_id returned, schema validated
  });

  it('should reject invalid event category', async () => {
    // Arrange: Invalid category
    // Act: POST to endpoint
    // Assert: 400 response, validation error
  });

  it('should enforce authentication', async () => {
    // Arrange: Missing API key
    // Act: POST to endpoint
    // Assert: 401 response
  });

  it('should enforce rate limits', async () => {
    // Arrange: 1001 requests
    // Act: POST to endpoint repeatedly
    // Assert: 429 response after limit
  });
});
```

**Current Status**: All tests FAIL (no implementation yet) ✅

### 4. Integration Test Scenarios

8 integration tests mapped from spec.md user scenarios:

**tests/integration/notification-sync.test.ts**:
- Scenario 1: Third-party app creates notification
- Scenario 2: User dismisses in Oriva Core
- Scenario 3: User dismisses in third-party app
- Scenario 4: User clicks notification action
- Scenario 5: Multiple apps send notifications

**tests/integration/webhook-delivery.test.ts**:
- Scenario 6: App subscribes to platform events
- Edge case: Webhook retry on failure
- Edge case: Webhook disabled after 100 failures

**tests/integration/websocket-realtime.test.ts**:
- Scenario 7: Real-time notification updates
- Scenario 8: Notification expiry

### 5. Agent File Update

Agent file update will be executed using:
```bash
.specify/scripts/bash/update-agent-context.sh claude
```

This incremental update will:
- Add new technologies: ws (WebSocket), crypto (HMAC)
- Add new API routes: /api/v1/events/*, /api/v1/notifications/*
- Add recent change: "004-events-notifications-system: Platform Events & Notifications System"
- Preserve manual additions between MANUAL ADDITIONS markers
- Keep under 150 lines

**Output**: Updated CLAUDE.md in repository root

### Phase 1 Deliverables Summary

✅ **data-model.md** - 5 entities with validation rules
✅ **contracts/** - 12 OpenAPI contract files
✅ **tests/contract/** - 12 failing contract tests
✅ **tests/integration/** - 8 integration test scenarios
✅ **quickstart.md** - Developer quickstart guide
✅ **CLAUDE.md** - Updated agent context (via script)

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

The /tasks command will:

1. **Load template**: `.specify/templates/tasks-template.md`
2. **Generate from Phase 1 artifacts**:
   - Each OpenAPI contract → contract test task [P]
   - Each entity in data-model.md → migration task [P]
   - Each service component → implementation task
   - Each integration scenario → integration test task
   - Background workers → separate implementation tasks

3. **Task Categories**:
   - **Database**: Migration file creation (1 task)
   - **Contracts**: 12 contract test tasks [P]
   - **API Endpoints**: 12 endpoint implementation tasks
   - **Services**: 4 service layer tasks
   - **Workers**: 2 background worker tasks
   - **Integration**: 8 integration test tasks
   - **Documentation**: OpenAPI spec update (1 task)

### Ordering Strategy

**TDD Order** (tests before implementation):
1. Database migration (foundation)
2. Contract tests (all in parallel) [P]
3. Service layer (data access)
4. API endpoints (business logic)
5. Background workers (async operations)
6. Integration tests (end-to-end validation)

**Dependency Order**:
- Migration before all tests
- Contract tests before implementations
- Services before endpoints
- Endpoints before workers
- All implementation before integration tests

**Parallelization** [P]:
- All 12 contract tests can run in parallel
- Entity services can be implemented in parallel
- Endpoint implementations can be parallel (after services)

### Estimated Task Output

**Total Tasks**: 40-45 numbered tasks in tasks.md

**Breakdown**:
- Database: 1 task
- Contract Tests: 12 tasks [P]
- Service Layer: 4 tasks [P after migration]
- API Endpoints: 12 tasks [P after services]
- Background Workers: 2 tasks [P]
- Integration Tests: 8 tasks
- Documentation: 2 tasks (OpenAPI spec, START_GUIDE.md update)

**Estimated Completion Time**: 6-8 weeks (from original design doc)

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation following TDD workflow
  - Write contract test → Test fails → Implement endpoint → Test passes
  - Continuous validation via npm test
  - Type checking via npm run type-check
  - Security audit via npm run security:check

**Phase 5**: Validation and deployment
  - All tests passing (≥80% coverage)
  - quickstart.md executed successfully
  - Performance validation (1000 events/min, <5s delivery)
  - Security review (HMAC signatures, RLS policies)
  - Vercel deployment with environment variables

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Privacy-First ext_ prefix omission | Event and notification IDs are app-scoped in isolated app ecosystem (not user profile data crossing privacy boundaries). Apps already isolated by app_id with RLS enforcement. IDs used only for app-to-app synchronization. | Adding ext_ prefix considered but rejected because: (1) No cross-user data exposure risk in app-scoped events, (2) IDs never exposed to end users, only to apps via authenticated APIs, (3) RLS policies already enforce app isolation, (4) ext_ prefix convention designed for user-facing profile IDs, not internal event correlation IDs |

**Summary**: One constitutional deviation documented and justified. The ext_ prefix requirement from Privacy-First Architecture (Principle III) is waived for internal event/notification IDs because these are app-scoped correlation identifiers in an isolated ecosystem, not user profile data. All other constitutional principles followed without exception.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning approach described (/plan command)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

**Artifact Status**:
- [x] research.md created
- [x] data-model.md created
- [x] contracts/ directory with 12 contract files created
- [x] quickstart.md created
- [x] Agent file (CLAUDE.md) update prepared
- [ ] tasks.md (created by /tasks command)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
*Ready for /tasks command to generate Phase 3 implementation tasks*
