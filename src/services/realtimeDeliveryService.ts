/**
 * Real-Time Delivery Service
 * api/services/realtimeDeliveryService.ts
 * Task: T108 (Phase 3.8)
 *
 * Manages WebSocket connections and real-time notification delivery.
 * Provides connection pooling, message buffering, and fallback to polling.
 */

import { Request } from 'express';
import { randomUUID } from 'crypto';
import { WebSocket } from 'ws';
import {
  createQueryBuilder,
  executeQuery,
  executeQueryOptional,
  DatabaseError,
} from '../utils/database-express';
import { validateRequired, ValidationError } from '../utils/validation-express';
import { Notification, NotificationChannel } from '../patterns/notificationTypes';

/**
 * User connection information
 */
interface UserConnection {
  userId: string;
  connectionId: string;
  socket: WebSocket;
  appIds: string[];
  connectedAt: number;
  lastHeartbeat: number;
  messageBuffer: Notification[];
  isBuffering: boolean; // True when socket is temporarily disconnected
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  userId: string;
  connected: boolean;
  connectionId?: string;
  connectedAt?: number;
  lastHeartbeat?: number;
  appIds: string[];
  messagesBuffered: number;
}

/**
 * Real-time delivery service
 */
class RealtimeDeliveryService {
  private connections: Map<string, UserConnection> = new Map(); // connectionId -> UserConnection
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set<connectionId>
  private heartbeatInterval = 30000; // 30 seconds
  private heartbeatTimeout = 60000; // 60 seconds
  private maxBufferSize = 1000; // Max messages per connection
  private heartbeatTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize real-time delivery service
   * Should be called once on server startup
   */
  initialize = (): void => {
    // Start heartbeat monitoring
    this.startHeartbeat();
  };

  /**
   * Establish a WebSocket connection for a user
   */
  connect = async (
    userId: string,
    appIds: string[],
    socket: WebSocket,
    req?: Request
  ): Promise<string> => {
    validateRequired(userId, 'userId');
    validateRequired(appIds, 'appIds');
    if (!appIds.length) {
      throw new ValidationError('appIds must be non-empty', { code: 'INVALID_APP_IDS' });
    }

    const connectionId = randomUUID();
    const now = Date.now();

    const connection: UserConnection = {
      userId,
      connectionId,
      socket,
      appIds,
      connectedAt: now,
      lastHeartbeat: now,
      messageBuffer: [],
      isBuffering: false,
    };

    this.connections.set(connectionId, connection);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Persist connection to database if request available
    if (req) {
      await this.persistConnection(req, connectionId, userId, appIds);
    }

    // Setup socket event handlers
    this.setupSocketHandlers(connection);

    return connectionId;
  };

  /**
   * Disconnect a user's WebSocket connection
   */
  disconnect = async (connectionId: string, req?: Request): Promise<void> => {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return; // Already disconnected
    }

    // Close socket if still open
    if (connection.socket.readyState === WebSocket.OPEN) {
      connection.socket.close(1000, 'Disconnecting');
    }

    // Remove from in-memory registry
    this.connections.delete(connectionId);

    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove from database if request available
    if (req) {
      await this.removeConnection(req, connectionId);
    }
  };

  /**
   * Broadcast a notification to a user
   * Sends immediately if WebSocket connected, buffers if not
   */
  broadcastMessage = async (
    userId: string,
    notification: Notification,
    req?: Request
  ): Promise<void> => {
    const userConnectionIds = this.userConnections.get(userId);

    if (!userConnectionIds || userConnectionIds.size === 0) {
      // No active connections, skip broadcast
      return;
    }

    const message = {
      type: 'notification',
      notification,
      timestamp: Date.now(),
    };

    let sentCount = 0;
    let bufferedCount = 0;

    for (const connectionId of userConnectionIds) {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        continue;
      }

      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          // Send immediately
          connection.socket.send(JSON.stringify(message), (error) => {
            if (error) {
              console.error(`Error sending to ${connectionId}:`, error);
              // Mark for buffering on next reconnect
              connection.isBuffering = true;
            } else {
              sentCount++;
              connection.lastHeartbeat = Date.now();
            }
          });
        } else {
          // Buffer for later delivery
          if (connection.messageBuffer.length < this.maxBufferSize) {
            connection.messageBuffer.push(notification);
            bufferedCount++;
            connection.isBuffering = true;
          }
        }
      } catch (error) {
        console.error(`Error broadcasting to ${connectionId}:`, error);
        connection.isBuffering = true;
      }
    }

    console.log(
      `[Broadcast] ${notification.type} to ${userId}: sent=${sentCount}, buffered=${bufferedCount}`
    );
  };

  /**
   * Poll for pending notifications (fallback when WebSocket unavailable)
   */
  pollMessages = async (
    req: Request,
    userId: string,
    appIds: string[],
    limit: number = 50,
    since?: number
  ): Promise<Notification[]> => {
    validateRequired(userId, 'userId');

    const db = createQueryBuilder(req);

    let query = db
      .from('event_bus_notifications')
      .select('*')
      .eq('user_id', userId)
      .in('channels', [NotificationChannel.IN_APP, NotificationChannel.PUSH])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gt('created_at', new Date(since).toISOString());
    }

    const { data: notifications, error } = await query;

    if (error) {
      throw new DatabaseError('Failed to poll notifications', 'POLL_FAILED', error);
    }

    return (notifications || []) as Notification[];
  };

  /**
   * Get connection status for a user
   */
  getConnectionStatus = async (userId: string): Promise<ConnectionStatus> => {
    const userConnectionIds = this.userConnections.get(userId);

    if (!userConnectionIds || userConnectionIds.size === 0) {
      return {
        userId,
        connected: false,
        appIds: [],
        messagesBuffered: 0,
      };
    }

    // Get primary connection (most recent)
    let primaryConnection: UserConnection | null = null;
    let totalBuffered = 0;

    for (const connectionId of userConnectionIds) {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        continue;
      }

      totalBuffered += connection.messageBuffer.length;

      if (!primaryConnection || connection.lastHeartbeat > primaryConnection.lastHeartbeat) {
        primaryConnection = connection;
      }
    }

    if (!primaryConnection) {
      return {
        userId,
        connected: false,
        appIds: [],
        messagesBuffered: totalBuffered,
      };
    }

    return {
      userId,
      connected: primaryConnection.socket.readyState === WebSocket.OPEN,
      connectionId: primaryConnection.connectionId,
      connectedAt: primaryConnection.connectedAt,
      lastHeartbeat: primaryConnection.lastHeartbeat,
      appIds: primaryConnection.appIds,
      messagesBuffered: totalBuffered,
    };
  };

  /**
   * Get all active connections (admin only)
   */
  getActiveConnections = (): UserConnection[] => {
    const active: UserConnection[] = [];

    for (const connection of this.connections.values()) {
      if (connection.socket.readyState === WebSocket.OPEN) {
        active.push(connection);
      }
    }

    return active;
  };

  /**
   * Cleanup disconnected connections and old data
   */
  cleanup = async (req: Request): Promise<number> => {
    const db = createQueryBuilder(req);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    const { data: deleted, error } = await db
      .from('event_bus_connections')
      .delete()
      .lt('last_heartbeat', cutoff.toISOString());

    if (error) {
      throw new DatabaseError('Failed to cleanup connections', 'CLEANUP_FAILED', error);
    }

    return 0; // Supabase doesn't return row count
  };

  /**
   * Shutdown the service gracefully
   */
  shutdown = async (): Promise<void> => {
    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.socket.close(1000, 'Server shutdown');
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }

    this.connections.clear();
    this.userConnections.clear();
  };

  /**
   * Internal: Setup socket event handlers
   */
  private setupSocketHandlers = (connection: UserConnection): void => {
    const socket = connection.socket;

    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(connection, message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    socket.on('pong', () => {
      connection.lastHeartbeat = Date.now();
      connection.isBuffering = false;
    });

    socket.on('close', () => {
      console.log(`[WebSocket] Connection closed: ${connection.connectionId}`);
      // Keep in buffer for reconnection
      connection.isBuffering = true;
    });

    socket.on('error', (error) => {
      console.error(`[WebSocket] Error in connection ${connection.connectionId}:`, error);
      connection.isBuffering = true;
    });
  };

  /**
   * Internal: Handle incoming messages from client
   */
  private handleMessage = (connection: UserConnection, message: any): void => {
    try {
      switch (message.type) {
        case 'heartbeat':
          this.handleHeartbeat(connection);
          break;
        case 'mark_read':
          this.handleMarkRead(connection, message.notificationId);
          break;
        case 'update_subscriptions':
          this.handleUpdateSubscriptions(connection, message.appIds);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  };

  /**
   * Internal: Handle heartbeat
   */
  private handleHeartbeat = (connection: UserConnection): void => {
    connection.lastHeartbeat = Date.now();
    connection.isBuffering = false;

    try {
      connection.socket.send(
        JSON.stringify({
          type: 'heartbeat_ack',
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error sending heartbeat ACK:', error);
    }
  };

  /**
   * Internal: Handle mark as read
   */
  private handleMarkRead = async (
    connection: UserConnection,
    notificationId: string
  ): Promise<void> => {
    // This would be handled by a separate API endpoint
    // Just acknowledge for now
    try {
      connection.socket.send(
        JSON.stringify({
          type: 'mark_read_ack',
          notificationId,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error sending mark_read ACK:', error);
    }
  };

  /**
   * Internal: Handle subscription updates
   */
  private handleUpdateSubscriptions = (connection: UserConnection, appIds: string[]): void => {
    connection.appIds = appIds;
    console.log(
      `[WebSocket] Updated subscriptions for ${connection.connectionId}: ${appIds.join(', ')}`
    );
  };

  /**
   * Internal: Start heartbeat monitoring
   */
  private startHeartbeat = (): void => {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      for (const [connectionId, connection] of this.connections) {
        try {
          // Check if connection is stale
          if (now - connection.lastHeartbeat > this.heartbeatTimeout) {
            console.log(`[WebSocket] Connection timeout: ${connectionId}, disconnecting`);
            connection.socket.close(1000, 'Heartbeat timeout');
            this.connections.delete(connectionId);
          } else if (connection.socket.readyState === WebSocket.OPEN) {
            // Send ping
            connection.socket.ping();
          }
        } catch (error) {
          console.error(`Error in heartbeat for ${connectionId}:`, error);
        }
      }
    }, this.heartbeatInterval);
  };

  /**
   * Internal: Persist connection to database
   */
  private persistConnection = async (
    req: Request,
    connectionId: string,
    userId: string,
    appIds: string[]
  ): Promise<void> => {
    const db = createQueryBuilder(req);

    await executeQuery<void>(
      () =>
        db.from('event_bus_connections').upsert(
          {
            id: connectionId,
            user_id: userId,
            connection_id: connectionId,
            app_ids: appIds,
            connected_at: new Date().toISOString(),
            last_heartbeat: new Date().toISOString(),
          },
          {
            onConflict: 'connection_id',
            ignoreDuplicates: false,
          }
        ),
      'persist connection'
    );
  };

  /**
   * Internal: Remove connection from database
   */
  private removeConnection = async (req: Request, connectionId: string): Promise<void> => {
    const db = createQueryBuilder(req);

    await executeQuery<void>(
      () => db.from('event_bus_connections').delete().eq('connection_id', connectionId),
      'remove connection'
    );
  };
}

// Singleton instance
export const realtimeDeliveryService = new RealtimeDeliveryService();

export default realtimeDeliveryService;
