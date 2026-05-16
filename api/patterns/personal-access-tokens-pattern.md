# Personal Access Tokens (PAT) Pattern

**Status**: VERIFIED in production (May 16 2026). Backs `@oriva/mcp-server@0.1.1+`.

User-facing API tokens that let any signed-in Oriva user authorize third-party AI agents (MCP servers, custom integrations, CLI tools) against the public REST API at `api.oriva.io`. Lives alongside marketplace developer-app keys in the same `developer_api_keys` table, distinguished by `key_type='personal'`.

This file captures four non-obvious invariants future agents will hit when extending the PAT system or adding similar account-scoped credential surfaces.

---

## Invariant 1 — `oriva_pk_live_<hex>` format (qualifier required)

PAT format is `oriva_pk_live_<48 random hex chars>`. The `live_` qualifier is **load-bearing** because the shared `validateApiKey` middleware (`api/index.ts:705`) rejects any bearer token that doesn't start with `oriva_pk_test_` or `oriva_pk_live_`. Plain `oriva_pk_<hex>` returns 401 `INVALID_API_KEY`.

PATs are always production keys (no sandbox semantics) — hence `live_`. If we add a sandbox/test mode for PATs later, generate `oriva_pk_test_<hex>` for those.

**Code**: `src/express/routes/me-tokens.ts:86` generates the token. The first 24 chars are stored as `key_prefix` for safe display in the listing UI (includes the `oriva_pk_live_` prefix).

---

## Invariant 2 — PAT routes deliberately skip shared `validateAuth` middleware

The shared `validateAuth` middleware (`src/middleware/auth.ts`) does TWO things:

1. JWT verify via `supabase.auth.getUser(token)`
2. **Profile lookup + auto-create** in `public.profiles` keyed by `account_id = user.id`

The auto-create branch fails with `Failed to create user profile` (500) for users whose profile row doesn't exist or has a schema mismatch. We hit this during the May 16 launch — the user's signed-in JWT was valid but the profile insert failed (likely a NOT NULL column without default, or RLS denying the service-role-key insert).

**PATs are account-scoped, not profile-scoped.** A PAT belongs to an `auth.users` row, not a profile. Forcing profile load on the management routes is a wrong dependency that:

- Couples PAT management to a separate concern (profile schema correctness)
- Blocks PAT creation for users with no/broken profile, even though the PAT system would work fine for them

**Pattern**: PAT routes use `authRateLimiter` (the rate-limit-only half of `createAuthMiddleware()`) + inline `resolveAuthUserId(req)` which calls `supabase.auth.getUser(token)` directly. No profile read, no profile write. See `src/express/routes/me-tokens.ts:45-62`.

**When to apply this pattern**: any new route that operates at `auth.users` level (account credentials, account-level settings, account deletion, etc.) — NOT profile-level (entries, sessions, group memberships).

---

## Invariant 3 — OpenAPI spec is the single source of truth for the MCP server

The `@oriva/mcp-server` npm package bundles `dist/spec.json` (a copy of `claudedocs/openapi-snapshot.json`). At runtime it loads the spec, projects each `operationId` to an MCP tool, and forwards calls to `api.oriva.io`.

**The bundled spec is frozen at publish time.** When the live API adds new operations, the published MCP server does NOT auto-pick them up — customers see the tool list as of whatever snapshot was bundled in their installed version.

**Workflow before each publish**:

```bash
# 1. Refresh the bundled snapshot from live API
curl -s https://api.oriva.io/api/openapi.json > /Users/cosmic/o-platform/claudedocs/openapi-snapshot.json

# 2. Rebuild (prebuild copies snapshot → src/spec.json; build embeds it in dist/)
cd /Users/cosmic/o-platform/packages/mcp-server
npm run build

# 3. Bump version + publish
npm version patch --no-git-tag-version
npm publish --access public
```

If you ship API changes without re-publishing the MCP package, customers' installed `@oriva/mcp-server` won't expose the new endpoints — silent gap, not an error.

---

## Invariant 4 — Token plaintext NEVER round-trips after creation

The full token value is returned ONCE in the `POST /api/v1/me/tokens` response. After that:

- Only the SHA-256 hash is in the database (`developer_api_keys.key_hash`)
- The UI shows it once in a copy-to-clipboard modal, then clears `freshlyCreated` from React state
- No `GET` endpoint returns the plaintext — `listPersonalAccessTokens` returns prefix + metadata only
- No `localStorage` / `sessionStorage` / URL persistence

If the user loses the token, they revoke + create a new one. This is the standard PAT convention (GitHub, Stripe, etc.) — don't let any "convenience" change weaken it.

---

## Test the chain end-to-end

```bash
# 1. Auth gate (no Bearer → 401 from MY route, not validateAuth profile branch)
curl -sw '%{http_code}\n' -X POST https://api.oriva.io/api/v1/me/tokens \
  -H 'Content-Type: application/json' -d '{"name":"x"}'
# Expected: 401 AUTH_REQUIRED

# 2. Validation gate (missing name → 400 from inline schema check)
curl -sw '%{http_code}\n' -X POST https://api.oriva.io/api/v1/me/tokens \
  -H 'Content-Type: application/json' -H 'Authorization: Bearer <valid-supabase-jwt>' -d '{}'
# Expected: 400 VALIDATION_ERROR

# 3. PAT as bearer against the public API (the customer use case)
curl -sw '%{http_code}\n' -X GET https://api.oriva.io/api/v1/user/me \
  -H 'Authorization: Bearer oriva_pk_live_<48hex>'
# Expected: 200 with user profile JSON
```

---

## Related files

- `src/express/routes/me-tokens.ts` — the 3 PAT routes (POST/GET/DELETE)
- `src/openapi/schemas/me-tokens.ts` — Zod schemas + OpenAPI registrations
- `src/middleware/auth.ts:282` — `createAuthMiddleware()` returns `[authRateLimiter, authHandler]`; PATs use the rate limiter half only
- `src/middleware/rateLimiter.ts:64` — `authRateLimiter` export
- `api/index.ts:705` — `validateApiKey` middleware that enforces `oriva_pk_test_`/`live_` prefix
- `packages/mcp-server/` — the npm package this PAT system unlocks
- `tests/api/me-tokens.test.js` — 12 contract tests
- o-core: `supabase/migrations/20260515232000_add_key_type_to_developer_api_keys.sql` — adds `key_type` + `expires_at` columns
- o-core: `apps/web/app/settings/personal-access-tokens/page.tsx` — customer UI
- o-core: `packages/shared/services/personalAccessTokensService.ts` + `packages/shared/hooks/usePersonalAccessTokens.ts` — UI service layer
