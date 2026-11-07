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
    listingId: z.string().guid().describe('The marketplace listing (entry) id to buy.'),
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

/**
 * The marketplace's own topics, in the order oriva.io lists them. Must equal
 * `MARKETPLACE_TOPIC_IDS` in o-core `packages/shared/types/marketplace/topics.ts`, which the
 * listing route and the database check against (o-core#1825; oriva-platform#78).
 */
export const MARKETPLACE_TOPIC_IDS = [
  'topic-parent-productivity',
  'topic-parent-business',
  'topic-parent-social',
  'topic-parent-health',
  'topic-parent-money',
  'topic-parent-lifestyle',
  'topic-parent-humanity',
  'topic-social-relationships',
  'topic-social-communication',
  'topic-health-nutrition',
  'topic-health-exercise',
  'topic-health-longevity',
  'topic-health-skincare',
  'topic-money-investment',
  'topic-money-savings',
  'topic-money-crypto',
  'topic-lifestyle-travel',
  'topic-lifestyle-gadgets',
  'topic-lifestyle-parenting',
  'topic-lifestyle-home',
  'topic-lifestyle-entertainment',
  'topic-lifestyle-technology',
  'topic-humanity-history',
  'topic-humanity-futurism',
  'topic-humanity-personal-growth',
] as const;

// ── Sales page (o-core#1911) ─────────────────────────────────────────────────

/**
 * The offer's sales page, as the listing routes take it in `salesSections` and `salesTheme`. Mirrors
 * o-core `packages/shared/services/marketplace/salesPage.ts` (`validateSalesPage`, `SALES_LIMITS`,
 * `SALES_ACCENTS`, the section types); the route checks every page with that code and answers 400 with
 * `problems` when it fails, so keep the two in step. Formats the route checks (image hosts, link shapes)
 * are stated in the descriptions rather than as patterns, so this description never refuses a page the
 * route would take.
 */
export const SALES_DEFAULT_SECTION_TYPES = [
  'hero',
  'buy_box',
  'problem',
  'general_solution',
  'specific_solution',
  'how_it_works',
  'what_you_get',
  'proof',
  'questions',
  'guarantee',
  'creator',
] as const;

export const SALES_LIBRARY_SECTION_TYPES = [
  'module_showcase',
  'preview_gallery',
  'demonstration',
  'look_inside',
  'annotated_screenshot',
  'icon_row',
  'multicolumn',
  'image_with_text',
  'rich_text',
  'comparison_table',
  'video',
  'testimonials',
  'collapsible_questions',
  'related_offers',
  'order_box',
  'whole_path',
  'what_this_is_not',
  'card_grid',
  'creator_quote',
  'final_cta',
  'calculator',
] as const;

/** The accents a seller may pick (o-core `SALES_ACCENTS`); each is checked for contrast on both grounds. */
export const SALES_ACCENTS = [
  '#4B58D6',
  '#6E7BFF',
  '#F26B1F',
  '#C2410C',
  '#21703F',
  '#0B0B0B',
] as const;

const SalesImageSchema = registry.register(
  'SalesImage',
  z.object({
    url: z
      .string()
      .max(600)
      .describe('An https address on cdn.oriva.io (images must be uploaded to Oriva first).'),
    alt: z
      .string()
      .max(200)
      .optional()
      .describe(
        'What the image shows, for screen readers and search. A published page refuses a shown image without one, unless `decorative`.'
      ),
    decorative: z
      .boolean()
      .optional()
      .describe('True for a purely decorative image, which needs no `alt`.'),
  })
);

const SalesAreasSchema = z.object({
  areas: z
    .array(z.string().max(40))
    .min(3)
    .max(12)
    .describe('3 to 12 named areas, each up to 40 characters.'),
  weakest: z.number().int().min(0).describe('Index into `areas` of the weakest one.'),
});

const SalesItemSchema = registry.register(
  'SalesItem',
  z.object({
    title: z.string().max(160).optional(),
    text: z
      .string()
      .max(1200)
      .optional()
      .describe('Plain text; a blank line starts a new paragraph.'),
    note: z
      .string()
      .max(160)
      .optional()
      .describe('A short second value: a price, a time, or the other column of a comparison.'),
    points: z
      .array(z.string().max(240))
      .max(8)
      .optional()
      .describe('Bullet points under the item, one line each (What you get).'),
    href: z
      .string()
      .optional()
      .describe(
        'A link to another Oriva offer only: `/item/<id>`, `/checkout/<id>`, or the same on https://oriva.io.'
      ),
    image: SalesImageSchema.optional(),
    imageSize: z
      .enum(['wide'])
      .optional()
      .describe('"wide": the image spans the item; otherwise it sits beside the text.'),
    survey: SalesAreasSchema.optional().describe(
      'An animated self-assessment that sorts the areas by score (What you get).'
    ),
    fan: z
      .array(z.string().max(40))
      .min(3)
      .max(9)
      .optional()
      .describe('3 to 9 card names fanned out at the top of the item (What you get).'),
    preview: z
      .object({
        text: z.string().max(8000),
        contents: z
          .array(z.string().max(100))
          .max(40)
          .optional()
          .describe('Headings inside, shown as a short contents list.'),
      })
      .optional()
      .describe('A "Preview" button that opens an excerpt (What you get).'),
    x: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe('Callout position across, in percent (annotated screenshot).'),
    y: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe('Callout position down, in percent (annotated screenshot).'),
  })
);

const SalesCalculatorSchema = registry.register(
  'SalesCalculator',
  z
    .object({
      sliders: z
        .array(
          z.object({
            id: z
              .string()
              .max(12)
              .describe(
                'Unique short name: starts with a letter, lowercase letters and digits only, up to 12.'
              ),
            label: z.string().max(160).describe('The question.'),
            help: z.string().max(300).optional(),
            min: z.number().min(0).max(100),
            max: z.number().min(0).max(100),
            step: z.number(),
            start: z.number().describe('Where the slider starts, inside the range.'),
          })
        )
        .max(3)
        .describe('Up to 3 sliders, each a percentage from 0 to 100.'),
      incomeLabel: z
        .string()
        .max(160)
        .optional()
        .describe('Label of the income box; leave out for no income box.'),
      note: z.string().max(160).optional().describe('One line under the buy button.'),
      daysPerYear: z
        .number()
        .int()
        .min(1)
        .max(366)
        .describe('Working days in a year, for `{<id>_days}`.'),
      results: z
        .array(
          z.object({
            label: z.string().max(160),
            sentence: z
              .string()
              .max(400)
              .describe('May name `{<id>}` and `{<id>_days}` for any slider id.'),
            withIncome: z
              .string()
              .max(400)
              .optional()
              .describe(
                'Used once the visitor enters an income; may also name `{<id>_money}`. Needs `incomeLabel`.'
              ),
          })
        )
        .max(4)
        .describe('Up to 4 result lines.'),
    })
    .describe("The cost calculator section, worked out in the visitor's browser and never stored.")
);

const SalesContentSchema = registry.register(
  'SalesSectionContent',
  z
    .object({
      eyebrow: z.string().max(60).optional(),
      heading: z.string().max(160).optional(),
      body: z
        .string()
        .max(6000)
        .optional()
        .describe('Plain text, never HTML; a blank line starts a new paragraph.'),
      quote: z.string().max(600).optional(),
      image: SalesImageSchema.optional(),
      videoUrl: z
        .string()
        .max(600)
        .optional()
        .describe('An https video on cdn.oriva.io, YouTube or Vimeo.'),
      labels: z
        .array(z.string().max(60))
        .max(3)
        .optional()
        .describe('Column headings, for the comparison table.'),
      items: z.array(SalesItemSchema).max(30).optional(),
      // No .describe() here: on a registered schema it emits allOf, which the MCP server's resolver does not open.
      calculator: SalesCalculatorSchema.optional(),
      oneRow: z.boolean().optional().describe('Proof quote cards in one sideways-scrolling row.'),
      buyNote: z
        .string()
        .max(160)
        .optional()
        .describe("One short line under the hero's buy button."),
      calendar: z
        .object({ description: z.string().max(600), hours: z.number().min(0.5).max(12) })
        .optional()
        .describe('"Add to calendar" under the next live session (hero).'),
      videoCard: z
        .object({ url: z.string().describe('A YouTube link.'), caption: z.string().max(200) })
        .optional()
        .describe('A video card that opens the video in a window.'),
      giveaway: z
        .object({
          heading: z.string(),
          text: z.string(),
          total: z.number().int().min(1).max(1000).describe('How many places there are.'),
          since: z
            .string()
            .optional()
            .describe('Count paid orders from this moment (ISO 8601); all of them when absent.'),
          href: z.string().optional().describe('The full-price offer, on Oriva.'),
          linkLabel: z.string().optional(),
          leftNote: z.string().optional().describe('Words after the number of places left.'),
        })
        .optional()
        .describe(
          'A giveaway for the first buyers (What you get); the page shows how many are left.'
        ),
      packageValue: z
        .number()
        .gt(0)
        .max(1000000)
        .optional()
        .describe(
          'What everything in the offer costs bought separately (hero); each buy button then shows the saving.'
        ),
      wheel: SalesAreasSchema.optional().describe(
        'A wheel that spins and stops on the weakest area (problem).'
      ),
    })
    .describe(
      'The same fields serve every section type; each type draws the ones that suit it. In outline: the hero uses ' +
        'eyebrow, heading, body, image or videoUrl, buyNote, calendar, packageValue; problem uses heading, body, ' +
        'quote, wheel; how_it_works, what_you_get, proof, questions and most library components use heading plus ' +
        'items (what_you_get items may carry points, fan, preview, survey, image; proof uses quote cards and oneRow); ' +
        'comparison_table uses labels and items with note as the other column; annotated_screenshot uses image plus ' +
        'items with x and y; video uses videoUrl; calculator uses calculator; related_offers uses items with href.'
    )
);

export const SalesSectionSchema = registry.register(
  'SalesSection',
  z.object({
    id: z
      .string()
      .min(1)
      .max(40)
      .describe(
        'Your own id for the section, unique on the page: letters, digits, _ or -, up to 40.'
      ),
    type: z
      .enum([...SALES_DEFAULT_SECTION_TYPES, ...SALES_LIBRARY_SECTION_TYPES])
      .describe(
        `The kind of section. The page's own sections (${SALES_DEFAULT_SECTION_TYPES.join(', ')}) may each appear ` +
          `once; the library components (${SALES_LIBRARY_SECTION_TYPES.join(', ')}) as often as wanted. ` +
          'A page sells only through a shown checkout hero (design "a"), buy_box, order_box or final_cta.'
      ),
    design: z
      .enum(['a', 'b'])
      .optional()
      .describe(
        "The page's own sections have two designs (default a); for hero, a has the checkout and b an image or video. " +
          'Library components have one.'
      ),
    hidden: z.boolean().optional().describe('Keep the section but do not show it.'),
    content: SalesContentSchema,
  })
);

export const SalesSectionsSchema = z
  .array(SalesSectionSchema)
  .max(40)
  .describe(
    "The offer's sales page, top to bottom, up to 40 sections: the same page the offer form builds. Checked by the " +
      "offer form's rules (400 with `problems`). A published listing's page must also be able to go live: a way to " +
      'buy, no [placeholder] text, and every shown image described (422 with `problems`).'
  );

export const SalesThemeSchema = registry.register(
  'SalesTheme',
  z
    .object({
      ground: z.enum(['white', 'black']).optional().describe('The background. Defaults to white.'),
      accent: z
        .enum(SALES_ACCENTS)
        .optional()
        .describe('One of the offered accent colours. Defaults to #4B58D6.'),
      typeface: z.enum(['archivo', 'manrope']).optional().describe('Defaults to archivo.'),
    })
    .describe(
      'How the sales page looks. Sent alone on updateListing, it restyles the page the listing already has.'
    )
);

const SeoTitleSchema = z
  .string()
  .max(60)
  .nullable()
  .optional()
  .describe(
    'How the offer is titled in search results, link previews and the browser tab, up to 60 characters. ' +
      'Null or empty uses the automatic title.'
  );

const SeoDescriptionSchema = z
  .string()
  .max(160)
  .nullable()
  .optional()
  .describe(
    'The line under the title in search results and link previews, up to 160 characters. Null or empty uses the automatic text.'
  );

/**
 * Why a listing cannot be saved or go live (422). Keeps the name the SDK has exported since 0.5.0;
 * `problems` arrived with sales pages (o-core#1911).
 */
const AgentListingRefusedSchema = registry.register(
  'AgentListingContentRefused',
  z.object({
    error: z.string().describe('Why, in plain words.'),
    hint: z
      .string()
      .nullable()
      .optional()
      .describe('What to change, when the content check refused it.'),
    problems: z
      .array(z.string())
      .optional()
      .describe('Every reason the sales page cannot go live yet, when that is the refusal.'),
  })
);

/** A refusal that lists every problem found, so the agent can fix them all before retrying. */
const AgentProblemsSchema = registry.register(
  'AgentProblems',
  z.object({
    error: z.string().describe('What went wrong, in plain words.'),
    problems: z
      .array(z.string())
      .optional()
      .describe(
        'Each problem found, when there are several (the sales page, the add-on or the sales chat).'
      ),
    hint: z
      .string()
      .nullable()
      .optional()
      .describe('What to change, when the content check refused it.'),
  })
);

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
    topics: z
      .array(z.enum(MARKETPLACE_TOPIC_IDS))
      .max(4)
      .optional()
      .describe(
        "Up to 4 of the marketplace's topics the listing is filed under, so buyers find it under " +
          'that topic. Publishing needs at least one; a draft may have none. A subtopic id ' +
          '(topic-health-nutrition) is best sent with its parent (topic-parent-health).'
      ),
    profileId: z
      .string()
      .guid()
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
    salesSections: SalesSectionsSchema.optional(),
    salesTheme: SalesThemeSchema.optional(),
    seoTitle: SeoTitleSchema,
    seoDescription: SeoDescriptionSchema,
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
    "change an existing listing (use `updateListing`). Choose `topics` from the marketplace's own list " +
    '(see the field); publishing needs at least one.\n\n' +
    'Send `salesSections` (and optionally `salesTheme`) to give the offer its sales page, the same page ' +
    'the offer form builds; `seoTitle` and `seoDescription` set how it reads in search results.\n\n' +
    '- 400: a field is out of range (for `topics`, the error lists the topics to choose from), or the ' +
    'sales page failed the check; `problems` lists every fault, fix them all before retrying.\n' +
    '- 422: the content check refused it (`hint` says what to change); the sales page cannot go live ' +
    'yet (`problems`: no way to buy, [placeholder] text, an image without a description; or save a ' +
    'draft); or a free listing has nothing for a visitor to get, since this route sets no delivery.\n' +
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
      description:
        'Invalid input — the message names the field; for a sales page, `problems` lists every fault.',
      content: { 'application/json': { schema: AgentProblemsSchema } },
    },
    401: {
      description: 'Missing or invalid personal access token.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    403: {
      description:
        "Agent listing switched off, this token may not list, paid listing on a free plan, no named profile, or a profile that is not the owner's.",
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    422: {
      description:
        'Refused by the content check (change what `hint` says), a sales page that cannot go live yet (`problems`), ' +
        'or a free listing with nothing to get.',
      content: { 'application/json': { schema: AgentListingRefusedSchema } },
    },
    429: {
      description: 'More than 20 agent listings in the last hour. Try again later.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
  },
});

// ── Change a listing (o-core#1911) ────────────────────────────────────────────

export const UpdateListingParamsSchema = z.object({
  id: z
    .string()
    .guid()
    .describe(
      "The listing (entry) id, as createListing returned it. Only the owner's own listings."
    ),
});

export const UpdateListingBodySchema = registry.register(
  'UpdateListingBody',
  z
    .object({
      title: z
        .string()
        .min(1)
        .max(200)
        .optional()
        .describe('Up to 200 characters; cannot be empty.'),
      description: z
        .string()
        .max(20000)
        .optional()
        .describe('Up to 20,000 characters. Runs through the content check.'),
      price: z
        .number()
        .min(0)
        .max(10000)
        .optional()
        .describe(
          'Price in currency units, 0 to 10000; a paid listing is at least 1. Refused (409) for a listing with ' +
            'price options, which are changed in the offer form.'
        ),
      currency: z.enum(['USD']).optional().describe('Only USD is supported.'),
      itemType: z.enum(['digital', 'physical', 'service', 'course', 'app', 'event']).optional(),
      topics: z
        .array(z.enum(MARKETPLACE_TOPIC_IDS))
        .max(4)
        .optional()
        .describe(
          "Replaces the listing's topics: up to 4 of the marketplace's own. A published listing needs at least one."
        ),
      publish: z
        .boolean()
        .optional()
        .describe(
          'True publishes the listing, false takes it back to a draft. Leave out to keep it as it is.'
        ),
      salesSections: SalesSectionsSchema.nullable()
        .optional()
        .describe(
          'Replaces the whole sales page, top to bottom (the same shape as on createListing). Null removes the page. ' +
            'Checked as on createListing: 400 with `problems` when it fails, 422 with `problems` when the listing is ' +
            'or goes live and the page cannot.'
        ),
      // Sent alone it restyles the page the listing already has (said in the operation's description;
      // a .describe() here would emit allOf, which the MCP server's resolver does not open).
      salesTheme: SalesThemeSchema.optional(),
      addOn: z
        .object({
          name: z.string().max(80),
          description: z
            .string()
            .max(200)
            .optional()
            .describe('One line under the tick box at checkout.'),
          price: z.number().min(1).max(10000).describe("In the offer's currency."),
          kind: z.enum(['physical', 'digital']),
          shipTo: z
            .array(z.string().length(2))
            .max(50)
            .optional()
            .describe('Two-letter country codes (US, GB); at least one for a physical add-on.'),
        })
        .nullable()
        .optional()
        .describe(
          'An extra the buyer can tick at checkout. Null removes it. 400 with `problems` when it fails the check.'
        ),
      salesChat: z
        .object({
          enabled: z.boolean(),
          notes: z
            .string()
            .max(4000)
            .optional()
            .describe('What the sales assistant may tell visitors beyond the page.'),
          contactUrl: z
            .string()
            .max(300)
            .optional()
            .describe(
              'Where a visitor reaches the seller when the assistant cannot answer: an https:// link or a mailto: address.'
            ),
        })
        .nullable()
        .optional()
        .describe(
          "The sales page's chat assistant. Null removes its settings. 400 with `problems` when it fails the check."
        ),
      seoTitle: SeoTitleSchema,
      seoDescription: SeoDescriptionSchema,
    })
    .describe('Send only what changes; at least one field.')
);

registry.registerPath({
  method: 'patch',
  path: '/api/agent/listings/{id}',
  operationId: 'updateListing',
  tags: ['Agent'],
  servers: [ORIVA_APP_SERVER],
  summary:
    "Change a listing in the owner's name: its text, price, sales page, or whether it is live",
  description:
    "Changes one of the API key owner's own listings, as an edit in the offer form would, under the same " +
    'content check. Send only the fields that change. Needs agent listing switched on at ' +
    'https://oriva.io/settings/agent-buying; creating and changing listings share 60 actions an hour. ' +
    'Use when the owner asks you to revise a listing or its sales page, publish a draft, or take a listing ' +
    'down. Do not use to create one (use `createListing`).\n\n' +
    'The rules for a live listing apply to the RESULT: publishing needs a topic and, for a paid listing, a ' +
    'paid Oriva plan; its sales page must have a way to buy, no [placeholder] text, and every shown image ' +
    'described; and it must be something a visitor can get (paid, or free with a delivery the seller set). ' +
    'A sales page you write is marked as written by an agent, and the offer form tells the seller so.\n\n' +
    '- 400: a field is wrong, nothing was sent, or the sales page, add-on or sales chat failed its check; ' +
    '`problems` lists every fault.\n' +
    "- 404: no listing of the owner's has that id (the same answer for someone else's).\n" +
    '- 409: the listing has price options; change its prices in the offer form.\n' +
    '- 422: the content check refused it (`hint`), the sales page cannot go live (`problems`; or keep it a ' +
    'draft with `publish: false`), or a free listing has nothing to get.\n' +
    '- 403: listing switched off, this token may not list, or a paid listing on a free plan. Do not retry unchanged.\n' +
    '- 429: over 60 listing actions an hour; wait before retrying.\n\n' +
    'Served by https://oriva.io, not api.oriva.io.',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: UpdateListingParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateListingBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Changed. The listing as it now stands.',
      content: {
        'application/json': {
          schema: registry.register(
            'AgentListingUpdated',
            z.object({
              listing: z.object({
                id: z.string(),
                title: z.string(),
                price: z.number(),
                currency: z.string(),
                published: z.boolean(),
                salesPage: z.boolean().describe('Whether the listing now has a sales page.'),
              }),
            })
          ),
        },
      },
    },
    400: {
      description: 'Invalid input or a failed check; `problems` lists every fault.',
      content: { 'application/json': { schema: AgentProblemsSchema } },
    },
    401: {
      description: 'Missing or invalid personal access token.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    403: {
      description:
        'Agent listing switched off, this token may not list, or a paid listing on a free plan.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    404: {
      description: "No listing of the owner's has that id.",
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    409: {
      description: 'The listing has price options, which are changed in the offer form.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
    422: {
      description:
        'Refused by the content check, a sales page that cannot go live yet, or a free listing with nothing to get.',
      content: { 'application/json': { schema: AgentListingRefusedSchema } },
    },
    429: {
      description: 'More than 60 agent listing actions in the last hour. Try again later.',
      content: { 'application/json': { schema: AgentErrorSchema } },
    },
  },
});
