# Phase 0: Research & Technical Decisions

**Feature**: Platform Events & Notifications System
**Date**: 2025-09-30
**Status**: Complete ✅

---

## Overview

This document captures all technical research and architectural decisions for the Platform Events & Notifications System. All decisions are informed by the comprehensive design document at `docs/PLATFORM_EVENTS_AND_NOTIFICATIONS.md` and the existing Oriva Platform infrastructure.

---

## 1. Event Publishing Architecture

### Decision
Implement a generic event schema with a three-level classification system:
- **event_category**: High-level grouping (notification, user, session, transaction)
- **event_type**: Specific action (created, dismissed, clicked, updated)
- **entity_type** + **entity_id**: What was affected
- **event_data**: JSONB for flexible payload

### Rationale
- **Future-proof**: Generic schema supports event types beyond notifications without schema changes
- **Queryable**: Structured classification enables efficient filtering and analytics
- **Flexible**: JSONB event_data allows schema evolution without migrations
- **Indexable**: GIN indexes on JSONB enable fast queries on dynamic fields

### Alternatives Considered
1. **Notification-specific events only**: Rejected - too narrow, doesn't support platform growth
2. **Single event_type field**: Rejected - loses hierarchical organization benefits
3. **Separate tables per event category**: Rejected - unnecessary complexity, harder to query

### Implementation Details
- PostgreSQL table: `platform_events`
- Indexes: (app_id, user_id, created_at), (event_category, event_type), GIN on event_data
- Retention: 6 months in hot storage, then archive to cold storage

---

## 2. Notification Storage Strategy

### Decision
Separate notification content from user-specific state using two tables:
- **platform_notifications**: Immutable notification content (title, body, action_url, etc.)
- **notification_state**: Mutable per-user state (status, timestamps)

### Rationale
- **Performance**: State changes frequently (read/dismiss), content is immutable - optimize separately
- **Storage efficiency**: Single notification content shared across state records
- **Query optimization**: Can index state table heavily without bloating content table
- **Clean separation**: Notification creation vs. state management are distinct concerns

### Alternatives Considered
1. **Single denormalized table**: Rejected - wastes storage, slower updates, harder to maintain
2. **JSONB state in notifications table**: Rejected - update performance, indexing challenges
3. **Event sourcing pattern**: Rejected - overcomplicated for current requirements

### Implementation Details
- Relationship: notification_state.notification_id → platform_notifications.id
- Unique constraint: (notification_id, user_id) - one state record per user
- Default state: 'unread' with NULL timestamps
- Cascading delete: Delete notification_state when notification is deleted

---

## 3. Webhook Delivery Mechanism

### Decision
Background worker with exponential backoff retry and audit logging:
- Asynchronous delivery decoupled from API request/response
- Max 5 retry attempts with exponential backoff (1s, 2s, 4s, 8s, 16s)
- Complete audit trail in webhook_delivery_log
- Auto-disable webhook after 100 consecutive failures

### Rationale
- **Reliability**: Retry logic handles transient failures
- **Performance**: Doesn't block API responses waiting for webhook delivery
- **Debuggability**: Audit log provides visibility into delivery issues
- **Safety**: Auto-disable prevents infinite retry loops

### Alternatives Considered
1. **Synchronous delivery**: Rejected - blocks API response, no retry on failure
2. **Message queue (RabbitMQ/SQS)**: Rejected - adds infrastructure complexity for MVP
3. **Unlimited retries**: Rejected - could overwhelm failing endpoints

### Implementation Details
- Worker: Check webhook_delivery_log for pending retries every 60 seconds
- HMAC signing: Use crypto.createHmac with webhook_secret for payload verification
- Timeout: 10 second HTTP request timeout for webhook calls
- Monitoring: Alert when webhook success rate <90% or disabled webhooks detected

---

## 4. WebSocket Real-Time Updates

### Decision
Use `ws` library with in-memory connection management for MVP:
- WebSocket endpoint: WSS /api/v1/events/stream
- Authentication: Query parameter token validation on connection
- Heartbeat: Ping/pong every 30 seconds to detect dead connections
- Broadcasting: When event occurs, push to all connected clients matching filters

**Future**: Add Redis pub/sub for multi-instance horizontal scaling

### Rationale
- **Simplicity**: `ws` library is lightweight, battle-tested, well-documented
- **Performance**: In-memory for MVP sufficient, easy upgrade path to Redis
- **Real-time UX**: Instant updates without polling
- **Efficient**: WebSocket much lower overhead than long-polling

### Alternatives Considered
1. **Server-Sent Events (SSE)**: Rejected - less browser support, harder to scale
2. **Socket.io**: Rejected - heavier library, unnecessary features for our use case
3. **Long polling**: Rejected - inefficient, higher latency, more server load

### Implementation Details
- Connection limit: 10 concurrent per user (prevent abuse)
- Authentication: Validate JWT token on connection, reject invalid
- Filtering: Client specifies event types to receive during handshake
- Cleanup: Close connections on user logout or token expiry
- Monitoring: Track active connection count, message throughput

---

## 5. Rate Limiting Strategy

### Decision
Tiered rate limits per endpoint type using express-rate-limit:

| Endpoint Type | Limit | Window | Rationale |
|---------------|-------|--------|-----------|
| Event Publishing | 1000 events | 15 minutes | Bulk operations, high volume |
| Notification Creation | 500 notifications | 15 minutes | Moderate volume, prevent spam |
| Webhook Management | 50 requests | 15 minutes | Low volume, management ops |
| Notification Queries | 1000 requests | 15 minutes | High read volume for UI |

### Rationale
- **Balanced**: Different limits match different use patterns
- **Abuse prevention**: Prevents single app from overwhelming system
- **Scalability**: Limits ensure fair resource distribution
- **Standard**: express-rate-limit already used in codebase

### Alternatives Considered
1. **Single global limit**: Rejected - doesn't account for different endpoint needs
2. **Per-user limits**: Rejected - apps share API key, user-level too granular
3. **No rate limiting**: Rejected - exposes system to abuse

### Implementation Details
- Storage: In-memory (Vercel serverless, no shared state needed)
- Headers: Return X-RateLimit-* headers for client awareness
- Error response: 429 Too Many Requests with Retry-After header
- Monitoring: Track rate limit hits, adjust limits based on usage patterns

---

## 6. Database Schema Design

### Decision
5 PostgreSQL tables with comprehensive indexing and RLS policies:

**Tables**:
1. platform_events - Generic event log
2. platform_notifications - Notification content
3. notification_state - Per-user state tracking
4. app_webhooks - Webhook subscriptions
5. webhook_delivery_log - Delivery audit trail

**Indexing Strategy**:
- B-tree indexes on foreign keys and timestamp columns for sorting
- GIN indexes on JSONB columns for flexible querying
- Composite indexes on common query patterns (user_id + created_at)
- Partial indexes for active/unexpired records only

**Security**:
- Row Level Security (RLS) policies on all tables
- Apps can only access their own notifications and webhooks
- Users can only see their own notification state
- Service role bypasses RLS for internal operations

### Rationale
- **Performance**: Indexes optimized for primary query patterns (user feeds, app dashboards)
- **Security**: RLS enforces data isolation at database level
- **Scalability**: Partitioning strategy ready (by month) when volume increases
- **Maintainability**: Standard Supabase patterns, follows existing codebase conventions

### Alternatives Considered
1. **NoSQL (MongoDB)**: Rejected - PostgreSQL already in use, ACID guarantees needed
2. **Single events table**: Rejected - querying notifications requires complex filters
3. **No RLS policies**: Rejected - violates constitutional Privacy-First principle

### Implementation Details
- Migration file: 20250930000002_platform_events_notifications.sql
- Reuse patterns from: 20250930000001_marketplace_core_tables.sql
- Trigger functions: auto-update updated_at timestamps
- Foreign keys: CASCADE delete for audit trail, RESTRICT for critical relations

---

## 7. Authentication & Authorization

### Decision
Reuse existing Oriva Platform authentication infrastructure:
- **API Key**: Bearer token from apps table (validates app_id)
- **Middleware**: Existing api/middleware/auth.ts validates tokens
- **RLS Policies**: Database-level isolation per app and user
- **WebSocket**: Query parameter token, same validation logic

### Rationale
- **Consistency**: Matches existing API authentication patterns
- **Proven**: Already deployed and tested in production
- **Simple**: No new auth system to maintain
- **Secure**: Database-level enforcement via RLS

### Alternatives Considered
1. **OAuth 2.0**: Rejected - overkill for server-to-server API
2. **JWT tokens**: Rejected - API keys sufficient, simpler
3. **Custom middleware**: Rejected - reuse existing, well-tested code

### Implementation Details
- Middleware chain: rate-limit → auth → validation → handler
- Error handling: 401 Unauthorized for invalid/missing API key
- Logging: Winston audit log for all authenticated requests
- Token validation: Check apps table, verify is_active=true

---

## 8. Error Handling & Logging

### Decision
Leverage existing Winston logger and error-handler middleware:
- **Structured logging**: All events logged with request context
- **Error levels**: ERROR for failures, WARN for retries, INFO for success
- **Audit trail**: Security-sensitive operations (webhook creation) logged separately
- **Monitoring**: Integration with existing Sentry for error tracking

### Rationale
- **Debuggability**: Structured logs enable efficient troubleshooting
- **Compliance**: Audit trail for security requirements
- **Consistency**: Matches existing logging patterns across platform
- **Alerting**: Sentry integration enables proactive issue detection

### Alternatives Considered
1. **Console.log**: Rejected - unstructured, no production monitoring
2. **Separate logging service**: Rejected - unnecessary complexity
3. **No audit logging**: Rejected - violates constitutional requirements

### Implementation Details
- Logger: Import from api/lib/metrics.ts
- Context: Include request_id, app_id, user_id in all log entries
- Retention: 30 days in hot storage, 1 year archive
- PII handling: Never log notification content, only metadata

---

## 9. Testing Strategy

### Decision
Three-tier testing approach following TDD principles:

1. **Contract Tests** (12 files): Validate OpenAPI contracts
   - Request/response schema validation
   - Authentication and rate limiting
   - Error response formats

2. **Integration Tests** (8 files): Validate user scenarios
   - End-to-end workflows from spec.md
   - Database state verification
   - Webhook delivery simulation

3. **Unit Tests**: Service layer logic
   - Event publishing logic
   - Notification state transitions
   - Webhook retry logic

### Rationale
- **TDD Compliance**: Contract tests written before implementation (constitutional requirement)
- **Coverage**: Three tiers ensure comprehensive validation
- **Confidence**: Integration tests validate real user workflows
- **Fast feedback**: Unit tests catch regressions quickly

### Alternatives Considered
1. **Manual testing only**: Rejected - doesn't scale, violates TDD principle
2. **E2E tests only**: Rejected - too slow, hard to debug
3. **Unit tests only**: Rejected - misses integration issues

### Implementation Details
- Framework: Jest (already configured)
- Helpers: supertest for HTTP testing, ws for WebSocket testing
- Mocking: Mock Supabase calls in unit tests, real DB in integration tests
- CI: All tests run on GitHub Actions before merge

---

## 10. Deployment & Operations

### Decision
Leverage existing Vercel serverless deployment:
- **API endpoints**: Serverless functions (existing pattern)
- **Background workers**: Vercel Cron Jobs for webhook retry and notification expiry
- **WebSocket**: Single long-running connection per Vercel instance
- **Database**: Supabase (already configured)

### Rationale
- **Zero config**: Matches existing deployment infrastructure
- **Scalable**: Vercel auto-scales based on traffic
- **Cost-effective**: Pay per execution, no idle costs
- **Familiar**: Team already knows deployment process

### Alternatives Considered
1. **Dedicated WebSocket server**: Rejected - adds complexity for MVP
2. **AWS Lambda**: Rejected - team uses Vercel, switching adds complexity
3. **Self-hosted**: Rejected - operational overhead not justified

### Implementation Details
- Environment variables: Add WEBHOOK_RETRY_INTERVAL, NOTIFICATION_EXPIRY_CHECK_INTERVAL
- Cron jobs: webhook-retry (every 1 min), notification-expiry (every 5 min)
- Monitoring: Use existing health check endpoints
- Rollback: Vercel built-in rollback on deployment failure

---

## Summary

All technical decisions are complete and aligned with:
- ✅ Constitutional principles (API-First, TDD, Privacy-First, Phase-Based, Database Standards)
- ✅ Existing Oriva Platform infrastructure patterns
- ✅ Functional requirements from spec.md
- ✅ Performance and scale goals

**No unknowns remain. Ready for Phase 1: Design & Contracts.**

---

**Related Documents**:
- [spec.md](./spec.md) - Feature specification
- [plan.md](./plan.md) - Implementation plan
- [docs/PLATFORM_EVENTS_AND_NOTIFICATIONS.md](../../docs/PLATFORM_EVENTS_AND_NOTIFICATIONS.md) - Detailed design document
