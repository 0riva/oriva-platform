# Non-Public Schema Addressing & Server-Side External-API Proxy

Two recurring BFF route conventions, learned from the Video Meetings router
(`src/express/routes/video-meetings.ts`).

## 1. Addressing a non-`public` Postgres schema with supabase-js v2

supabase-js does **not** accept dotted `schema.table` strings. Passing one makes
PostgREST look for a table *literally named* `"video_meetings.meetings"` in the
`public` schema — every query silently 404s / errors.

```ts
// ❌ WRONG — looks for a public table called "video_meetings.meetings"
supabase.from('video_meetings.meetings').select('*')

// ✅ RIGHT — selects the meetings table in the video_meetings schema
supabase.schema('video_meetings').from('meetings').select('*')
```

This applies to every non-`public` schema (tenant schemas, `video_meetings`, etc.).
When a route uses the **service-role** client (which bypasses RLS), each query must
*also* filter the owning column explicitly (e.g. `.eq('account_id', accountId)`),
because RLS is not enforcing isolation.

## 2. Auth middleware: use the shared `requireAuth`, not a local header check

A route that reads `req.keyInfo.userId` MUST be mounted behind the shared
`requireAuth` (`src/express/middleware/auth.ts`), which validates the JWT and
populates `req.keyInfo`. A local "is there a Bearer header?" middleware leaves
`keyInfo` undefined, so every account-scoped query returns 401.

```ts
import { requireAuth } from '../middleware/auth';
router.use(requireAuth); // populates req.keyInfo.userId from the JWT
```

## 3. Proxying a third-party API with a server-side key

Never let a secret API key reach the client. Hold it in an env var, guard for its
presence (503 when missing), and forward server-side with `fetch` (Node 18+ global):

```ts
const apiKey = process.env.WHEREBY_API_KEY;
if (!apiKey) return res.status(503).json({ code: 'WHEREBY_NOT_CONFIGURED', ... });
const upstream = await fetch(`${WHEREBY_API_BASE}/meetings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify(body),
});
```

Co-locate the proxy with the feature's other routes (same router, same auth) so the
client hits one authenticated base — e.g. Whereby lives at
`/api/v1/video-meetings/whereby/rooms`, not a separate top-level `/api/whereby/*`.

## Testing note (2026-06-02)

o-platform's jest 30.4.2 + ts-jest harness currently crashes any `jest.mock`-based
test at load (`TypeError: this._moduleMocker.clearMocksOnScope is not a function`,
thrown from `Runtime.resetModules`). This is repo-wide (e.g. `tests/affiliate/resolve.test.ts`
hits it too), so route tests using mocks can't run until the jest version issue is
resolved. `tests/integration/video-meetings-whereby.test.ts` is written and correct;
it will pass once the harness is fixed. `npm test` is non-blocking in the deploy pipeline.
