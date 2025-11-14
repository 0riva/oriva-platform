/**
 * WebSocket Handler for Real-Time Notifications
 * api/middleware/websocketHandler.ts
 * Task: T108 (Phase 3.8)
 *
 * Handles WebSocket connections for real-time notification delivery.
 * Supports multiple concurrent connections per user.
 */

import { Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { realtimeDeliveryService } from '../../services/realtimeDeliveryService';
import { validateRequired, ValidationError } from '../../utils/validation-express';
import { logger, sanitizeUserId, sanitizeConnectionId, sanitizeError } from '../../utils/logger';

/**
 * Setup WebSocket server on HTTP server
 */
export const setupWebSocket = (server: http.Server): WebSocketServer => {
  const wss = new WebSocketServer({ server, path: '/api/v1/events/subscribe' });

  wss.on('connection', async (ws: WebSocket, req: Request) => {
    try {
      // Extract user context from request
      const userId = (req as any).user?.id;
      const appIds = (req as any).appIds || [];
      const authToken = req.headers.authorization?.replace('Bearer ', '');

      if (!userId || !authToken) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      if (!appIds.length) {
        ws.close(1008, 'No app IDs specified');
        return;
      }

      // Establish connection
      const connectionId = await realtimeDeliveryService.connect(userId, appIds, ws);

      // SECURITY: Sanitize PII in logs
      logger.info('WebSocket connection established', {
        userId: sanitizeUserId(userId),
        connectionId: sanitizeConnectionId(connectionId),
        appCount: appIds.length,
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          handleWebSocketMessage(message, userId, connectionId, ws);
        } catch (error) {
          // SECURITY: Sanitize error details
          logger.error('WebSocket message parse error', {
            error: sanitizeError(error),
            userId: sanitizeUserId(userId),
          });
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Invalid message format',
            })
          );
        }
      });

      // Handle connection close
      ws.on('close', async () => {
        // SECURITY: Sanitize PII in logs
        logger.info('WebSocket connection closed', {
          userId: sanitizeUserId(userId),
          connectionId: sanitizeConnectionId(connectionId),
        });
        await realtimeDeliveryService.disconnect(connectionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        // SECURITY: Sanitize error details and PII
        logger.error('WebSocket connection error', {
          userId: sanitizeUserId(userId),
          connectionId: sanitizeConnectionId(connectionId),
          error: sanitizeError(error),
        });
      });

      // Send connection acknowledgement
      ws.send(
        JSON.stringify({
          type: 'connected',
          connectionId,
          timestamp: Date.now(),
        })
      );
    } catch (error) {
      // SECURITY: Sanitize error details
      logger.error('WebSocket connection handler error', {
        error: sanitizeError(error),
      });
      ws.close(1011, 'Internal server error');
    }
  });

  // Handle server errors
  wss.on('error', (error) => {
    // SECURITY: Sanitize error details
    logger.error('WebSocket server error', {
      error: sanitizeError(error),
    });
  });

  return wss;
};

/**
 * Handle incoming WebSocket messages
 */
async function handleWebSocketMessage(
  message: any,
  userId: string,
  connectionId: string,
  ws: WebSocket
): Promise<void> {
  try {
    switch (message.type) {
      case 'heartbeat':
        // Heartbeat is handled by the service
        break;

      case 'mark_read':
        if (message.notificationId) {
          // Acknowledge mark read
          ws.send(
            JSON.stringify({
              type: 'mark_read_ack',
              notificationId: message.notificationId,
              timestamp: Date.now(),
            })
          );
        }
        break;

      case 'update_subscriptions':
        if (Array.isArray(message.appIds) && message.appIds.length > 0) {
          // Update subscription list
          ws.send(
            JSON.stringify({
              type: 'subscriptions_updated',
              appIds: message.appIds,
              timestamp: Date.now(),
            })
          );
        }
        break;

      default:
        // SECURITY: Log unknown message types for monitoring
        logger.warn('Unknown WebSocket message type', {
          messageType: message.type,
          userId: sanitizeUserId(userId),
        });
        ws.send(
          JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${message.type}`,
          })
        );
    }
  } catch (error) {
    // SECURITY: Sanitize error details
    logger.error('WebSocket message handler error', {
      error: sanitizeError(error),
      userId: sanitizeUserId(userId),
    });
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'Error processing message',
      })
    );
  }
}

/**
 * Graceful shutdown of WebSocket server
 */
export const shutdownWebSocket = (wss: WebSocketServer): Promise<void> => {
  return new Promise((resolve) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Server shutdown');
      }
    });

    wss.close(() => {
      logger.info('WebSocket server closed gracefully');
      resolve();
    });
  });
};
