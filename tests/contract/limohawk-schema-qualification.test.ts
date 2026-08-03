/**
 * LimoHawk PostgREST schema-qualification contract.
 *
 * The `limohawk` tables and functions live in their own Postgres schema. PostgREST
 * selects a schema with a HEADER (`Accept-Profile` on reads, `Content-Profile` on
 * writes/RPC) — it never parses a dot in the URL path as a schema separator. So
 * `.rpc('limohawk.award_points')` posts to /rest/v1/rpc/limohawk.award_points, which
 * PostgREST resolves as `public.limohawk.award_points` and 404s with PGRST202. Every
 * booking webhook therefore awarded zero points, and every refund deducted none.
 *
 * The working form is to build the client with `{ db: { schema: 'limohawk' } }` and
 * reference tables and functions unqualified.
 *
 * These tests assert the RESOLVED REQUEST that supabase-js emits. A mock of
 * `supabase.rpc` would pass against either form and prove nothing, so we stub
 * `globalThis.fetch` and let the real client build the URL and headers.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://test-project.supabase.co';
const WEBHOOK_SECRET = 'test-webhook-secret';

interface CapturedRequest {
  path: string;
  headers: Record<string, string>;
}

let captured: CapturedRequest[] = [];
let realFetch: typeof globalThis.fetch;

type FetchArgs = Parameters<typeof globalThis.fetch>;
type FetchInput = FetchArgs[0];
type FetchInit = FetchArgs[1];

function normaliseHeaders(init?: FetchInit): Record<string, string> {
  const raw = init?.headers;
  if (!raw) return {};
  const entries =
    raw instanceof Headers
      ? Array.from(raw.entries())
      : Array.isArray(raw)
        ? raw
        : Object.entries(raw as Record<string, string>);
  return Object.fromEntries(entries.map(([k, v]) => [String(k).toLowerCase(), String(v)]));
}

function mockRes() {
  const state: { code?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      state.code = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
    state,
  };
  return res;
}

const schemaHeader = (r: CapturedRequest) =>
  r.headers['accept-profile'] ?? r.headers['content-profile'];

describe('LimoHawk PostgREST schema qualification', () => {
  beforeEach(() => {
    captured = [];
    realFetch = globalThis.fetch;
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.LIMOHAWK_WEBHOOK_SECRET = WEBHOOK_SECRET;

    globalThis.fetch = (async (input: FetchInput, init?: FetchInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.href : String((input as { url: string }).url);
      if (!url.startsWith(SUPABASE_URL)) {
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      const headers = normaliseHeaders(init);
      captured.push({ path: new URL(url).pathname, headers });

      // Honour PostgREST's single-object representation so the handler's
      // `.single()` reads resolve and the flow continues to the RPC calls.
      const wantsObject = (headers['accept'] ?? '').includes('pgrst.object');
      const row = { id: 'evt-1', account_id: 'acct-1', points_amount: 25 };
      return new Response(JSON.stringify(wantsObject ? row : [row]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  async function postWebhook(eventType: string) {
    // The handler reads LIMOHAWK_WEBHOOK_SECRET at module load, so require it
    // after the env var is set.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { handleLimohawkWebhook } = require('../../src/handlers/webhooks/limohawk');

    const payload = {
      event_type: eventType,
      booking_id: 'bk-1',
      customer: { id: 'cust-1', email: 't***@example.com', name: 'Test' },
      fare: { gross_pence: 30_000, vat_pence: 5_000, net_pence: 25_000 },
      timestamp: '2026-08-03T00:00:00.000Z',
    };
    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody, 'utf8')
      .digest('hex');

    const req = {
      method: 'POST',
      headers: { 'x-limohawk-signature': signature },
      body: payload,
    };
    const res = mockRes();
    await handleLimohawkWebhook(req as never, res as never);
    return res;
  }

  it('a completed booking awards points via a bare function name in the limohawk schema', async () => {
    await postWebhook('booking.completed');

    expect(captured.length).toBeGreaterThan(0);
    const paths = captured.map((r) => r.path);
    // The dotted form emitted /rest/v1/rpc/limohawk.award_points -> PGRST202.
    expect(paths).toContain('/rest/v1/rpc/award_points');
    expect(paths).toContain('/rest/v1/booking_events');
  });

  it('a refund deducts points via a bare function name in the limohawk schema', async () => {
    await postWebhook('booking.refunded');

    const paths = captured.map((r) => r.path);
    expect(paths).toContain('/rest/v1/points_ledger');
    expect(paths).toContain('/rest/v1/rpc/admin_adjust_points');
  });

  it('never emits a dotted relation, and every request selects the limohawk schema by header', async () => {
    await postWebhook('booking.completed');

    expect(captured.length).toBeGreaterThan(0);
    for (const req of captured) {
      const relation = req.path.replace(/^\/rest\/v1\/(rpc\/)?/, '');
      expect(relation).not.toContain('.');
      expect(schemaHeader(req)).toBe('limohawk');
    }
  });
});

describe('LimoHawk source guard: no schema-qualified relation literals', () => {
  // Scoped to the `limohawk` schema. Other schemas in this repo (whiteboard_canvas,
  // video_meetings, merlin_ai) carry the same defect and are tracked separately.
  const roots = [path.resolve(__dirname, '../../src'), path.resolve(__dirname, '../../api')];

  function walk(dir: string): string[] {
    let out: string[] = [];
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return out;
    }
    for (const entry of entries) {
      if (entry === 'node_modules') continue;
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) out = out.concat(walk(full));
      else if (/\.tsx?$/.test(full)) out.push(full);
    }
    return out;
  }

  const files = roots.flatMap(walk);

  it('finds source files to scan (guards against a vacuous pass)', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('no .from() or .rpc() call names a limohawk-qualified relation', () => {
    const dotted = /\.(from|rpc)\(\s*['"`]limohawk\.([A-Za-z_][A-Za-z0-9_]*)['"`]/g;
    const offenders: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const match of source.matchAll(dotted)) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${path.relative(process.cwd(), file)}:${line} → .${match[1]}('limohawk.${match[2]}')`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
