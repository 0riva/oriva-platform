import { z } from 'zod';
import { registry } from '../registry';

/**
 * Agent commerce — an owner's AI agent buys and lists in the Oriva marketplace
 * (o-platform#76, o-core#1576).
 *
 * These three operations are NOT served by this repo's Express app. They live
 * on o-core at https://oriva.io (apps/web/app/api/agent/purchases/route.ts and
 * apps/web/app/api/agent/listings/route.ts), so each one carries an
 * operation-level `servers` entry. The CLI and MCP server read that entry and
 * send these calls to oriva.io instead of api.oriva.io; the drift check skips
 * operations with their own `servers` because no Express route can match them.
 *
 * The contract below mirrors those route handlers — keep it in step with them.
 */

export const ORIVA_APP_SERVER = { url: 'https://oriva.io', description: 'Oriva web app (o-core)' };

// ── Shared ────────────────────────────────────────────────────────────────────

const AgentErrorSchema = registry.register(
  'AgentError',
  z.object({
    error: z.string().describe('What went wrong, in plain words.'),
  })
);

// ── Buy ───────────────────────────────────────────────────────────────────────

export const BuyListingBodySchema = registry.register(
  'BuyListingBody',
  z.object({
    listingId: z.string().uuid().describe('The marketplace listing (entry) id to buy.'),
    expectedAmountCents: z
      .number()
      .int()
      .min(1)
      .describe(
        'The exact current total you agreed to pay, in cents (1200 = 12.00). ' +
          'If the listing price differs, the purchase is refused before any charge.'
      ),
    variantIndex: z
      .number()
      .int()
      .optional()
      .describe("Which of the listing's price variants to buy (0-based). Omit for the default."),
  })
);

const BuyListingHeadersSchema = z.object({
  'Idempotency-Key': z
    .string()
    .max(200)
    .optional()
    .describe(
      'Your id for this purchase attempt, up to 200 characters. Resending the same key returns ' +
        'the first attempt instead of buying again. Always send one, and reuse it when retrying ' +
        'the same purchase. If omitted, the SDK, CLI and MCP server generate one and report it.'
    ),
});

const AgentPurchaseBoughtSchema = registry.register(
  'AgentPurchaseBought',
  z.object({
    purchase: z.object({
      id: z.string().describe('Agent purchase id.'),
      orderId: z.string().describe('Marketplace order id.'),
      orderNumber: z.string().nullable().describe('Human-readable order number.'),
      amountCents: z.number().int().describe('Amount charged, in cents.'),
      currency: z.string().describe('ISO 4217 currency code.'),
    }),
  })
);

const AgentPurchaseRepeatSchema = registry.register(
  'AgentPurchaseRepeat',
  z.object({
    repeat: z.literal(true),
    purchase: z.object({
      id: z.string(),
      status: z.string().describe('Status of the earlier attempt with this Idempotency-Key.'),
    }),
    message: z.string(),
  })
);

const AgentPurchasePendingSchema = registry.register(
  'AgentPurchasePending',
  z.object({
    pending: z.literal(true),
    purchase: z.object({ id: z.string(), orderId: z.string().nullable() }),
    message: z.string(),
  })
);

const AgentPurchaseRefusedSchema = registry.register(
  'AgentPurchaseRefused',
  z.object({
    error: z.string().describe('Why the purchase was refused.'),
    refused: z.literal(true),
    purchaseId: z.string().nullable(),
  })
);

const AgentPurchaseCardFailedSchema = registry.register(
  'AgentPurchaseCardFailed',
  z.object({
    error: z.string().describe('The card decline\'s own message, or "The card was not charged."'),
    purchaseId: z.string().nullable(),
  })
);

const AgentPurchaseRecordSchema = registry.register(
  'AgentPurchaseRecord',
  z.object({
    id: z.string(),
    entry_id: z.string().describe('The listing that was bought.'),
    listing_title: z.string().nullable(),
    order_id: z.string().nullable(),
    amount_cents: z.number().int(),
    currency: z.string(),
    status: z.string().describe('pending, succeeded, failed or refused.'),
    reason: z.string().nullable().describe('Why it was refused or failed, when it was.'),
    created_at: z.string(),
  })
);

registry.registerPath({
  method: 'post',
  path: '/api/agent/purchases',
  operationId: 'buyListing',
  tags: ['Agent'],
  servers: [ORIVA_APP_SERVER],
  summary: "Buy a marketplace listing with the owner's money, within their limits",
  description:
    "Spends the API key owner's REAL money: charges the card they saved, only after they switched " +
    'agent buying on and only within the per-purchase and per-day limits they set at ' +
    'https://oriva.io/settings/agent-buying. Use only when the owner has asked you to buy this ' +
    'listing; do not use to check a price (read the listing first) or to browse.\n\n' +
    '- `expectedAmountCents` must be the exact current total; a different price is refused.\n' +
    '- Always send an `Idempotency-Key` and reuse it when retrying the same purchase; a repeat ' +
    'returns the first attempt (200, `repeat: true`) instead of buying twice.\n' +
    '- 201 bought. 202 not finished yet: it still counts against the limits, so do NOT buy again; ' +
    'check `listAgentPurchases` later.\n' +
    '- 403 `refused: true` is final (switched off, over a limit, price changed, own listing...): ' +
    'do not retry; tell the owner the reason.\n' +
    '- 402 the card was not charged.\n\n' +
    'Authorised only by a personal access token (`Bearer oriva_pk_...`), never a browser session. ' +
    'Served by https://oriva.io, not api.oriva.io.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    headers: BuyListingHeadersSchema,
    body: {
      content: { 'application/json': { schema: BuyListingBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Bought. The card was charged.',
      content: { 'application/json': { schema: AgentPurchaseBoughtSchema } },
    },
    200: {
      description:
        'Repeat of an earlier request with the same Idempotency-Key. Nothing new was bought.',
      content: { 'application/json': { schema: AgentPurchaseRepeatSchema } },
    },
    202: {
      description:
        'Not finished yet. Still counts against the limits; check listAgentPurchases later. Do not buy again.',
      content: { 'application/json': { schema: AgentPurchasePendingSchema } },
    },
    400: {
      description:
        'Invalid input (listingId, expectedAmountCents, variantIndex or Idempotency-Key).',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    401: {
      description: 'Missing or invalid personal access token.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    402: {
      description: 'The card was not charged.',
      content: { 'application/json': { schema: AgentPurchaseCardFailedSchema } },
    },
    403: {
      description:
        'Refused, and final: agent buying switched off, over a limit, price changed, own listing, or the account has no email. Do not retry.',
      content: { 'application/json': { schema: AgentPurchaseRefusedSchema } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/agent/purchases',
  operationId: 'listAgentPurchases',
  tags: ['Agent'],
  servers: [ORIVA_APP_SERVER],
  summary: "List the owner's recent agent purchases, refused ones included",
  description:
    "Returns the API key owner's 50 most recent agent purchase attempts, newest first, with " +
    'status and reason. Use to check on a purchase that answered 202, or to see what has been ' +
    'spent. Read-only; spends nothing. Served by https://oriva.io, not api.oriva.io.',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      description: 'Recent agent purchases.',
      content: {
        'application/json': {
          schema: registry.register(
            'AgentPurchaseList',
            z.object({ purchases: z.array(AgentPurchaseRecordSchema) })
          ),
        },
      },
    },
    401: {
      description: 'Missing or invalid personal access token.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    403: {
      description: 'The account cannot be acted for by an agent (for example, it has no email).',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
  },
});

// ── List for sale ─────────────────────────────────────────────────────────────

export const CreateListingBodySchema = registry.register(
  'CreateListingBody',
  z.object({
    title: z.string().min(1).max(200).describe('Listing title, up to 200 characters.'),
    description: z
      .string()
      .max(20000)
      .describe('What is being sold, up to 20,000 characters. Runs through the content check.'),
    price: z
      .number()
      .min(0)
      .max(10000)
      .describe('Price in currency units (12 = 12.00), 0 to 10000. A paid listing is at least 1.'),
    currency: z.enum(['USD']).optional().describe('Only USD is supported. Defaults to USD.'),
    itemType: z
      .enum(['digital', 'physical', 'service', 'course', 'app', 'event'])
      .optional()
      .describe('Kind of item. Defaults to digital.'),
    profileId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "One of the owner's named profiles to list under. Defaults to their default profile."
      ),
    publish: z
      .boolean()
      .optional()
      .describe(
        'Publish now (default true). Send false to save a draft; publishing a paid listing needs a paid Oriva plan.'
      ),
  })
);

registry.registerPath({
  method: 'post',
  path: '/api/agent/listings',
  operationId: 'createListing',
  tags: ['Agent'],
  servers: [ORIVA_APP_SERVER],
  summary: "List an item for sale in the marketplace in the owner's name",
  description:
    'Creates a marketplace listing as the API key owner, under the same content check as one made ' +
    'in the browser. Works only once the owner has switched agent listing on at ' +
    'https://oriva.io/settings/agent-buying (off by default); at most 20 agent listings an hour. ' +
    'Use when the owner asks you to sell something. Do not use to buy (use `buyListing`) or to ' +
    'edit an existing listing.\n\n' +
    '- 422: the content check refused it; `error` and `hint` say what to change before retrying.\n' +
    '- 403: listing switched off, a paid listing needs a paid plan (retry with `publish: false` ' +
    "to save a draft), or the profile is not the owner's. Do not retry unchanged.\n" +
    '- 429: over 20 listings an hour; wait before retrying.\n\n' +
    'Served by https://oriva.io, not api.oriva.io.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateListingBodySchema } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Listed (or saved as a draft when publish was false).',
      content: {
        'application/json': {
          schema: registry.register(
            'AgentListingCreated',
            z.object({
              listing: z.object({
                id: z.string().describe('The new listing (entry) id.'),
                title: z.string(),
                price: z.number(),
                currency: z.string(),
                published: z.boolean(),
              }),
            })
          ),
        },
      },
    },
    400: {
      description: 'Invalid input — the message names the field.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    401: {
      description: 'Missing or invalid personal access token.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    403: {
      description:
        "Agent listing switched off, paid listing on a free plan, no named profile, or a profile that is not the owner's.",
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    422: {
      description: 'Refused by the content check. Change what `hint` says and retry.',
      content: {
        'application/json': {
          schema: registry.register(
            'AgentListingContentRefused',
            z.object({ error: z.string(), hint: z.string().nullable() })
          ),
        },
      },
    },
    429: {
      description: 'More than 20 agent listings in the last hour. Try again later.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
  },
});
