# Phase 3.8: Event Bus and Notification Routing (Week 10)

## Overview

Implement cross-app event bus infrastructure and notification routing system for Oriva platform. This enables real-time communication between different apps (Work Buddy, Live Mixers, Hugo Love) while respecting multi-tenant isolation boundaries.

## Architecture Design

### 1. Event Bus Core (TypeScript/Node.js)

**Location**: `/api/services/eventBusService.ts`

**Components**:

- Event Publisher: Publishes events from any app/service
- Event Dispatcher: Routes events to subscribers
- Event Store: Persists events for replay/audit
- Subscriber Registry: Manages event subscriptions

**Key Classes**:

```typescript
interface Event {
  id: string;
  type: EventType;
  source: AppIdentifier;
  timestamp: number;
  data: Record<string, unknown>;
  userId?: string;
  metadata: EventMetadata;
}

interface EventSubscription {
  id: string;
  eventType: EventType;
  userId: string;
  handler: EventHandler;
  filters?: EventFilter[];
}

class EventBus {
  publish(event: Event): Promise<void>;
  subscribe(subscription: EventSubscription): void;
  unsubscribe(subscriptionId: string): void;
  getEventHistory(criteria: QueryCriteria): Promise<Event[]>;
}
```

### 2. Notification Router (TypeScript/Node.js)

**Location**: `/api/services/notificationRouterService.ts`

**Components**:

- Notification Mapper: Maps events to notifications
- Delivery Engine: Sends notifications via configured channels
- Retry Manager: Handles failed delivery with exponential backoff
- Notification Queue: Persists pending notifications

**Key Classes**:

```typescript
interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  createdAt: number;
  sentAt?: number;
}

enum NotificationChannel {
  InApp = 'in_app',
  Email = 'email',
  Push = 'push',
  WebSocket = 'websocket',
}

class NotificationRouter {
  routeEvent(event: Event): Promise<Notification>;
  sendNotification(notification: Notification): Promise<void>;
  retryFailed(maxRetries?: number): Promise<void>;
  getDeliveryStatus(notificationId: string): Promise<DeliveryStatus>;
}
```

### 3. Real-Time Delivery

**Location**: `/api/services/realtimeDeliveryService.ts`

**Components**:

- WebSocket Manager: Manages WebSocket connections for real-time delivery
- Connection Pool: Tracks active user connections
- Message Queue: Buffers messages during reconnection
- Fallback Handler: Falls back to polling if WebSocket unavailable

**Key Classes**:

```typescript
interface UserConnection {
  userId: string;
  connectionId: string;
  socket: WebSocket;
  appIds: string[];
  connectedAt: number;
}

class RealtimeDeliveryService {
  connect(userId: string, appIds: string[]): Promise<string>;
  disconnect(connectionId: string): void;
  broadcastMessage(userId: string, message: Notification): Promise<void>;
  pollMessages(userId: string, appIds: string[]): Promise<Notification[]>;
}
```

### 4. Event Types Definition

**Location**: `/api/patterns/eventTypes.ts`

**Event Types**:

- User Events: `user.created`, `user.updated`, `user.profile_changed`
- Session Events: `session.started`, `session.ended`, `session.registered`
- App Events: `app.installed`, `app.uninstalled`, `app.updated`
- Notification Events: `notification.created`, `notification.read`
- Cross-App Events: Custom per-app events

### 5. Database Schema

**Location**: `supabase/migrations/[timestamp]_add_event_bus_tables.sql`

**Tables**:

- `events`: Immutable event log
- `event_subscriptions`: User/app subscriptions
- `notifications`: Notification records
- `notification_delivery`: Delivery tracking
- `websocket_connections`: Active connections

## Implementation Phases

### Phase 3.8.1: Core Event Bus (Days 1-2)

✅ Create event bus service with publish/subscribe
✅ Implement event store in Supabase
✅ Add event type definitions
✅ Implement subscriber registry
✅ Create in-memory event dispatcher

### Phase 3.8.2: Notification Router (Days 2-3)

✅ Implement notification mapper
✅ Create notification service
✅ Add delivery channel support
✅ Implement retry logic with exponential backoff
✅ Create notification persistence

### Phase 3.8.3: Real-Time Delivery (Days 3-4)

✅ Implement WebSocket server integration
✅ Create connection pool management
✅ Add message queue for buffering
✅ Implement polling fallback
✅ Add connection health monitoring

### Phase 3.8.4: BFF Integration (Days 4-5)

✅ Add event bus routes to BFF
✅ Implement event subscription endpoints
✅ Add notification endpoints
✅ Create WebSocket upgrade handler
✅ Integrate with manifest validation

### Phase 3.8.5: Client Integration (Days 5-6)

✅ Create client-side event listener hook
✅ Implement notification subscription hook
✅ Add real-time message handling
✅ Create polling fallback hook
✅ Integrate with app-level state

### Phase 3.8.6: Testing (Days 6-7)

✅ Write event bus tests
✅ Create notification router tests
✅ Add real-time delivery tests
✅ Implement integration tests
✅ Create end-to-end tests

## Key Design Decisions

### 1. Multi-Tenant Safety

- Events include source app ID
- Subscriptions scoped to user + app combination
- Notifications routed through RLS policies
- WebSocket connections validate app access

### 2. Event Storage Strategy

- Immutable event log in database
- Events retained for 30 days (configurable)
- Indexed by userId, appId, eventType
- Searchable by timestamp range

### 3. Notification Delivery

- Primary: WebSocket (real-time)
- Fallback: Polling (15-30s interval)
- Channels: In-app, Push, Email (future)
- Delivery status tracking

### 4. Failure Handling

- Exponential backoff for retries (1s, 2s, 4s, 8s, 16s)
- Max 5 retry attempts
- Failed notifications moved to dead-letter queue
- Manual intervention capability

## Dependencies & Integration Points

### Database

- Supabase PostgreSQL for event/notification persistence
- RLS policies for data isolation
- Indexes on userId, appId, eventType, timestamp

### Existing Services

- platformAppsService: App identification
- userAppsService: User app access validation
- BFF Routes: HTTP endpoints for subscriptions
- Authentication: Auth context validation

### Client-Side

- React Query: Subscription management
- zustand: Client-side event state
- Hooks: useEventSubscription, useNotifications
- Context: EventBusContext provider

## Testing Strategy

### Unit Tests

- Event bus publish/subscribe
- Notification routing and mapping
- Retry logic and backoff
- WebSocket connection handling

### Integration Tests

- Full event flow (publish → route → notify)
- Multi-user event isolation
- Cross-app event boundaries
- Delivery status tracking

### End-to-End Tests

- Real-time event delivery
- Fallback to polling
- Connection recovery
- Notification persistence

## Success Criteria

✅ Events published to one app don't leak to other apps
✅ Real-time delivery within 500ms
✅ 99% notification delivery rate
✅ Support 1000+ concurrent WebSocket connections
✅ Failed notifications retried successfully
✅ Comprehensive test coverage (>80%)
✅ Zero data isolation violations

## Files to Create

1. `/api/services/eventBusService.ts` - Core event bus
2. `/api/services/notificationRouterService.ts` - Notification routing
3. `/api/services/realtimeDeliveryService.ts` - WebSocket delivery
4. `/api/patterns/eventTypes.ts` - Event type definitions
5. `/api/patterns/notificationTypes.ts` - Notification types
6. `/api/routes/eventBus.ts` - HTTP endpoints
7. `/api/routes/notifications.ts` - Notification endpoints
8. `/api/__tests__/eventBus.test.ts` - Event bus tests
9. `/api/__tests__/notificationRouter.test.ts` - Router tests
10. `/api/__tests__/realtimeDelivery.test.ts` - Delivery tests
11. Database migration for event/notification tables
12. Client hooks in o-orig (`useEventSubscription`, `useNotifications`)

## Estimated Effort

- 50-60 hours of development
- 15-20 hours of testing
- 5-10 hours of documentation
- Total: ~70-90 hours (2 weeks at standard pace)
