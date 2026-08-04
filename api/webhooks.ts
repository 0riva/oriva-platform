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

/**
 * Resolve which webhook was requested.
 *
 * `vercel.json` rewrites `/api/webhooks/:path*` to this function. The rewrite
 * REPLACES the URL, so `req.url` here is `/api/webhooks` with the sub-path
 * stripped — matching on `req.url` alone never matched anything, and every
 * route in this function returned its own 404. The rewrite now forwards the
 * segment as `?path=`, and we read that first.
 *
 * Falls back to parsing `req.url` so the function still works when invoked
 * directly (local dev, or if the rewrite is ever removed).
 */
function resolveWebhookName(req: VercelRequest): string {
  const q = (req.query || {}) as Record<string, string | string[] | undefined>;
  const fromQuery = Array.isArray(q.path) ? q.path.join('/') : q.path;
  if (fromQuery) return String(fromQuery).replace(/^\/+/, '');

  const path = (req.url || '').split('?')[0];
  const m = path.match(/\/webhooks\/(.+)$/);
  return m ? m[1] : '';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { method } = req;
  const name = resolveWebhookName(req);

  // Only allow POST for webhooks
  if (method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Route to appropriate handler based on URL
  if (name === 'twilio') {
    // Cast to Express-like request/response for handler compatibility
    await handleTwilioWebhook(req as any, res as any);
    return;
  }

  if (name === 'deepgram') {
    await handleDeepgramWebhook(req as any, res as any);
    return;
  }

  if (name === 'limohawk') {
    await handleLimohawkWebhook(req as any, res as any);
    return;
  }

  if (name === 'stripe-limohawk') {
    await handleStripeLimohawkWebhook(req, res);
    return;
  }

  res.status(404).json({ error: 'Webhook endpoint not found', code: 'NOT_FOUND' });
}
