/**
 * Payments routes — POST /payment-links
 * Mounted at /api/v1/payments (see api/index.ts)
 *
 * Auth:  X-API-Key: oriva_pk_… (validated by the shared validateApiKey
 *        middleware passed from api/index.ts). The middleware populates
 *        req.keyInfo.userId with the API key owner's user_id.
 *
 * Gate:  The caller must have a row in rea_agents keyed by user_id.
 *        If the row is missing the request is rejected with 403.
 *
 * Funds-flow modes (set automatically by server, NOT by caller):
 *   Direct Charge     — merchant_connect_account_id present.
 *   Separate Transfers — merchant_connect_account_id absent (Phase 1 fallback).
 */

import { Router } from 'express';
import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { RequestHandler } from 'express';
import { respondWithError } from '../utils/response';
import { PaymentLinkBodySchema } from '../../openapi/schemas/payments';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_FEE_RATE = 0.1; // 10% — matches /api/checkout/product-session

// ---------------------------------------------------------------------------
// Lazy Stripe init
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(key.trim(), {
      apiVersion: '2025-10-29.clover',
    });
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createPaymentsRouter(
  supabase: SupabaseClient,
  logger: Logger,
  validateApiKey: RequestHandler | RequestHandler[]
): Router {
  const router = Router();

  /**
   * POST /payment-links
   *
   * Creates a Stripe Checkout Session and returns { id, url, expires_at }.
   */
  router.post(
    '/payment-links',
    ...(Array.isArray(validateApiKey) ? validateApiKey : [validateApiKey]),
    async (req: any, res: any) => {
      try {
        // ── 1. Resolve caller user_id from keyInfo (populated by validateApiKey) ──
        const userId: string | undefined = req.keyInfo?.userId;
        if (!userId) {
          return respondWithError(res, 401, 'UNAUTHORIZED', 'API key authentication required');
        }

        // ── 2. Gate: verify caller has a rea_agents row ──────────────────────────
        const { data: agentRow, error: agentError } = await supabase
          .from('rea_agents')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (agentError) {
          logger.error('[payments] rea_agents lookup failed', {
            userId,
            error: agentError.message,
          });
          return respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
        }

        if (!agentRow) {
          return respondWithError(
            res,
            403,
            'AGENT_NOT_FOUND',
            'Author agent record not found. Register as a skill author at oriva.io/settings/developer before creating payment links.'
          );
        }

        // ── 3. Validate request body ─────────────────────────────────────────────
        const parse = PaymentLinkBodySchema.safeParse(req.body ?? {});
        if (!parse.success) {
          const first = parse.error.issues[0];
          return respondWithError(
            res,
            400,
            'VALIDATION_ERROR',
            first ? `${first.path.join('.')}: ${first.message}` : 'Invalid request body'
          );
        }

        const {
          amount_cents,
          currency,
          description,
          merchant_connect_account_id,
          oriva_manifest_id,
          oriva_invocation_id,
          success_url,
          cancel_url,
        } = parse.data;

        // HTTPS scheme enforcement (defense-in-depth; Stripe enforces in live mode too)
        for (const [fieldName, fieldValue] of [
          ['success_url', success_url],
          ['cancel_url', cancel_url],
        ] as const) {
          try {
            const parsed = new URL(fieldValue);
            if (parsed.protocol !== 'https:') {
              return respondWithError(
                res,
                400,
                'INVALID_FIELD',
                `${fieldName} must use https:// scheme`
              );
            }
          } catch {
            return respondWithError(res, 400, 'INVALID_FIELD', `${fieldName} must be a valid URL`);
          }
        }

        // ── 4. Build Stripe Checkout Session ─────────────────────────────────────
        const stripe = getStripe();
        const normalizedCurrency = currency.toLowerCase();

        const baseMetadata: Record<string, string> = {
          created_by_agent_id: agentRow.id,
          ...(oriva_manifest_id ? { oriva_manifest_id } : {}),
          ...(oriva_invocation_id ? { oriva_invocation_id } : {}),
        };

        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
          {
            price_data: {
              currency: normalizedCurrency,
              unit_amount: amount_cents,
              product_data: { name: description || 'Oriva Payment' },
            },
            quantity: 1,
          },
        ];

        let session: Stripe.Checkout.Session;

        if (merchant_connect_account_id) {
          // ── Phase 2: Direct Charge ───────────────────────────────────────────
          // Buyer is charged via the merchant's Connect account.
          // Oriva's application_fee_amount (10%) is deducted at charge time and
          // retained on the platform account.
          const applicationFeeAmount = Math.floor(amount_cents * PLATFORM_FEE_RATE);

          session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: lineItems,
            payment_intent_data: {
              application_fee_amount: applicationFeeAmount,
              on_behalf_of: merchant_connect_account_id,
              transfer_data: { destination: merchant_connect_account_id },
            },
            metadata: {
              ...baseMetadata,
              funds_flow: 'direct_charge',
              merchant_connect_account_id,
              platform_fee_cents: applicationFeeAmount.toString(),
            },
            success_url,
            cancel_url,
          });
        } else {
          // ── Phase 1 fallback: Separate Transfers ─────────────────────────────
          // Buyer is charged on the Oriva platform account.
          // REA cron distributes the author's share post-settlement.
          session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: lineItems,
            metadata: {
              ...baseMetadata,
              funds_flow: 'separate_transfers',
            },
            success_url,
            cancel_url,
          });
        }

        // ── 5. Return ────────────────────────────────────────────────────────────
        res.status(200).json({
          ok: true,
          success: true,
          data: {
            id: session.id,
            url: session.url,
            expires_at: session.expires_at,
          },
        });
      } catch (err: unknown) {
        // Distinguish Stripe errors (502) from unhandled errors (500)
        const isStripe =
          err instanceof Error &&
          (err.constructor.name === 'StripeError' ||
            err.constructor.name.startsWith('Stripe') ||
            ('type' in err &&
              typeof (err as any).type === 'string' &&
              (err as any).type.startsWith('Stripe')));

        if (isStripe) {
          logger.error('[payments] Stripe error', {
            message: (err as Error).message,
          });
          return respondWithError(
            res,
            502,
            'STRIPE_ERROR',
            err instanceof Error ? err.message : 'Stripe error'
          );
        }

        logger.error('[payments] Unhandled error', {
          error: err instanceof Error ? err.message : String(err),
        });
        respondWithError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
      }
    }
  );

  return router;
}
