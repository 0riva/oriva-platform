# @oriva/sdk Typed Client — Shipped May 16 2026

## What shipped

- **`@oriva/sdk@0.1.0`** — typed TypeScript SDK generated from OpenAPI v3 spec via `@hey-api/openapi-ts@0.97.1`. Published to npm. Ships ergonomic `createOrivaClient({ apiKey })` factory + raw `rawClient`/`rawSdk` exports. All 46 public operations covered (operationId = function name).
- **`@oriva/mcp-server@0.2.0`** — refactored to consume `@oriva/sdk` instead of hand-rolled fetch. Internal-only change; tool surface and behavior unchanged. Published to npm.
- **npm workspaces** — added to root `package.json`, links SDK + MCP locally during dev.
- **CI drift guard** — `.github/workflows/api-sdk-ci.yml`: regenerate-and-diff src/generated on every push touching `packages/sdk/` or `claudedocs/openapi-snapshot.json`; auto-publish on version bump (requires `NPM_TOKEN` repo secret).

## Architecture

```
Zod schemas → @asteasolutions/zod-to-openapi → claudedocs/openapi-snapshot.json
                                              ├→ @hey-api/openapi-ts → @oriva/sdk (NEW)
                                              └→ packages/mcp-server (consumes @oriva/sdk)
```

Single source of truth: `claudedocs/openapi-snapshot.json` feeds both the SDK and the MCP tool surface. Add a new endpoint to Zod → regenerate snapshot → SDK + MCP both pick it up with zero hand-glue.

## Critical files

- `packages/sdk/openapi-ts.config.ts` — generator config. Key flags: `importFileExtension: '.js'` (Node-compatible imports) + `runtimeConfigPath: './src/runtime-config.js'` (custom client config injection).
- `packages/sdk/src/runtime-config.ts` — sets default `baseUrl` via `ORIVA_API_BASE_URL` env fallback.
- `packages/sdk/src/index.ts` — `createOrivaClient()` factory wires auth header + UA + baseUrl on the singleton client.
- `packages/mcp-server/src/client.ts` — SDK delegation by `operationId` (replaces 75 LOC of hand-rolled fetch).
- `packages/mcp-server/src/openapi.ts` — UNCHANGED; still projects MCP tools dynamically from `spec.json` at runtime. The right design — tool surface is data-driven from spec, not codegen.

## Decisions locked

- **Package name**: `@oriva/sdk` (preferred over `@oriva/api-sdk` since the pre-pivot `@oriva/plugin-sdk` is abandoned — no real collision risk).
- **Generated code committed** (not gitignored) — for diff transparency + consumer grep-ability + zero install-time codegen surprise.
- **Generator**: `@hey-api/openapi-ts` (chosen over orval/kubb/openapi-typescript/Stainless for production maturity + Node compatibility + tree-shakeable per-resource output).

## Commit + publish

- Commit: `54adde7` on `0riva/o-platform` main (pushed; Vercel auto-deployed API — SDK changes don't affect API behavior).
- npm publish required granular token with scope-level `@oriva` access (Read+Write) — earlier 0.1.3-era token was packages-list-only, blocked new package creation. New token shipped + stored in `~/.npmrc` locally.

## What's NOT yet done

- **GitHub `NPM_TOKEN` secret** not yet set at https://github.com/0riva/o-platform/settings/secrets/actions — CI workflow's `publish` job will fail on next version bump until set. Use the same `@oriva`-scoped granular token that's in `~/.npmrc`.
- **`@oriva/plugin-sdk` deprecation status** — currently dormant (last touched Sep 2025, no consumers, never npm-published). Consider archiving formally OR repurposing as a higher-level abstraction that consumes `@oriva/sdk` internally.
- **CLI package** (`@oriva/cli`) — deferred per original plan; becomes trivial wrapper over `@oriva/sdk` once a use case appears.
- **React Query hooks** (via `@hey-api/openapi-ts` plugin) — defer; o-orig's existing `orivaApi` patterns are stable.
- **Python SDK** — same pattern (`openapi-python-client` or Stainless), separate package, separate plan.

## Verification chain

1. `cd packages/sdk && npx tsc` — clean build (40 LOC main + 488 LOC sdk + types)
2. `cd packages/mcp-server && npm run build` — `dist/index.js` produced, spec bundled
3. JSON-RPC roundtrip: `tools/list` returns 46 tools (unchanged from 0.1.3); `tools/call getCurrentUser` → real HTTP fire to api.oriva.io → `HTTP 401 INVALID_API_KEY` returned through SDK + unwrapped to MCP text response
4. `npm run docs:check` at root still passes (49 spec paths, 65 Express routes)
5. `npm view @oriva/sdk version` → `0.1.0`
6. `npm view @oriva/mcp-server version` → `0.2.0`
