/**
 * Limohawk Booking Webhook Handler
 *
 * Handles booking events from Limohawk booking system:
 * - booking.completed: Award loyalty points to customer
 * - booking.refunded: Process refund (deduct points if applicable)
 *
 * Security:
 * - Validates HMAC-SHA256 signature
 * - Stores raw events for audit trail
 *
 * Integration:
 * - Awards points via limohawk.award_points() stored function
 * - Sends notifications via Brevo service
 */

import crypto from 'crypto';
import { Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface LimohawkWebhookPayload {
  event_type: 'booking.completed' | 'booking.refunded' | 'booking.cancelled';
  booking_id: string;
  customer: {
    id: string;
    email: string;
    name?: string;
    phone?: string;
  };
  fare: {
    gross_pence: number;
    vat_pence: number;
    net_pence: number;
  };
  timestamp: string;
}

interface AwardPointsResult {
  success: boolean;
  points_earned: number;
  new_balance: number;
  account_id: string;
  is_vip: boolean;
  error: string | null;
}

// ============================================================================
// Configuration
// ============================================================================

const LIMOHAWK_WEBHOOK_SECRET = process.env.LIMOHAWK_WEBHOOK_SECRET || '';

// ============================================================================
// Supabase Client
// ============================================================================

function getSupabaseServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// HMAC Signature Verification
// ============================================================================

/**
 * Verify the HMAC-SHA256 signature from Limohawk
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.warn('[LimohawkWebhook] Webhook secret not configured, skipping verification');
    return process.env.NODE_ENV === 'development';
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // Compare signatures using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('[LimohawkWebhook] Signature verification error:', error);
    return false;
  }
}

// ============================================================================
// Event Storage
// ============================================================================

/**
 * Store raw webhook event for audit and replay
 * Returns the event ID if successfully stored, null if duplicate
 */
async function storeBookingEvent(
  supabase: SupabaseClient,
  payload: LimohawkWebhookPayload,
  rawPayload: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('limohawk.booking_events')
      .insert({
        booking_id: payload.booking_id,
        external_customer_id: payload.customer.id,
        event_type: payload.event_type,
        gross_fare_pence: payload.fare.gross_pence,
        vat_pence: payload.fare.vat_pence,
        net_fare_pence: payload.fare.net_pence,
        raw_payload: JSON.parse(rawPayload),
      })
      .select('id')
      .single();

    if (error) {
      // Check for duplicate (unique constraint violation)
      if (error.code === '23505') {
        console.log(
          `[LimohawkWebhook] Duplicate event: ${payload.booking_id}/${payload.event_type}`
        );
        return null;
      }
      throw error;
    }

    return data?.id || null;
  } catch (error) {
    console.error('[LimohawkWebhook] Error storing event:', error);
    throw error;
  }
}

/**
 * Mark event as processed
 */
async function markEventProcessed(
  supabase: SupabaseClient,
  eventId: string,
  error?: string
): Promise<void> {
  await supabase
    .from('limohawk.booking_events')
    .update({
      processed_at: new Date().toISOString(),
      processing_error: error || null,
    })
    .eq('id', eventId);
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle booking.completed event - Award loyalty points
 */
async function handleBookingCompleted(
  supabase: SupabaseClient,
  payload: LimohawkWebhookPayload
): Promise<AwardPointsResult> {
  const { customer, booking_id, fare } = payload;

  // Call the stored function to award points
  const { data, error } = await supabase.rpc('limohawk.award_points', {
    p_external_customer_id: customer.id,
    p_email: customer.email,
    p_name: customer.name || null,
    p_booking_id: booking_id,
    p_net_fare_pence: fare.net_pence,
  });

  if (error) {
    console.error('[LimohawkWebhook] Error awarding points:', error);
    throw error;
  }

  const result = data?.[0] as AwardPointsResult;

  console.log(
    `[LimohawkWebhook] Awarded ${result.points_earned} points to ${customer.email} ` +
      `(balance: ${result.new_balance}, VIP: ${result.is_vip})`
  );

  return result;
}

/**
 * Handle booking.refunded event - Process refund
 */
async function handleBookingRefunded(
  supabase: SupabaseClient,
  payload: LimohawkWebhookPayload
): Promise<void> {
  const { customer, booking_id } = payload;

  // Find the original points awarded for this booking
  const { data: originalTransaction } = await supabase
    .from('limohawk.points_ledger')
    .select('account_id, points_amount')
    .eq('booking_id', booking_id)
    .eq('transaction_type', 'booking_earn')
    .single();

  if (!originalTransaction) {
    console.log(`[LimohawkWebhook] No points found for refunded booking ${booking_id}`);
    return;
  }

  // Deduct the points (negative adjustment)
  const { error } = await supabase.rpc('limohawk.admin_adjust_points', {
    p_account_id: originalTransaction.account_id,
    p_points_adjustment: -originalTransaction.points_amount,
    p_reason: `Refund for booking ${booking_id}`,
    p_performed_by: 'system',
  });

  if (error) {
    console.error('[LimohawkWebhook] Error processing refund:', error);
    throw error;
  }

  console.log(
    `[LimohawkWebhook] Deducted ${originalTransaction.points_amount} points for refunded booking ${booking_id}`
  );
}

// ============================================================================
// Main Handler
// ============================================================================

export async function handleLimohawkWebhook(req: Request, res: Response): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const supabase = getSupabaseServiceClient();

  try {
    // 1. Get signature from headers
    const signature = req.headers['x-limohawk-signature'] as string;
    if (!signature) {
      console.warn('[LimohawkWebhook] Missing signature header');
      res.status(400).json({ error: 'Missing signature', code: 'MISSING_SIGNATURE' });
      return;
    }

    // 2. Get raw body for signature verification
    // Note: Requires raw body middleware to be configured
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    // 3. Verify signature
    if (!verifySignature(rawBody, signature, LIMOHAWK_WEBHOOK_SECRET)) {
      console.error('[LimohawkWebhook] Invalid signature');
      res.status(403).json({ error: 'Invalid signature', code: 'INVALID_SIGNATURE' });
      return;
    }

    // 4. Parse payload
    const payload: LimohawkWebhookPayload =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    console.log(
      `[LimohawkWebhook] Received ${payload.event_type} for booking ${payload.booking_id}`
    );

    // 5. Store raw event (idempotency check)
    const eventId = await storeBookingEvent(supabase, payload, rawBody);
    if (!eventId) {
      // Duplicate event - return success (idempotent)
      res.status(200).json({
        received: true,
        duplicate: true,
        message: 'Event already processed',
      });
      return;
    }

    // 6. Process based on event type
    let processingError: string | undefined;
    let result: Record<string, unknown> = {};

    try {
      switch (payload.event_type) {
        case 'booking.completed':
          const pointsResult = await handleBookingCompleted(supabase, payload);
          result = {
            points_earned: pointsResult.points_earned,
            new_balance: pointsResult.new_balance,
            is_vip: pointsResult.is_vip,
          };
          break;

        case 'booking.refunded':
          await handleBookingRefunded(supabase, payload);
          result = { refund_processed: true };
          break;

        case 'booking.cancelled':
          // Cancellations before completion don't award/deduct points
          console.log(`[LimohawkWebhook] Booking cancelled: ${payload.booking_id}`);
          result = { acknowledged: true };
          break;

        default:
          console.warn(`[LimohawkWebhook] Unknown event type: ${payload.event_type}`);
          result = { acknowledged: true };
      }
    } catch (handlerError: unknown) {
      const errorMessage =
        handlerError instanceof Error ? handlerError.message : String(handlerError);
      console.error(`[LimohawkWebhook] Handler error:`, handlerError);
      processingError = errorMessage;
      // Continue to mark as processed with error
    }

    // 7. Mark event as processed
    await markEventProcessed(supabase, eventId, processingError);

    // 8. Return success (always 200 to prevent retries)
    res.status(200).json({
      received: true,
      event_type: payload.event_type,
      booking_id: payload.booking_id,
      ...result,
      ...(processingError && { processing_error: processingError }),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[LimohawkWebhook] Error:', error);
    // Return 500 only for catastrophic failures
    res.status(500).json({
      error: 'Webhook processing failed',
      code: 'PROCESSING_ERROR',
      message: errorMessage,
    });
  }
}

// Export for Express router
export default handleLimohawkWebhook;
