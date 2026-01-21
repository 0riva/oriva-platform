/**
 * Stripe Webhook Handler for Limohawk VIP Subscriptions
 *
 * Handles Stripe subscription events for Limohawk VIP membership:
 * - checkout.session.completed: Create VIP membership
 * - invoice.paid: Successful renewal
 * - invoice.payment_failed: Payment failed
 * - customer.subscription.updated: Status changes
 * - customer.subscription.deleted: Cancellation
 *
 * Security:
 * - Verifies Stripe webhook signature
 * - Uses raw request body for signature verification
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from '../../services/limohawk/stripeService';

// ============================================================================
// Stripe Client
// ============================================================================

const stripe = new Stripe(process.env.LIMOHAWK_STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// ============================================================================
// Configuration
// ============================================================================

// Use a separate webhook secret for Limohawk subscriptions
const WEBHOOK_SECRET = process.env.LIMOHAWK_STRIPE_WEBHOOK_SECRET;

// ============================================================================
// Raw Body Handler
// ============================================================================

/**
 * Get raw request body as buffer for signature verification
 */
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', reject);
  });
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleStripeLimohawkWebhook(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    // 1. Check webhook secret configuration
    if (!WEBHOOK_SECRET) {
      console.error('[StripeLimohawk] Webhook secret not configured');
      res.status(500).json({ error: 'Webhook secret not configured' });
      return;
    }

    // 2. Get signature from headers
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      res.status(400).json({ error: 'Missing Stripe signature', code: 'MISSING_SIGNATURE' });
      return;
    }

    // 3. Get raw body and verify signature
    const rawBody = await getRawBody(req);
    const rawBodyString = rawBody.toString('utf8');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBodyString, signature, WEBHOOK_SECRET);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[StripeLimohawk] Signature verification failed:', errorMessage);
      res.status(400).json({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
      return;
    }

    // 4. Check if this is a Limohawk-related event by examining metadata
    const isLimohawkEvent = checkIfLimohawkEvent(event);
    if (!isLimohawkEvent) {
      // Not a Limohawk event - acknowledge but don't process
      console.log(`[StripeLimohawk] Ignoring non-Limohawk event: ${event.type}`);
      res.status(200).json({ received: true, ignored: true, eventType: event.type });
      return;
    }

    console.log(`[StripeLimohawk] Processing event: ${event.type}`);

    // 5. Handle different event types
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        case 'invoice.paid':
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        default:
          console.log(`[StripeLimohawk] Unhandled event type: ${event.type}`);
      }
    } catch (handlerError: unknown) {
      const errorMessage =
        handlerError instanceof Error ? handlerError.message : String(handlerError);
      console.error(`[StripeLimohawk] Error handling ${event.type}:`, handlerError);
      // Return 200 to acknowledge - we don't want Stripe to retry
      res.status(200).json({
        received: true,
        eventType: event.type,
        error: errorMessage,
      });
      return;
    }

    // 6. Return success
    res.status(200).json({
      received: true,
      eventType: event.type,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[StripeLimohawk] Webhook handler error:', error);

    // Handle JSON parse errors
    if (errorMessage?.includes('JSON') || errorMessage?.includes('parse')) {
      res.status(400).json({ error: 'Invalid JSON payload', code: 'INVALID_JSON' });
      return;
    }

    res.status(500).json({
      error: 'Webhook processing failed',
      code: 'PROCESSING_ERROR',
    });
  }
}

/**
 * Check if the event is related to Limohawk subscriptions
 * by examining metadata in the event object
 */
function checkIfLimohawkEvent(event: Stripe.Event): boolean {
  const eventObject = event.data.object as Record<string, unknown>;

  // Check for limohawk_account_id in various places
  if (eventObject.metadata && typeof eventObject.metadata === 'object') {
    const metadata = eventObject.metadata as Record<string, string>;
    if (metadata.limohawk_account_id) {
      return true;
    }
  }

  // For invoice events, check the subscription metadata
  if (event.type.startsWith('invoice.')) {
    const invoice = eventObject as Stripe.Invoice;
    if (invoice.subscription_details?.metadata?.limohawk_account_id) {
      return true;
    }
  }

  // For subscription events, check metadata
  if (event.type.startsWith('customer.subscription.')) {
    const subscription = eventObject as Stripe.Subscription;
    if (subscription.metadata?.limohawk_account_id) {
      return true;
    }
  }

  return false;
}

// Export for router
export default handleStripeLimohawkWebhook;

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
