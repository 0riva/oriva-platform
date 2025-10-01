// Consolidated Events API Handler
// Handles: POST/GET /api/v1/apps/:appId/events
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { rateLimit } from '../middleware/rate-limit';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { publishEvent, queryEvents } from '../services/eventPublisher';

interface PublishEventRequest {
  user_id: string;
  event_category: 'notification' | 'user' | 'session' | 'transaction';
  event_type: string;
  entity_type: string;
  entity_id: string;
  event_data?: Record<string, unknown>;
}

async function handlePublish(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
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
    res.status(400).json({
      error: 'Missing required fields: user_id, event_category, event_type, entity_type, entity_id',
      code: 'VALIDATION_ERROR',
    });
    return;
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
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
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
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    });
  }
}

async function handleQuery(req: VercelRequest, res: VercelResponse, appId: string): Promise<void> {
  const {
    user_id,
    event_category,
    event_type,
    start_date,
    end_date,
    limit = '100',
    offset = '0',
  } = req.query;

  const parsedLimit = Math.min(parseInt(limit as string, 10) || 100, 500);
  const parsedOffset = parseInt(offset as string, 10) || 0;

  try {
    const result = await queryEvents({
      appId,
      userId: user_id as string,
      eventCategory: event_category as string,
      eventType: event_type as string,
      startDate: start_date as string,
      endDate: end_date as string,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    res.status(200).json({
      events: result.events,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        has_more: result.offset + result.limit < result.total,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      code: 'INTERNAL_ERROR',
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await authenticate(req, res, async () => {
    await rateLimit(req, res, async () => {
      // Extract appId from query (set by vercel.json rewrite)
      const { appId } = req.query;
      if (!appId || typeof appId !== 'string') {
        res.status(400).json({ error: 'App ID is required', code: 'VALIDATION_ERROR' });
        return;
      }

      // Route based on HTTP method
      if (req.method === 'POST') {
        return handlePublish(req, res, appId);
      }

      if (req.method === 'GET') {
        return handleQuery(req, res, appId);
      }

      res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    });
  });
}
