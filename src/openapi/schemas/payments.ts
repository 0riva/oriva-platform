import { z } from 'zod';
import { registry } from '../registry';

// ── Request body ──────────────────────────────────────────────────────────────

export const PaymentLinkBodySchema = z.object({
  amount_cents: z
    .number()
    .int()
    .min(1)
    .max(99_999_999)
    .describe('Charge amount in the smallest currency unit (e.g. cents for USD). Range 1–99,999,999.'),
  currency: z
    .string()
    .length(3)
    .describe('ISO 4217 three-letter currency code (e.g. "usd").'),
  description: z
    .string()
    .max(500)
    .optional()
    .describe('Product description shown on the Stripe Checkout page.'),
  merchant_connect_account_id: z
    .string()
    .regex(/^acct_[A-Za-z0-9]+$/)
    .optional()
    .describe(
      'Stripe Connect account ID (format: acct_…). ' +
        'When present the session runs as a Direct Charge: Stripe charges the buyer ' +
        'via the merchant account; Oriva collects a 10% application fee. ' +
        'When absent the session falls back to Separate Transfers: Oriva charges on ' +
        'the platform account and distributes via the REA payout cron.'
    ),
  oriva_manifest_id: z
    .string()
    .uuid()
    .optional()
    .describe('REA manifest UUID for skill royalty attribution.'),
  oriva_invocation_id: z
    .string()
    .uuid()
    .optional()
    .describe('Unique invocation UUID for analytics and deduplication.'),
  success_url: z
    .string()
    .url()
    .describe('URL the buyer is redirected to after a successful payment. Must use https://.'),
  cancel_url: z
    .string()
    .url()
    .describe('URL the buyer is redirected to if they abandon the checkout. Must use https://.'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Arbitrary key-value pairs forwarded to the Stripe Checkout Session metadata.'),
});

// ── Response schema ───────────────────────────────────────────────────────────

export const PaymentLinkResponseSchema = registry.register(
  'PaymentLink',
  z.object({
    ok: z.literal(true),
    success: z.literal(true),
    data: z.object({
      id: z.string().describe('Stripe Checkout Session ID (cs_…).'),
      url: z.string().describe('Hosted Checkout URL. Redirect the buyer here.'),
      expires_at: z
        .number()
        .int()
        .describe('Unix timestamp (seconds) when the Checkout Session expires.'),
    }),
  })
);

// ── Path registration ─────────────────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/api/v1/payments/payment-links',
  operationId: 'createPaymentLink',
  tags: ['Payments'],
  summary: 'Create a payment link (Checkout Session)',
  description:
    'Creates a Stripe Checkout Session and returns a one-time hosted payment URL.\n\n' +
    '**Funds-flow modes**\n\n' +
    '| Mode | When | Who is charged | Oriva fee |\n' +
    '|---|---|---|---|\n' +
    '| **Direct Charge** | `merchant_connect_account_id` present | Buyer charged via merchant Connect account | 10% `application_fee_amount` deducted at charge time. `funds_flow=direct_charge` written to session metadata. |\n' +
    '| **Separate Transfers** | `merchant_connect_account_id` absent | Buyer charged on Oriva platform account | REA cron distributes author share post-settlement. `funds_flow=separate_transfers` written to session metadata. |\n\n' +
    'The `funds_flow` field in the Stripe metadata is set automatically by the server based on the presence of `merchant_connect_account_id` — callers do not set it.\n\n' +
    'Requires an active `oriva_pk_` API key whose owner has a registered REA agent record.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: PaymentLinkBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Checkout Session created. Redirect the buyer to `data.url`.',
      content: { 'application/json': { schema: PaymentLinkResponseSchema } },
    },
    400: { description: 'Validation error — missing required field or invalid format' },
    401: { description: 'Missing or invalid API key' },
    403: {
      description:
        'Caller does not have a registered REA agent record. ' +
        'Register as a skill author at oriva.io/settings/developer before using this endpoint.',
    },
    502: { description: 'Stripe API error — details in response body' },
    500: { description: 'Internal server error' },
  },
});
