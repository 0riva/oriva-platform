/**
 * POST /api/payments/webhooks/stripe (T081)
 *
 * Stripe webhook handler for payment events
 *
 * Handles the following events:
 * - payment_intent.succeeded: Payment completed successfully
 * - payment_intent.payment_failed: Payment failed
 * - charge.refunded: Charge was refunded
 *
 * Security:
 * - Verifies Stripe webhook signature to prevent tampering
 * - Uses raw request body for signature verification
 *
 * Response:
 * {
 *   received: boolean;
 *   eventType: string;
 * }
 *
 * Error Responses:
 * - 400: Invalid signature, malformed JSON
 * - 500: Server error
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getService } from '../../../src/services/ServiceRegistry';
import Stripe from 'stripe';

// Types
interface WebhookResponse {
  received: boolean;
  eventType: string;
}

interface ErrorResponse {
  error: string;
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error: any) {
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}

/**
 * Get raw request body as buffer
 * Next.js API routes parse body by default, but we need raw for signature verification
 */
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
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

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find transaction by payment intent ID
  const { data: transaction, error } = await supabase
    .from('orivapay_transactions')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  if (error || !transaction) {
    console.warn(`Transaction not found for payment intent ${paymentIntent.id}`);
    return;
  }

  // Skip if already processed (idempotency)
  if (transaction.status === 'succeeded') {
    console.log(`Transaction ${transaction.id} already succeeded, skipping`);
    return;
  }

  // Update transaction status
  const { error: updateError } = await supabase
    .from('orivapay_transactions')
    .update({
      status: 'succeeded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', transaction.id);

  if (updateError) {
    console.error(`Failed to update transaction ${transaction.id}:`, updateError);
    throw new Error(`Failed to update transaction: ${updateError.message}`);
  }

  console.log(`Payment succeeded for transaction ${transaction.id}`);
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find transaction by payment intent ID
  const { data: transaction, error } = await supabase
    .from('orivapay_transactions')
    .select('id, status')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single();

  if (error || !transaction) {
    console.warn(`Transaction not found for payment intent ${paymentIntent.id}`);
    return;
  }

  // Skip if already processed (idempotency)
  if (transaction.status === 'failed') {
    console.log(`Transaction ${transaction.id} already failed, skipping`);
    return;
  }

  // Update transaction status
  const { error: updateError } = await supabase
    .from('orivapay_transactions')
    .update({
      status: 'failed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', transaction.id);

  if (updateError) {
    console.error(`Failed to update transaction ${transaction.id}:`, updateError);
    throw new Error(`Failed to update transaction: ${updateError.message}`);
  }

  console.log(`Payment failed for transaction ${transaction.id}`);
}

/**
 * Handle charge.refunded event
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find transaction by payment intent ID
  const { data: transaction, error } = await supabase
    .from('orivapay_transactions')
    .select('id, status')
    .eq('stripe_payment_intent_id', charge.payment_intent as string)
    .single();

  if (error || !transaction) {
    console.warn(`Transaction not found for payment intent ${charge.payment_intent}`);
    return;
  }

  // Skip if already processed (idempotency)
  if (transaction.status === 'refunded') {
    console.log(`Transaction ${transaction.id} already refunded, skipping`);
    return;
  }

  // Update transaction status
  const { error: updateError } = await supabase
    .from('orivapay_transactions')
    .update({
      status: 'refunded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', transaction.id);

  if (updateError) {
    console.error(`Failed to update transaction ${transaction.id}:`, updateError);
    throw new Error(`Failed to update transaction: ${updateError.message}`);
  }

  console.log(`Charge refunded for transaction ${transaction.id}`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WebhookResponse | ErrorResponse>
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Get webhook secret
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // 2. Get signature from headers
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    // 3. Get raw body and verify signature
    const rawBody = await getRawBody(req);
    const rawBodyString = rawBody.toString('utf8');
    let event: Stripe.Event;

    try {
      event = verifyStripeSignature(rawBodyString, signature, webhookSecret);
    } catch (error: any) {
      console.error('Signature verification failed:', error.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // 4. Handle different event types
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'charge.refunded':
          await handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (handlerError: any) {
      console.error(`Error handling event ${event.type}:`, handlerError);
      // Return 200 to acknowledge receipt even if handler fails
      // Stripe will retry if we return non-2xx
    }

    // 5. Return success response
    return res.status(200).json({
      received: true,
      eventType: event.type,
    });

  } catch (error: any) {
    console.error('Webhook handler error:', error);

    // Handle JSON parse errors
    if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Generic server error
    return res.status(500).json({
      error: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Webhook processing failed'
    });
  }
}

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};