/**
 * Contract tests for the SDK's agent-commerce methods (o-platform#76):
 * buyListing, listAgentPurchases, createListing.
 *
 * They are served by https://oriva.io (o-core), not api.oriva.io, so the
 * wrappers in src/agent.ts must send them there; buyListing must always carry
 * an Idempotency-Key and report it. fetch is injected per call; assertions are
 * on the Request the generated client actually builds.
 */
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createOrivaClient, makeAgentOperations } from '../src/index.js';

const API_KEY = 'oriva_pk_test_abcdef0123456789';
const LISTING_ID = '11111111-2222-4333-8444-555555555555';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function fetchReturning(status: number, body: unknown) {
  return jest.fn<typeof fetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
  );
}

async function requestOf(fetchMock: ReturnType<typeof fetchReturning>, i = 0) {
  const req = fetchMock.mock.calls[i]![0] as Request;
  const text = await req.clone().text();
  return {
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: text ? JSON.parse(text) : undefined,
  };
}

const savedEnv = process.env.ORIVA_APP_BASE_URL;
beforeEach(() => {
  delete process.env.ORIVA_APP_BASE_URL;
});
afterEach(() => {
  if (savedEnv === undefined) delete process.env.ORIVA_APP_BASE_URL;
  else process.env.ORIVA_APP_BASE_URL = savedEnv;
});

describe('createOrivaClient().buyListing', () => {
  it('POSTs to https://oriva.io/api/agent/purchases with auth, body and the given Idempotency-Key', async () => {
    const oriva = createOrivaClient({ apiKey: API_KEY });
    const fetchMock = fetchReturning(201, {
      purchase: {
        id: 'p1',
        orderId: 'o1',
        orderNumber: 'ORD-1',
        amountCents: 1200,
        currency: 'USD',
      },
    });
    const result = await oriva.buyListing({
      body: { listingId: LISTING_ID, expectedAmountCents: 1200, variantIndex: 0 },
      headers: { 'Idempotency-Key': 'order-42' },
      fetch: fetchMock,
    });

    const r = await requestOf(fetchMock);
    expect(r.url).toBe('https://oriva.io/api/agent/purchases');
    expect(r.method).toBe('POST');
    expect(r.headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(r.headers.get('idempotency-key')).toBe('order-42');
    expect(r.headers.get('content-type')).toBe('application/json');
    expect(r.body).toEqual({ listingId: LISTING_ID, expectedAmountCents: 1200, variantIndex: 0 });

    expect(result.response?.status).toBe(201);
    expect(result.data).toEqual({
      purchase: {
        id: 'p1',
        orderId: 'o1',
        orderNumber: 'ORD-1',
        amountCents: 1200,
        currency: 'USD',
      },
    });
    expect(result.idempotencyKey).toBe('order-42');
  });

  it('generates a fresh Idempotency-Key per call when none is given, and returns it', async () => {
    const oriva = createOrivaClient({ apiKey: API_KEY });
    const fetchMock = fetchReturning(201, { purchase: { id: 'p1' } });
    const a = await oriva.buyListing({
      body: { listingId: LISTING_ID, expectedAmountCents: 1200 },
      fetch: fetchMock,
    });
    const b = await oriva.buyListing({
      body: { listingId: LISTING_ID, expectedAmountCents: 1200 },
      fetch: fetchMock,
    });
    const keyA = (await requestOf(fetchMock, 0)).headers.get('idempotency-key');
    const keyB = (await requestOf(fetchMock, 1)).headers.get('idempotency-key');
    expect(keyA).toMatch(UUID_RE);
    expect(keyB).toMatch(UUID_RE);
    expect(keyA).not.toBe(keyB);
    expect(a.idempotencyKey).toBe(keyA);
    expect(b.idempotencyKey).toBe(keyB);
  });

  it('is not redirected by the api-host baseUrl; follows appBaseUrl and ORIVA_APP_BASE_URL', async () => {
    const fetchMock = fetchReturning(201, { purchase: { id: 'p1' } });
    const body = { listingId: LISTING_ID, expectedAmountCents: 1200 };

    await createOrivaClient({ apiKey: API_KEY, baseUrl: 'http://localhost:3002' }).buyListing({
      body,
      fetch: fetchMock,
    });
    await createOrivaClient({ apiKey: API_KEY, appBaseUrl: 'https://staging.oriva.io' }).buyListing(
      {
        body,
        fetch: fetchMock,
      }
    );
    process.env.ORIVA_APP_BASE_URL = 'http://localhost:8081';
    await createOrivaClient({ apiKey: API_KEY }).buyListing({ body, fetch: fetchMock });

    expect((await requestOf(fetchMock, 0)).url).toBe('https://oriva.io/api/agent/purchases');
    expect((await requestOf(fetchMock, 1)).url).toBe(
      'https://staging.oriva.io/api/agent/purchases'
    );
    expect((await requestOf(fetchMock, 2)).url).toBe('http://localhost:8081/api/agent/purchases');
  });

  // Every status the o-core route answers, and where it lands in the result.
  it.each([
    [
      200,
      { repeat: true, purchase: { id: 'p1', status: 'succeeded' }, message: 'Already done' },
      true,
    ],
    [
      202,
      { pending: true, purchase: { id: 'p1', orderId: 'o1' }, message: 'Still settling' },
      true,
    ],
    [400, { error: 'listingId must be a listing id.' }, false],
    [401, { error: 'Send your personal access token' }, false],
    [402, { error: 'Your card was declined.', purchaseId: 'p1' }, false],
    [403, { error: 'Over the daily limit.', refused: true, purchaseId: 'p1' }, false],
  ] as Array<[number, Record<string, unknown>, boolean]>)(
    'maps HTTP %i to data or error',
    async (status, body, ok) => {
      const oriva = createOrivaClient({ apiKey: API_KEY });
      const result = await oriva.buyListing({
        body: { listingId: LISTING_ID, expectedAmountCents: 1200 },
        fetch: fetchReturning(status, body),
      });
      expect(result.response?.status).toBe(status);
      if (ok) {
        expect(result.data).toEqual(body);
        expect(result.error).toBeUndefined();
      } else {
        expect(result.data).toBeUndefined();
        expect(result.error).toEqual(body);
      }
      expect(result.idempotencyKey).toMatch(UUID_RE);
    }
  );

  it('throws on a refusal when throwOnError is set, and the refusal body is the thrown value', async () => {
    const oriva = createOrivaClient({ apiKey: API_KEY });
    await expect(
      oriva.buyListing({
        body: { listingId: LISTING_ID, expectedAmountCents: 1200 },
        throwOnError: true,
        fetch: fetchReturning(403, {
          error: 'Agent buying is switched off.',
          refused: true,
          purchaseId: null,
        }),
      })
    ).rejects.toEqual({ error: 'Agent buying is switched off.', refused: true, purchaseId: null });
  });
});

describe('createOrivaClient().listAgentPurchases', () => {
  it('GETs https://oriva.io/api/agent/purchases with auth and no Idempotency-Key', async () => {
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
    const result = await createOrivaClient({ apiKey: API_KEY }).listAgentPurchases({
      fetch: fetchMock,
    });
    const r = await requestOf(fetchMock);
    expect(r.url).toBe('https://oriva.io/api/agent/purchases');
    expect(r.method).toBe('GET');
    expect(r.headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(r.headers.get('idempotency-key')).toBeNull();
    expect(r.body).toBeUndefined();
    expect(result.data).toEqual({ purchases });
  });

  it('maps 401 to error', async () => {
    const body = { error: 'That access token is not a valid, active personal token.' };
    const result = await createOrivaClient({ apiKey: API_KEY }).listAgentPurchases({
      fetch: fetchReturning(401, body),
    });
    expect(result.response?.status).toBe(401);
    expect(result.error).toEqual(body);
  });
});

describe('createOrivaClient().createListing', () => {
  const LISTING = {
    title: 'Notion template',
    description: 'A planning template.',
    price: 12,
    currency: 'USD' as const,
    itemType: 'digital' as const,
    publish: false,
  };

  it('POSTs to https://oriva.io/api/agent/listings with auth and the listing body', async () => {
    const created = {
      listing: { id: 'e1', title: LISTING.title, price: 12, currency: 'USD', published: false },
    };
    const fetchMock = fetchReturning(201, created);
    const result = await createOrivaClient({ apiKey: API_KEY }).createListing({
      body: LISTING,
      fetch: fetchMock,
    });
    const r = await requestOf(fetchMock);
    expect(r.url).toBe('https://oriva.io/api/agent/listings');
    expect(r.method).toBe('POST');
    expect(r.headers.get('authorization')).toBe(`Bearer ${API_KEY}`);
    expect(r.headers.get('idempotency-key')).toBeNull();
    expect(r.body).toEqual(LISTING);
    expect(result.response?.status).toBe(201);
    expect(result.data).toEqual(created);
  });

  it.each([
    [400, { error: 'title is required, up to 200 characters.' }],
    [401, { error: 'Send your personal access token' }],
    [403, { error: 'Agent listing is switched off for this account.' }],
    [422, { error: 'The listing failed the content check.', hint: 'Remove the phone number.' }],
    [429, { error: 'At most 20 agent listings an hour; try again later.' }],
  ] as Array<[number, Record<string, unknown>]>)(
    'maps HTTP %i to error with every field',
    async (status, body) => {
      const result = await createOrivaClient({ apiKey: API_KEY }).createListing({
        body: LISTING,
        fetch: fetchReturning(status, body),
      });
      expect(result.response?.status).toBe(status);
      expect(result.error).toEqual(body);
    }
  );
});

describe('makeAgentOperations (raw client use)', () => {
  it('binds to the given app base URL', async () => {
    const fetchMock = fetchReturning(200, { purchases: [] });
    await makeAgentOperations('https://example.test').listAgentPurchases({ fetch: fetchMock });
    expect((await requestOf(fetchMock)).url).toBe('https://example.test/api/agent/purchases');
  });
});
