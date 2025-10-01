// @ts-nocheck - TODO: Fix type errors
/**
 * POST /api/payments/checkout/create (T078)
 *
 * Creates a checkout session for purchasing a marketplace item
 *
 * Request Body:
 * {
 *   itemId: string;        // Marketplace item ID
 *   quantity?: number;     // Purchase quantity (default: 1)
 * }
 *
 * Response:
 * {
 *   clientSecret: string;      // Stripe PaymentIntent client secret
 *   paymentIntentId: string;   // Stripe PaymentIntent ID
 *   transactionId: string;     // OrivaPay transaction ID
 *   amount: number;            // Total amount in cents
 *   platformFee: number;       // Platform fee in cents
 *   useEscrow: boolean;        // Whether escrow is used
 * }
 *
 * Error Responses:
 * - 400: Invalid request (missing itemId, invalid quantity, item not found, etc.)
 * - 401: Unauthorized (no authentication)
 * - 500: Server error
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Types
interface CheckoutCreateRequest {
  itemId: string;
  quantity?: number;
}

interface CheckoutSession {
  clientSecret: string;
  paymentIntentId: string;
  transactionId: string;
  amount: number;
  platformFee: number;
  useEscrow: boolean;
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
function validateRequest(body: any): { valid: boolean; error?: string; data?: CheckoutCreateRequest } {
  if (!body.itemId) {
    return { valid: false, error: 'itemId is required' };
  }

  if (typeof body.itemId !== 'string') {
    return { valid: false, error: 'itemId must be a string' };
  }

  const quantity = body.quantity ?? 1;

  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
    return { valid: false, error: 'quantity must be an integer' };
  }

  if (quantity < 1) {
    return { valid: false, error: 'quantity must be at least 1' };
  }

  return {
    valid: true,
    data: {
      itemId: body.itemId,
      quantity,
    },
  };
}

export async function handleCheckoutCreate(
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

    const { itemId, quantity } = validation.data!;

    // TODO: Implement checkout service
    // The ServiceRegistry and checkout service don't exist yet.
    // This handler needs proper implementation with:
    // - Stripe PaymentIntent creation
    // - Transaction record creation in orivapay_transactions
    // - Platform fee calculation
    // - Escrow handling

    return res.status(501).json({
      error: 'Checkout service not implemented yet',
      code: 'NOT_IMPLEMENTED'
    });

  } catch (error: any) {
    console.error('Checkout create error:', error);

    // Handle specific error cases
    if (error.message?.includes('not found')) {
      return res.status(400).json({ error: 'Item not found' });
    }

    if (error.message?.includes('insufficient inventory')) {
      return res.status(400).json({ error: 'Insufficient inventory' });
    }

    if (error.message?.includes('Stripe account')) {
      return res.status(400).json({ error: 'Seller does not have a Stripe account configured' });
    }

    // Generic server error
    return res.status(500).json({
      error: process.env.NODE_ENV === 'development'
        ? error.message
        : 'Failed to create checkout session'
    });
  }
}