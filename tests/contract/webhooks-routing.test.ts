/**
 * Webhook sub-path dispatch.
 *
 * `vercel.json` rewrites `/api/webhooks/:path*` into this single function. The
 * rewrite REPLACES the URL, so `req.url` inside the function is `/api/webhooks`
 * with the segment stripped. The dispatch used to match on `req.url` against
 * `/\/webhooks\/limohawk$/` and friends — which could never match — so EVERY
 * route in this function returned its own
 * `{"error":"Webhook endpoint not found"}` 404. Observed in production against
 * limohawk, twilio and stripe-limohawk alike.
 *
 * These tests drive the handler the way the platform does.
 */
import handler from '../../api/webhooks';

jest.mock('../../src/handlers/webhooks/twilio', () => ({
  handleTwilioWebhook: jest.fn(async (_q: unknown, r: any) => r.status(200).json({ h: 'twilio' })),
}));
jest.mock('../../src/handlers/webhooks/deepgram', () => ({
  handleDeepgramWebhook: jest.fn(async (_q: unknown, r: any) => r.status(200).json({ h: 'deepgram' })),
}));
jest.mock('../../src/handlers/webhooks/limohawk', () => ({
  handleLimohawkWebhook: jest.fn(async (_q: unknown, r: any) => r.status(200).json({ h: 'limohawk' })),
}));
jest.mock('../../src/handlers/webhooks/stripeLimohawk', () => ({
  handleStripeLimohawkWebhook: jest.fn(async (_q: unknown, r: any) => r.status(200).json({ h: 'stripe' })),
}));

function mockRes() {
  const state: { code?: number; body?: any } = {};
  const res: any = {
    status(c: number) { state.code = c; return res; },
    json(b: unknown) { state.body = b; return res; },
    state,
  };
  return res;
}

const call = async (req: Record<string, unknown>) => {
  const res = mockRes();
  await handler({ method: 'POST', query: {}, ...req } as never, res as never);
  return res.state;
};

describe('webhook sub-path dispatch', () => {
  it('routes on the rewritten shape — url stripped, segment in ?path', async () => {
    // This is what the platform actually delivers after the vercel.json rewrite.
    const s = await call({ url: '/api/webhooks', query: { path: 'limohawk' } });
    expect(s.body).toEqual({ h: 'limohawk' });
    expect(s.code).toBe(200);
  });

  it('routes each of the four webhooks by name', async () => {
    for (const [p, h] of [['twilio', 'twilio'], ['deepgram', 'deepgram'], ['limohawk', 'limohawk'], ['stripe-limohawk', 'stripe']]) {
      const s = await call({ url: '/api/webhooks', query: { path: p } });
      expect(s.body).toEqual({ h });
    }
  });

  it('accepts ?path as an array, which is how :path* can arrive', async () => {
    const s = await call({ url: '/api/webhooks', query: { path: ['limohawk'] } });
    expect(s.body).toEqual({ h: 'limohawk' });
  });

  it('still routes from the full url when there is no rewrite (local/direct invocation)', async () => {
    const s = await call({ url: '/api/webhooks/limohawk', query: {} });
    expect(s.body).toEqual({ h: 'limohawk' });
  });

  it('ignores a query string on the url when falling back', async () => {
    const s = await call({ url: '/api/webhooks/limohawk?foo=1', query: {} });
    expect(s.body).toEqual({ h: 'limohawk' });
  });

  it('404s an unknown webhook name', async () => {
    const s = await call({ url: '/api/webhooks', query: { path: 'nope' } });
    expect(s.code).toBe(404);
  });

  it('405s a non-POST', async () => {
    const s = await call({ method: 'GET', url: '/api/webhooks', query: { path: 'limohawk' } });
    expect(s.code).toBe(405);
  });
});
