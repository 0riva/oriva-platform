// Task: T024 - WebSocketBroadcaster service for real-time event broadcasting
// Description: Manage WebSocket connections and broadcast events to subscribed clients

import { logger } from '../utils/logger';
import type { WebSocket } from 'ws';

export interface PlatformEvent {
  event_id: string;
  app_id: string;
  user_id: string;
  event_category: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  event_data: Record<string, unknown>;
  timestamp: string;
}

export interface ConnectionInfo {
  ws: WebSocket;
  userId: string;
  appId: string;
  subscriptions: string[]; // Event categories or full event types
  connectedAt: Date;
  lastPingAt: Date;
}

// In-memory connection storage
// Structure: Map<userId, Map<connectionId, ConnectionInfo>>
const connections = new Map<string, Map<string, ConnectionInfo>>();

// Connection limit per user
const MAX_CONNECTIONS_PER_USER = 10;

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL_MS = 30000;

// Stale connection threshold (2 minutes)
const STALE_CONNECTION_THRESHOLD_MS = 120000;

/**
 * Generate unique connection ID
 */
function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Register a new WebSocket connection
 * - Enforces 10 connections per user limit
 * - Stores connection with subscriptions
 * - Sets up heartbeat
 */
export function registerConnection(
  userId: string,
  appId: string,
  ws: WebSocket,
  subscriptions: string[] = []
): string | null {
  try {
    // Get or create user connections map
    let userConnections = connections.get(userId);
    if (!userConnections) {
      userConnections = new Map();
      connections.set(userId, userConnections);
    }

    // Enforce connection limit
    if (userConnections.size >= MAX_CONNECTIONS_PER_USER) {
      logger.warn('Connection limit reached for user', {
        user_id: userId,
        current_connections: userConnections.size,
      });
      return null;
    }

    const connectionId = generateConnectionId();

    // Store connection info
    userConnections.set(connectionId, {
      ws,
      userId,
      appId,
      subscriptions,
      connectedAt: new Date(),
      lastPingAt: new Date(),
    });

    logger.info('WebSocket connection registered', {
      connection_id: connectionId,
      user_id: userId,
      app_id: appId,
      subscriptions,
      total_user_connections: userConnections.size,
    });

    // Set up connection handlers
    ws.on('close', () => {
      removeConnection(userId, connectionId);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', {
        connection_id: connectionId,
        user_id: userId,
        error: error.message,
      });
      removeConnection(userId, connectionId);
    });

    ws.on('pong', () => {
      const connInfo = userConnections?.get(connectionId);
      if (connInfo) {
        connInfo.lastPingAt = new Date();
      }
    });

    // Send connection acknowledgment
    ws.send(JSON.stringify({
      type: 'connected',
      connection_id: connectionId,
      subscriptions,
    }));

    return connectionId;
  } catch (error) {
    logger.error('Failed to register connection', {
      error: error instanceof Error ? error.message : String(error),
      user_id: userId,
    });
    return null;
  }
}

/**
 * Remove a WebSocket connection
 */
export function removeConnection(userId: string, connectionId: string): void {
  try {
    const userConnections = connections.get(userId);
    if (!userConnections) {
      return;
    }

    const connInfo = userConnections.get(connectionId);
    if (connInfo) {
      // Close WebSocket if still open
      if (connInfo.ws.readyState === 1) { // OPEN
        connInfo.ws.close();
      }

      userConnections.delete(connectionId);

      logger.info('WebSocket connection removed', {
        connection_id: connectionId,
        user_id: userId,
        remaining_connections: userConnections.size,
      });

      // Clean up empty user map
      if (userConnections.size === 0) {
        connections.delete(userId);
      }
    }
  } catch (error) {
    logger.error('Failed to remove connection', {
      error: error instanceof Error ? error.message : String(error),
      connection_id: connectionId,
    });
  }
}

/**
 * Update connection subscriptions
 */
export function updateSubscriptions(
  userId: string,
  connectionId: string,
  subscriptions: string[]
): boolean {
  try {
    const userConnections = connections.get(userId);
    if (!userConnections) {
      return false;
    }

    const connInfo = userConnections.get(connectionId);
    if (!connInfo) {
      return false;
    }

    connInfo.subscriptions = subscriptions;

    logger.debug('Connection subscriptions updated', {
      connection_id: connectionId,
      subscriptions,
    });

    // Send acknowledgment
    connInfo.ws.send(JSON.stringify({
      type: 'subscribed',
      subscriptions,
    }));

    return true;
  } catch (error) {
    logger.error('Failed to update subscriptions', {
      error: error instanceof Error ? error.message : String(error),
      connection_id: connectionId,
    });
    return false;
  }
}

/**
 * Check if connection matches event based on subscriptions
 */
function matchesSubscription(connInfo: ConnectionInfo, event: PlatformEvent): boolean {
  if (connInfo.subscriptions.length === 0) {
    // No subscriptions = subscribe to all
    return true;
  }

  const fullEventType = `${event.event_category}.${event.event_type}`;

  for (const subscription of connInfo.subscriptions) {
    // Exact match
    if (subscription === fullEventType) {
      return true;
    }

    // Category match (e.g., "notification" matches "notification.*")
    if (subscription === event.event_category) {
      return true;
    }

    // Wildcard match (e.g., "notification.*")
    if (subscription.endsWith('.*')) {
      const category = subscription.replace('.*', '');
      if (category === event.event_category) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Broadcast event to matching WebSocket connections
 * - Filters by user ID (if provided)
 * - Filters by subscription patterns
 * - Sends event to all matching connections
 */
export async function broadcastEvent(event: PlatformEvent, userId?: string): Promise<void> {
  try {
    let targetConnections: ConnectionInfo[] = [];

    if (userId) {
      // Broadcast to specific user
      const userConnections = connections.get(userId);
      if (userConnections) {
        targetConnections = Array.from(userConnections.values());
      }
    } else {
      // Broadcast to all users (rare case)
      for (const userConnections of connections.values()) {
        targetConnections.push(...Array.from(userConnections.values()));
      }
    }

    if (targetConnections.length === 0) {
      logger.debug('No active connections for event broadcast', {
        event_id: event.event_id,
        user_id: userId,
      });
      return;
    }

    // Filter connections by subscription
    const matchingConnections = targetConnections.filter((conn) =>
      matchesSubscription(conn, event)
    );

    if (matchingConnections.length === 0) {
      logger.debug('No connections match event subscriptions', {
        event_id: event.event_id,
        event_type: `${event.event_category}.${event.event_type}`,
      });
      return;
    }

    // Build event message
    const message = JSON.stringify({
      type: 'event',
      event_id: event.event_id,
      event_category: event.event_category,
      event_type: event.event_type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      timestamp: event.timestamp,
      data: event.event_data,
    });

    // Send to all matching connections
    let successCount = 0;
    let failureCount = 0;

    for (const conn of matchingConnections) {
      try {
        if (conn.ws.readyState === 1) { // OPEN
          conn.ws.send(message);
          successCount++;
        } else {
          failureCount++;
          // Remove dead connection
          removeConnection(conn.userId, generateConnectionId()); // Note: We don't have connection ID here
        }
      } catch (error) {
        failureCount++;
        logger.error('Failed to send event to connection', {
          error: error instanceof Error ? error.message : String(error),
          user_id: conn.userId,
        });
      }
    }

    logger.info('Event broadcast completed', {
      event_id: event.event_id,
      event_type: `${event.event_category}.${event.event_type}`,
      target_user_id: userId,
      success_count: successCount,
      failure_count: failureCount,
    });
  } catch (error) {
    logger.error('Failed to broadcast event', {
      error: error instanceof Error ? error.message : String(error),
      event_id: event.event_id,
    });
  }
}

/**
 * Send heartbeat pings to all connections
 * Should be called periodically (every 30 seconds)
 */
export function sendHeartbeats(): void {
  try {
    let totalConnections = 0;
    let staleConnections = 0;

    for (const [userId, userConnections] of connections.entries()) {
      for (const [connectionId, connInfo] of userConnections.entries()) {
        totalConnections++;

        // Check if connection is stale
        const timeSinceLastPing = Date.now() - connInfo.lastPingAt.getTime();
        if (timeSinceLastPing > STALE_CONNECTION_THRESHOLD_MS) {
          staleConnections++;
          logger.warn('Stale connection detected', {
            connection_id: connectionId,
            user_id: userId,
            time_since_last_ping_ms: timeSinceLastPing,
          });
          removeConnection(userId, connectionId);
          continue;
        }

        // Send ping
        try {
          if (connInfo.ws.readyState === 1) { // OPEN
            connInfo.ws.ping();
          } else {
            removeConnection(userId, connectionId);
          }
        } catch (error) {
          logger.error('Failed to send ping', {
            connection_id: connectionId,
            error: error instanceof Error ? error.message : String(error),
          });
          removeConnection(userId, connectionId);
        }
      }
    }

    logger.debug('Heartbeat pings sent', {
      total_connections: totalConnections,
      stale_connections_removed: staleConnections,
    });
  } catch (error) {
    logger.error('Failed to send heartbeats', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Initialize heartbeat interval
 * Should be called once when server starts
 */
export function initializeHeartbeat(): NodeJS.Timeout {
  logger.info('WebSocket heartbeat initialized', {
    interval_ms: HEARTBEAT_INTERVAL_MS,
  });

  return setInterval(sendHeartbeats, HEARTBEAT_INTERVAL_MS);
}

/**
 * Get connection stats (for monitoring)
 */
export function getConnectionStats() {
  let totalConnections = 0;
  const userConnectionCounts: Record<string, number> = {};

  for (const [userId, userConnections] of connections.entries()) {
    const count = userConnections.size;
    totalConnections += count;
    userConnectionCounts[userId] = count;
  }

  return {
    total_connections: totalConnections,
    total_users: connections.size,
    user_connection_counts: userConnectionCounts,
  };
}
