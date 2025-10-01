/**
 * POST /api/payments/checkout/complete (T079)
 *
 * Completes a checkout session after payment confirmation
 *
 * Request Body:
 * {
 *   transactionId: string;  // OrivaPay transaction ID to complete
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   transactionId: string;
 *   status: string;
 * }
 *
 * Error Responses:
 * - 400: Invalid request (missing transactionId, transaction not found, already completed)
 * - 401: Unauthorized (no authentication)
 * - 403: Forbidden (user does not own transaction)
 * - 500: Server error
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Types
interface CheckoutCompleteRequest {
  transactionId: string;
}

interface CheckoutCompleteResponse {
  success: boolean;
  transactionId: string;
  status: string;
}

interface ErrorResponse {
  error: string;
}

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
function validateRequest(body: any): { valid: boolean; error?: string; data?: CheckoutCompleteRequest } {
  if (!body.transactionId) {
    return { valid: false, error: 'transactionId is required' };
  }

  if (typeof body.transactionId !== 'string') {
    return { valid: false, error: 'transactionId must be a string' };
  }

  return {
    valid: true,
    data: {
      transactionId: body.transactionId,
    },
  };
}

export async function handleCheckoutComplete(
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
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
      }
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

    const { transactionId } = validation.data!;

    // 4. Verify transaction exists and belongs to user
    const { data: transaction, error: txError } = await supabase
      .from('orivapay_transactions')
      .select('id, buyer_id, status')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      return res.status(400).json({ error: 'Transaction not found' });
    }

    if (transaction.buyer_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to complete this transaction' });
    }

    // 5. Check if already completed
    if (transaction.status === 'succeeded') {
      return res.status(400).json({ error: 'Transaction already completed' });
    }

    if (transaction.status === 'refunded') {
      return res.status(400).json({ error: 'Transaction has been refunded' });
    }

    if (transaction.status === 'failed') {
      return res.status(400).json({ error: 'Transaction failed' });
    }

    // TODO: Implement checkout completion service
    // The ServiceRegistry and checkout service don't exist yet.
    // This handler needs proper implementation with:
    // - Verify payment status with Stripe
    // - Update transaction status in orivapay_transactions
    // - Handle escrow release if applicable
    // - Trigger notifications

    return res.status(501).json({
      error: 'Checkout completion service not implemented yet',
      code: 'NOT_IMPLEMENTED'
    });

  } catch (error: any) {
    console.error('Checkout complete error:', error);

    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return res.status(400).json({ error: 'Transaction not found' });
    }

    if (error.message?.includes('already')) {
      return res.status(400).json({ error: 'Transaction already processed' });
    }

    // Generic server error
    return res.status(500).json({
      error: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Failed to complete checkout'
    });
  }
}