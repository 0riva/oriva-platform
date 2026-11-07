/**
 * Which profile the shared JWT middleware (`authenticate`, behind every `validateAuth` route) acts
 * as, for a member who owns none, one, or several profiles (o-core#2151).
 *
 * `.single()` answers PGRST116 for MORE than one row as well as for none, so a member with several
 * profiles was sent down the auto-create branch; the insert failed and every route behind the
 * middleware answered 500 PROFILE_CREATE_FAILED. Runs against a small in-memory `profiles` table so
 * the real query shape (filter, order, limit) decides the answer, not a canned response.
 */

type Profile = { id: string; account_id: string; is_default: boolean; created_at: string };

const mockProfiles: Profile[] = [];
const mockInserts: Record<string, unknown>[] = [];
let mockInsertFails = false;
let mockMember: { id: string; email: string } | null = { id: 'acct-1', email: 'm@example.com' };

/** A PostgREST-like builder over `mockProfiles`: eq filters, order by, limit, single. */
function mockQuery() {
  const filters: Array<[keyof Profile, unknown]> = [];
  const orders: Array<[keyof Profile, boolean]> = [];
  let max: number | null = null;
  const run = () => {
    let rows = mockProfiles.filter((r) => filters.every(([k, v]) => r[k] === v));
    for (const [k, asc] of [...orders].reverse()) {
      rows = [...rows].sort((a, b) => (a[k] === b[k] ? 0 : (a[k] > b[k] ? 1 : -1) * (asc ? 1 : -1)));
    }
    if (max !== null) rows = rows.slice(0, max);
    return rows.map(({ id, account_id }) => ({ id, account_id }));
  };
  const builder = {
    select: () => builder,
    update: () => builder, // last_active_at stamp, fire-and-forget
    eq: (k: keyof Profile, v: unknown) => { filters.push([k, v]); return builder; },
    order: (k: keyof Profile, o: { ascending: boolean }) => { orders.push([k, o.ascending]); return builder; },
    limit: (n: number) => { max = n; return builder; },
    single: async () => {
      const rows = run();
      return rows.length === 1
        ? { data: rows[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: `JSON object requested, ${rows.length} rows returned` } };
    },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: run(), error: null }).then(resolve, reject),
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: async () => {
          if (mockInsertFails) return { data: null, error: { code: '23505', message: 'duplicate key' } };
          mockInserts.push(row);
          return { data: { id: 'new-profile', account_id: row.account_id }, error: null };
        },
      }),
    }),
  };
  return builder;
}

jest.mock('../../src/config/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: mockMember }, error: mockMember ? null : { message: 'bad token' } }) },
    from: () => mockQuery(),
  }),
}));
jest.mock('../../src/lib/metrics', () => ({ trackAPIResponseTime: jest.fn(), trackAuthEvent: jest.fn() }));
jest.mock('../../src/middleware/rateLimiter', () => ({ authRateLimiter: jest.fn() }));

import { authenticate } from '../../src/middleware/auth';

function call(headers: Record<string, string> = { authorization: 'Bearer token' }) {
  const req = { headers } as any;
  const res = { statusCode: 200, body: undefined as any, status(c: number) { this.statusCode = c; return this; }, json(b: unknown) { this.body = b; return this; } };
  const next = jest.fn();
  return authenticate(req, res as any, next).then(() => ({ req, res, next }));
}

const profile = (id: string, over: Partial<Profile> = {}): Profile => ({
  id, account_id: 'acct-1', is_default: false, created_at: '2026-01-01T00:00:00Z', ...over,
});

beforeEach(() => {
  mockProfiles.length = 0;
  mockInserts.length = 0;
  mockInsertFails = false;
  mockMember = { id: 'acct-1', email: 'm@example.com' };
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('authenticate — which profile a signed-in member acts as', () => {
  it('lets a member with several profiles through as their default profile, creating nothing', async () => {
    mockProfiles.push(
      profile('older', { created_at: '2025-01-01T00:00:00Z' }),
      profile('the-default', { is_default: true, created_at: '2026-06-01T00:00:00Z' }),
      profile('someone-else', { account_id: 'acct-2', is_default: true }),
    );

    const { req, res, next } = await call();

    expect(res.statusCode).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authContext.userId).toBe('the-default');
    expect(mockInserts).toHaveLength(0);
  });

  it('uses the oldest profile when none of several is marked default', async () => {
    mockProfiles.push(
      profile('newer', { created_at: '2026-05-01T00:00:00Z' }),
      profile('oldest', { created_at: '2024-02-01T00:00:00Z' }),
    );

    const { req, next } = await call();

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authContext.userId).toBe('oldest');
    expect(req.keyInfo.userId).toBe('oldest');
  });

  it('uses the one profile a member has', async () => {
    mockProfiles.push(profile('only'));

    const { req, next } = await call();

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authContext.userId).toBe('only');
    expect(mockInserts).toHaveLength(0);
  });

  it('creates a profile only for a member who genuinely has none', async () => {
    mockProfiles.push(profile('not-theirs', { account_id: 'acct-2' }));

    const { req, next } = await call();

    expect(mockInserts).toHaveLength(1);
    expect(mockInserts[0]).toMatchObject({ account_id: 'acct-1', is_default: true });
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.authContext.userId).toBe('new-profile');
  });

  it('still refuses with 500 when a member has no profile and one cannot be created', async () => {
    mockInsertFails = true;

    const { res, next } = await call();

    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('PROFILE_CREATE_FAILED');
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses a bad token before looking at profiles', async () => {
    mockMember = null;
    mockProfiles.push(profile('only'));

    const { res, next } = await call();

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
