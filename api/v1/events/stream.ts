// Task: T027 - WSS /api/v1/events/stream endpoint
// Description: WebSocket stream for real-time events

import { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { parse } from 'url';
import { logger } from '../../utils/logger';
import { registerConnection, updateSubscriptions, removeConnection } from '../../services/websocketBroadcaster';
import { authenticateWebSocket } from '../../middleware/websocket-auth';

// WebSocket server instance (singleton)
let wss: WebSocketServer | null = null;

export function initializeWebSocketServer(server: any) {
  if (wss) {
    return wss;
  }

  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    const { query } = parse(req.url || '', true);
    const appId = query.app_id as string;
    const userId = query.user_id as string;
    const authToken = query.auth as string;

    // Authenticate
    const authResult = await authenticateWebSocket(appId, userId, authToken);
    if (!authResult.authenticated) {
      logger.warn('WebSocket authentication failed', { appId, userId });
      ws.close(4001, 'Authentication failed');
      return;
    }

    // Register connection
    const connectionId = registerConnection(userId, appId, ws, []);

    if (!connectionId) {
      logger.warn('Failed to register WebSocket connection (limit reached)', { userId, appId });
      ws.close(4002, 'Connection limit exceeded');
      return;
    }

    logger.info('WebSocket connection established', { connectionId, userId, appId });

    // Handle incoming messages (subscription updates)
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribe') {
          const subscriptions = message.subscriptions || [message.event_category];
          updateSubscriptions(userId, connectionId, subscriptions);
        }
      } catch (error) {
        logger.error('Failed to parse WebSocket message', {
          error: error instanceof Error ? error.message : String(error),
          connectionId,
        });
      }
    });

    // Handle connection close
    ws.on('close', () => {
      logger.info('WebSocket connection closed', { connectionId, userId });
      removeConnection(userId, connectionId);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', {
        error: error.message,
        connectionId,
        userId,
      });
      removeConnection(userId, connectionId);
    });
  });

  logger.info('WebSocket server initialized');

  return wss;
}

export function handleWebSocketUpgrade(req: IncomingMessage, socket: any, head: Buffer) {
  if (!wss) {
    logger.error('WebSocket server not initialized');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss!.emit('connection', ws, req);
  });
}
