// Task: T025 - POST /api/v1/apps/:appId/events endpoint
// Description: Publish platform events

import { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { authenticate } from '../../middleware/auth';
import { publishEvent } from '../../services/eventPublisher';

interface PublishEventRequest {
  user_id: string;
  event_category: 'notification' | 'user' | 'session' | 'transaction';
  event_type: string;
  entity_type: string;
  entity_id: string;
  event_data?: Record<string, unknown>;
}

async function publishEventHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Authenticate
  const user = await authenticate(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_MISSING' });
    return;
  }

  const { appId } = req.query;
  if (!appId || typeof appId !== 'string') {
    throw validationError('App ID is required');
  }

  const {
    user_id,
    event_category,
    event_type,
    entity_type,
    entity_id,
    event_data = {},
  }: PublishEventRequest = req.body;

  // Validate required fields
  if (!user_id || !event_category || !event_type || !entity_type || !entity_id) {
    throw validationError('Missing required fields: user_id, event_category, event_type, entity_type, entity_id');
  }

  try {
    const result = await publishEvent({
      appId,
      userId: user_id,
      eventCategory: event_category,
      eventType: event_type,
      entityType: entity_type,
      entityId: entity_id,
      eventData: event_data,
      ipAddress: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] as string,
    });

    res.status(200).json({
      event_id: result.event_id,
      timestamp: result.timestamp,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Invalid event_category')) {
        res.status(400).json({ error: error.message, code: 'INVALID_EVENT_CATEGORY' });
        return;
      }
      if (error.message.includes('Invalid event_type format')) {
        res.status(400).json({ error: error.message, code: 'INVALID_EVENT_TYPE' });
        return;
      }
    }
    throw error;
  }
}

export default asyncHandler(
  rateLimit({ maxRequests: 1000, windowMs: 15 * 60 * 1000 })(publishEventHandler)
);
