/**
 * The webhooks function must LOAD without optional third-party credentials.
 *
 * `api/webhooks.ts` imports the Twilio, Deepgram, LimoHawk-loyalty and
 * Stripe-LimoHawk handlers into ONE serverless function. Any module-scope
 * client construction therefore takes all four routes down together if its key
 * is unset — and it fails at IMPORT, so every route returns
 * FUNCTION_INVOCATION_FAILED before a single line of handler code runs.
 *
 * That is exactly what happened in production: `new Stripe(undefined)` threw
 * "Neither apiKey nor config.authenticator provided" at
 * stripeLimohawk.ts module scope, and POST /api/webhooks/limohawk returned 500
 * to every caller — indistinguishable from a fault in the loyalty handler,
 * which was in fact fine.
 *
 * These tests fail if anyone reintroduces a module-scope client. A route that
 * is not configured must fail when CALLED, never when imported.
 */

const STRIPE_KEYS = [
  'LIMOHAWK_STRIPE_SECRET_KEY',
  'LIMOHAWK_STRIPE_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
];

describe('webhook handlers load without optional credentials', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of STRIPE_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of STRIPE_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('the Stripe-LimoHawk handler imports with no Stripe key set', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../src/handlers/webhooks/stripeLimohawk');
    }).not.toThrow();
  });

  it('exports its handler as a function after that import', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('../../src/handlers/webhooks/stripeLimohawk');
    expect(typeof mod.handleStripeLimohawkWebhook).toBe('function');
  });

  it('the LimoHawk loyalty handler imports independently of Stripe config', () => {
    // The loyalty route shares a function with the Stripe one; its availability
    // must not depend on a payment provider LimoHawk does not even use.
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('../../src/handlers/webhooks/limohawk');
    }).not.toThrow();
  });
});
