// @ts-nocheck - TODO: Fix type errors
/**
 * POST /api/payments/payouts/create (T083)
 *
 * Creates a payout request for seller's available balance
 *
 * Request Body:
 * {
 *   amountCents?: number;  // Optional: payout amount in cents (defaults to full balance)
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   payoutId: string;
 *   amountCents: number;
 *   status: string;
 * }
 *
 * Error Responses:
 * - 400: Invalid amount, insufficient balance, no Stripe account
 * - 401: Unauthorized (no authentication)
 * - 500: Server error
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Types
interface PayoutCreateRequest {
  amountCents?: number;
}

interface PayoutCreateResponse {
  success: boolean;
  payoutId: string;
  amountCents: number;
  status: string;
}

interface ErrorResponse {
  error: string;
}

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Validate and extract authentication from request
 */
function getAuthToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Validate request body
 */
function validateRequest(body: any): { valid: boolean; error?: string; data?: PayoutCreateRequest } {
  const amountCents = body.amountCents;

  // Amount is optional (defaults to full balance)
  if (amountCents !== undefined) {
    if (typeof amountCents !== 'number' || !Number.isInteger(amountCents)) {
      return { valid: false, error: 'amountCents must be an integer' };
    }

    if (amountCents <= 0) {
      return { valid: false, error: 'amountCents must be positive' };
    }
  }

  return {
    valid: true,
    data: {
      amountCents,
    },
  };
}

/**
 * Calculate seller's available balance
 */
async function calculateAvailableBalance(
  sellerId: string,
  supabase: ReturnType<typeof createClient>
): Promise<number> {
  // Get total from successful transactions
  const { data: transactions, error: txError } = await supabase
    .from('orivapay_transactions')
    .select('seller_net_cents')
    .eq('seller_id', sellerId)
    .eq('status', 'succeeded');

  if (txError) {
    throw new Error(`Failed to fetch transactions: ${txError.message}`);
  }

  const totalEarned = transactions?.reduce((sum, tx) => sum + tx.seller_net_cents, 0) || 0;

  // Subtract total from completed/pending payouts
  const { data: payouts, error: payoutError } = await supabase
    .from('orivapay_payouts')
    .select('amount_cents')
    .eq('seller_id', sellerId)
    .in('status', ['pending', 'completed']);

  if (payoutError) {
    throw new Error(`Failed to fetch payouts: ${payoutError.message}`);
  }

  const totalPaidOut = payouts?.reduce((sum, payout) => sum + payout.amount_cents, 0) || 0;

  return totalEarned - totalPaidOut;
}

export async function handlePayoutCreate(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Validate authentication
    const token = getAuthToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 2. Verify token and get user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // 3. Validate request body
    const validation = validateRequest(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error! });
    }

    const requestedAmount = validation.data!.amountCents;

    // 4. Get seller's profile and verify Stripe account
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(400).json({ error: 'Profile not found' });
    }

    if (!profile.stripe_account_id) {
      return res.status(400).json({ error: 'Stripe account not configured' });
    }

    // 5. Calculate available balance
    const availableBalance = await calculateAvailableBalance(user.id, supabase);

    if (availableBalance <= 0) {
      return res.status(400).json({ error: 'No available balance to payout' });
    }

    // 6. Determine payout amount (requested or full balance)
    const payoutAmount = requestedAmount ?? availableBalance;

    if (payoutAmount > availableBalance) {
      return res.status(400).json({
        error: `Insufficient balance. Available: ${availableBalance} cents, Requested: ${payoutAmount} cents`,
      });
    }

    // 7. Create Stripe payout
    const stripePayout = await stripe.payouts.create(
      {
        amount: payoutAmount,
        currency: 'usd',
        statement_descriptor: 'ORIVA PAYOUT',
      },
      {
        stripeAccount: profile.stripe_account_id,
      }
    );

    // 8. Record payout in database
    const { data: payoutRecord, error: insertError } = await supabase
      .from('orivapay_payouts')
      .insert({
        seller_id: user.id,
        amount_cents: payoutAmount,
        currency: 'usd',
        status: 'pending',
        stripe_payout_id: stripePayout.id,
      })
      .select()
      .single();

    if (insertError || !payoutRecord) {
      console.error('Failed to record payout:', insertError);
      throw new Error('Failed to record payout');
    }

    // 9. Return success response
    return res.status(200).json({
      success: true,
      payoutId: payoutRecord.id,
      amountCents: payoutAmount,
      status: 'pending',
    });

  } catch (error: any) {
    console.error('Payout create error:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: `Stripe error: ${error.message}`,
      });
    }

    if (error.message?.includes('balance')) {
      return res.status(400).json({ error: error.message });
    }

    // Generic server error
    return res.status(500).json({
      error: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Failed to create payout'
    });
  }
}