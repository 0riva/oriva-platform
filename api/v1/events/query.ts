// Task: T026 - GET /api/v1/apps/:appId/events endpoint
// Description: Query platform events with filters

import { VercelRequest, VercelResponse } from '@vercel/node';
import { asyncHandler, validationError } from '../../middleware/error-handler';
import { rateLimit } from '../../middleware/rate-limit';
import { authenticate } from '../../middleware/auth';
import { queryEvents } from '../../services/eventPublisher';

async function queryEventsHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
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
    throw error;
  }
}

export default asyncHandler(
  rateLimit({ maxRequests: 1000, windowMs: 15 * 60 * 1000 })(queryEventsHandler)
);
