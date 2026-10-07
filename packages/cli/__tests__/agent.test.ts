/**
 * @jest-environment node
 *
 * Contract tests for the agent-commerce commands (o-platform#76):
 * buyListing, listAgentPurchases, createListing.
 *
 * These run against the REAL bundled snapshot (packages/cli/openapi-snapshot.json,
 * copied from claudedocs/ by the jest global setup), so they fail if the spec
 * stops describing the o-core routes at https://oriva.io the way these
 * assertions expect. fetch is mocked; every assertion is on the request the
 * CLI actually builds and on how each documented status reaches the caller.
 */
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { Writable } from 'node:stream';
import { run } from '../src/cli.js';

const API_KEY = 'oriva_pk_test_abcdef0123456789';
const LISTING_ID = '11111111-2222-4333-8444-555555555555';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { stream, text: () => chunks.join('') };
}

function fetchReturning(status: number, body: unknown) {
  return jest.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
  );
}

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function callOf(fetchMock: ReturnType<typeof fetchReturning>, i = 0): Call {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
  return {
    url,
    method: String(init.method),
    headers: init.headers as Record<string, string>,
    body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

async function runCli(argv: string[], fetchMock: typeof fetch, env: NodeJS.ProcessEnv = {}) {
  const stdout = makeStream();
  const stderr = makeStream();
  const code = await run({
    argv: [...argv, `--api-key=${API_KEY}`],
    env,
    stdout: stdout.stream,
    stderr: stderr.stream,
    fetchImpl: fetchMock,
    configPath: '/nonexistent/oriva-config.json',
  });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
}

const BUY_BODY = JSON.stringify({ listingId: LISTING_ID, expectedAmountCents: 1200 });

describe('buyListing', () => {
  it('POSTs to https://oriva.io/api/agent/purchases with auth, body and the given Idempotency-Key', async () => {
    const fetchMock = fetchReturning(201, {
      purchase: {
        id: 'p1',
        orderId: 'o1',
        orderNumber: 'ORD-1',
        amountCents: 1200,
        currency: 'USD',
      },
    });
    const r = await runCli(
      ['buyListing', `--body=${BUY_BODY}`, '--idempotencyKey=order-42', '--json'],
      fetchMock
    );
    expect(r.code).toBe(0);
    const c = callOf(fetchMock);
    expect(c.url).toBe('https://oriva.io/api/agent/purchases');
    expect(c.method).toBe('POST');
    expect(c.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(c.headers['Idempotency-Key']).toBe('order-42');
    expect(c.headers['Content-Type']).toBe('application/json');
    expect(c.body).toEqual({ listingId: LISTING_ID, expectedAmountCents: 1200 });

    const env = JSON.parse(r.stdout);
    expect(env.ok).toBe(true);
    expect(env.status).toBe(201);
    expect(env.data.purchase.orderId).toBe('o1');
    expect(env.idempotency_key).toBe('order-42');
  });

  it('sends variantIndex in the body when given', async () => {
    const fetchMock = fetchReturning(201, { purchase: { id: 'p1' } });
    await runCli(
      [
        'buyListing',
        `--body=${JSON.stringify({ listingId: LISTING_ID, expectedAmountCents: 900, variantIndex: 2 })}`,
      ],
      fetchMock
    );
    expect(callOf(fetchMock).body).toEqual({
      listingId: LISTING_ID,
      expectedAmountCents: 900,
      variantIndex: 2,
    });
  });

  it('generates a fresh Idempotency-Key per call when none is given, and reports it', async () => {
    const fetchMock = fetchReturning(201, { purchase: { id: 'p1' } });
    const a = await runCli(['buyListing', `--body=${BUY_BODY}`, '--json'], fetchMock);
    const b = await runCli(['buyListing', `--body=${BUY_BODY}`], fetchMock);

    const keyA = callOf(fetchMock, 0).headers['Idempotency-Key'];
    const keyB = callOf(fetchMock, 1).headers['Idempotency-Key'];
    expect(keyA).toMatch(UUID_RE);
    expect(keyB).toMatch(UUID_RE);
    expect(keyA).not.toBe(keyB);
    expect(JSON.parse(a.stdout).idempotency_key).toBe(keyA);
    // Non-JSON mode reports the key on stderr so a human can retry with it.
    expect(b.stderr).toContain(`Idempotency-Key: ${keyB}`);
  });

  it('is NOT redirected by the api-host overrides (--base-url, ORIVA_API_BASE_URL)', async () => {
    const fetchMock = fetchReturning(201, { purchase: { id: 'p1' } });
    await runCli(
      ['buyListing', `--body=${BUY_BODY}`, '--base-url=http://localhost:3002'],
      fetchMock,
      {
        ORIVA_API_BASE_URL: 'http://localhost:3002',
      }
    );
    expect(callOf(fetchMock).url).toBe('https://oriva.io/api/agent/purchases');
  });

  it('follows ORIVA_APP_BASE_URL and --app-base-url (flag wins)', async () => {
    const fetchMock = fetchReturning(201, { purchase: { id: 'p1' } });
    await runCli(['buyListing', `--body=${BUY_BODY}`], fetchMock, {
      ORIVA_APP_BASE_URL: 'http://localhost:8081',
    });
    await runCli(
      ['buyListing', `--body=${BUY_BODY}`, '--app-base-url=https://staging.oriva.io'],
      fetchMock,
      { ORIVA_APP_BASE_URL: 'http://localhost:8081' }
    );
    expect(callOf(fetchMock, 0).url).toBe('http://localhost:8081/api/agent/purchases');
    expect(callOf(fetchMock, 1).url).toBe('https://staging.oriva.io/api/agent/purchases');
  });

  it('refuses to run without a body (exit 3, no request)', async () => {
    const fetchMock = fetchReturning(201, {});
    const r = await runCli(['buyListing'], fetchMock);
    expect(r.code).toBe(3);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Every status the o-core route can answer, and what the caller sees.
  it.each([
    [
      200,
      { repeat: true, purchase: { id: 'p1', status: 'succeeded' }, message: 'Already done' },
      0,
      true,
    ],
    [
      202,
      { pending: true, purchase: { id: 'p1', orderId: 'o1' }, message: 'Still settling' },
      0,
      true,
    ],
    [400, { error: 'listingId must be a listing id.' }, 1, false],
    [401, { error: 'Send your personal access token' }, 1, false],
    [402, { error: 'Your card was declined.', purchaseId: 'p1' }, 1, false],
    [403, { error: 'Over the daily limit.', refused: true, purchaseId: 'p1' }, 1, false],
  ] as Array<[number, Record<string, unknown>, number, boolean]>)(
    'maps HTTP %i to the envelope and exit code',
    async (status, body, exit, ok) => {
      const fetchMock = fetchReturning(status, body);
      const r = await runCli(['buyListing', `--body=${BUY_BODY}`, '--json'], fetchMock);
      expect(r.code).toBe(exit);
      const env = JSON.parse(r.stdout);
      expect(env.status).toBe(status);
      expect(env.ok).toBe(ok);
      if (ok) {
        expect(env.data).toEqual(body);
        expect(env.error).toBeNull();
      } else {
        const { error, ...rest } = body as { error: string } & Record<string, unknown>;
        expect(env.error).toBe(error);
        // `refused: true` and `purchaseId` must survive — they decide whether to retry.
        if (Object.keys(rest).length) expect(env.details).toEqual(rest);
        else expect(env.details).toBeUndefined();
      }
    }
  );
});

describe('listAgentPurchases', () => {
  it('GETs https://oriva.io/api/agent/purchases with auth and no body or Idempotency-Key', async () => {
    const purchases = [
      {
        id: 'p1',
        entry_id: LISTING_ID,
        listing_title: 'Guide',
        order_id: 'o1',
        amount_cents: 1200,
        currency: 'USD',
        status: 'succeeded',
        reason: null,
        created_at: '2026-10-07T12:00:00Z',
      },
    ];
    const fetchMock = fetchReturning(200, { purchases });
    const r = await runCli(['listAgentPurchases', '--json'], fetchMock);
    expect(r.code).toBe(0);
    const c = callOf(fetchMock);
    expect(c.url).toBe('https://oriva.io/api/agent/purchases');
    expect(c.method).toBe('GET');
    expect(c.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(c.headers['Idempotency-Key']).toBeUndefined();
    expect(c.body).toBeUndefined();
    expect(JSON.parse(r.stdout).data).toEqual({ purchases });
  });

  it('maps 401 to exit 1', async () => {
    const fetchMock = fetchReturning(401, {
      error: 'That access token is not a valid, active personal token.',
    });
    const r = await runCli(['listAgentPurchases', '--json'], fetchMock);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.stdout).error).toMatch(/access token/);
  });
});

describe('createListing', () => {
  const LISTING = {
    title: 'Notion template',
    description: 'A planning template.',
    price: 12,
    currency: 'USD',
    itemType: 'digital',
    publish: false,
  };

  it('POSTs the listing to https://oriva.io/api/agent/listings with auth and no Idempotency-Key', async () => {
    const fetchMock = fetchReturning(201, {
      listing: { id: 'e1', title: LISTING.title, price: 12, currency: 'USD', published: false },
    });
    const r = await runCli(
      ['createListing', `--body=${JSON.stringify(LISTING)}`, '--json'],
      fetchMock
    );
    expect(r.code).toBe(0);
    const c = callOf(fetchMock);
    expect(c.url).toBe('https://oriva.io/api/agent/listings');
    expect(c.method).toBe('POST');
    expect(c.headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(c.headers['Idempotency-Key']).toBeUndefined();
    expect(c.body).toEqual(LISTING);
    expect(JSON.parse(r.stdout).data.listing.id).toBe('e1');
  });

  it.each([
    [400, { error: 'title is required, up to 200 characters.' }],
    [401, { error: 'Send your personal access token' }],
    [403, { error: 'Agent listing is switched off for this account.' }],
    [422, { error: 'The listing failed the content check.', hint: 'Remove the phone number.' }],
    [429, { error: 'At most 20 agent listings an hour; try again later.' }],
  ] as Array<[number, { error: string; hint?: string }]>)(
    'maps HTTP %i to exit 1 and keeps every field',
    async (status, body) => {
      const fetchMock = fetchReturning(status, body);
      const r = await runCli(
        ['createListing', `--body=${JSON.stringify(LISTING)}`, '--json'],
        fetchMock
      );
      expect(r.code).toBe(1);
      const env = JSON.parse(r.stdout);
      expect(env.status).toBe(status);
      expect(env.error).toBe(body.error);
      if ('hint' in body) expect(env.details).toEqual({ hint: body.hint });
    }
  );
});

describe('agent commands in help', () => {
  it('shows the web-app host and the idempotencyKey flag in buyListing help', async () => {
    const r = await runCli(['buyListing', '--help'], fetchReturning(200, {}));
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('POST /api/agent/purchases');
    expect(r.stdout).toContain('served by: https://oriva.io');
    expect(r.stdout).toContain('--idempotencyKey');
  });
});

beforeEach(() => {
  jest.restoreAllMocks();
});
