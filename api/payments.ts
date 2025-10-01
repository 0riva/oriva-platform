// Consolidated Payments API Handler
// Handles: POST /api/payments/checkout/create
//          POST /api/payments/checkout/complete
//          POST /api/payments/payouts/create
//          POST /api/payments/webhooks/stripe
// Pattern: Catch-all routing to reduce function count

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCheckoutCreate } from '../src/handlers/payments/checkout/create';
import { handleCheckoutComplete } from '../src/handlers/payments/checkout/complete';
import { handlePayoutCreate } from '../src/handlers/payments/payouts/create';
import { handleStripeWebhook } from '../src/handlers/payments/webhooks/stripe';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { url, method } = req;

  if (method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Route to appropriate handler based on URL
  if (url?.includes('/checkout/create')) {
    await handleCheckoutCreate(req, res);
    return;
  }

  if (url?.includes('/checkout/complete')) {
    await handleCheckoutComplete(req, res);
    return;
  }

  if (url?.includes('/payouts/create')) {
    await handlePayoutCreate(req, res);
    return;
  }

  if (url?.includes('/webhooks/stripe')) {
    await handleStripeWebhook(req, res);
    return;
  }

  res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
}
