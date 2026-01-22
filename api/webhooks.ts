/**
 * Webhooks API Handler
 * Handles external service webhooks
 *
 * Routes:
 *   POST /api/webhooks/twilio   - Twilio recording status callbacks
 *   POST /api/webhooks/deepgram - Deepgram transcription completion callbacks
 *   POST /api/webhooks/limohawk        - Limohawk booking events (loyalty points)
 *   POST /api/webhooks/stripe-limohawk - Stripe subscription events (VIP membership)
 *
 * Pattern: Catch-all routing similar to payments.ts
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTwilioWebhook } from '../src/handlers/webhooks/twilio';
import { handleDeepgramWebhook } from '../src/handlers/webhooks/deepgram';
import { handleLimohawkWebhook } from '../src/handlers/webhooks/limohawk';
import { handleStripeLimohawkWebhook } from '../src/handlers/webhooks/stripeLimohawk';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { url, method } = req;

  // Only allow POST for webhooks
  if (method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Route to appropriate handler based on URL
  if (url?.match(/\/webhooks\/twilio$/)) {
    // Cast to Express-like request/response for handler compatibility
    await handleTwilioWebhook(req as any, res as any);
    return;
  }

  if (url?.match(/\/webhooks\/deepgram$/)) {
    await handleDeepgramWebhook(req as any, res as any);
    return;
  }

  if (url?.match(/\/webhooks\/limohawk$/)) {
    await handleLimohawkWebhook(req as any, res as any);
    return;
  }

  if (url?.match(/\/webhooks\/stripe-limohawk$/)) {
    await handleStripeLimohawkWebhook(req, res);
    return;
  }

  res.status(404).json({ error: 'Webhook endpoint not found', code: 'NOT_FOUND' });
}
