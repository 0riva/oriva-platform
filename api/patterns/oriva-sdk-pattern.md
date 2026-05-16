# @oriva/sdk + CLI + MCP Server: One Spec, Three Surfaces

**Shipped**: 2026-05-16 — see Serena memories `ORIVA_SDK_TYPED_CLIENT_MAY16_2026` (SDK + initial MCP) and `ORIVA_CLI_AND_MCP_CLI_SHELLOUT_MAY16_2026` (CLI + MCP-shells-out-to-CLI refactor).

## What this pattern is

A typed TypeScript SDK (`@oriva/sdk`), a spec-driven CLI (`@oriva/cli`), and the MCP server (`@oriva/mcp-server`) all derive from a single OpenAPI v3 snapshot. Adding a new endpoint to the Zod schemas → regenerate snapshot → all three pick it up with zero hand-glue.

```
Zod schemas (src/openapi/schemas/)
       │
       ▼
@asteasolutions/zod-to-openapi
       │
       ▼
claudedocs/openapi-snapshot.json   ← single source of truth (46+ ops)
       │
       ├──► @hey-api/openapi-ts ──► packages/sdk/src/generated/ (committed)
       │                              │
       │                              └─► @oriva/sdk (typed, tree-shakeable, in-process Node)
       │
       ├──► scripts/copy-spec.mjs ──► packages/cli/openapi-snapshot.json (bundled in tarball)
       │                              │
       │                              └─► @oriva/cli (zero-runtime-deps, spec-driven subcommands)
       │
       └──► scripts/copy-spec.mjs ──► packages/mcp-server/src/spec.json
                                        │ (drops PAT-only ops via MCP_HIDDEN_OPERATION_IDS)
                                        └─► @oriva/mcp-server (shells out to @oriva/cli)
```

The MCP server's `packages/mcp-server/src/openapi.ts` projects MCP tools dynamically from `spec.json`. The MCP server's `packages/mcp-server/src/client.ts` dispatches each MCP tool call via `packages/mcp-server/src/cliRunner.ts` → `child_process.spawn('oriva', [op, '--json', ...flags])` → parses the envelope back into MCP responses. operationIds in the spec ARE the MCP tool names AND the CLI subcommand names AND the SDK function names. Keep them meaningful.

**Per-consumer rendering (when to use which surface):**

| Consumer                                              | Surface                                                     | Why                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Humans on terminal                                    | `@oriva/cli`                                                | `--help`, `--json`, sub-second cold start, no Node project needed                         |
| Claude Code agents (via Bash)                         | `@oriva/cli`                                                | Proven pattern; structured `--json` envelope; same as how sub-agents already invoke tools |
| MCP-aware editors (Cursor, Windsurf, ChatGPT Desktop) | `@oriva/mcp-server`                                         | Wraps CLI; agents see canonical MCP tool definitions                                      |
| Node/TS application code (serverless, in-product)     | `@oriva/sdk`                                                | Typed, in-process (no subprocess overhead), tree-shakeable for cold starts                |
| 3rd-party developers                                  | `@oriva/sdk` for typed code; `@oriva/cli` for shell scripts | Standard SDK + CLI split                                                                  |

**Why MCP shells out to CLI** (architectural choice, not industry default — see Serena memory `ORIVA_CLI_AND_MCP_CLI_SHELLOUT_MAY16_2026` for the trade-off analysis): single source of behavior across CLI + MCP, every new endpoint cascades automatically (spec → SDK regen → CLI auto-picks-up → MCP auto-exposes). Trade-off: ~100-200ms subprocess overhead per MCP tool call (acceptable for current MCP response-time budget). AWS / Stripe / GitHub / Vercel ship CLI and MCP/SDK independently — our chain works for our scale.

## How to add a new endpoint

1. Add to `src/openapi/schemas/<topic>.ts` (Zod schema + path registration). Include a meaningful `operationId`.
2. Regenerate snapshot: `node -e "import('./src/openapi/spec.js').then(m => process.stdout.write(JSON.stringify(m.openApiSpec, null, 2)))" > claudedocs/openapi-snapshot.json` (or whatever the canonical regen command is in `src/openapi/spec.ts`).
3. Regenerate SDK: `cd packages/sdk && npm run generate`
4. Commit BOTH `claudedocs/openapi-snapshot.json` AND `packages/sdk/src/generated/` together. CI drift guard (`.github/workflows/api-sdk-ci.yml`) fails if these drift.
5. MCP server picks up new tool automatically on next rebuild — no MCP code changes needed (delegates via subprocess to `@oriva/cli`).
6. CLI bundled snapshot: run `node packages/cli/scripts/copy-spec.mjs` and commit the refreshed `packages/cli/openapi-snapshot.json`. v0.1.0 ships with manual refresh; v0.1.1 will adopt Prettier-matched output so CI drift-guard can re-enable (see Serena memory `ORIVA_CLI_AND_MCP_CLI_SHELLOUT_MAY16_2026` § "drift-guard formatting cascade").
7. Bump SDK version (`packages/sdk/package.json`) → CI auto-publishes to npm on push to main.
8. If MCP server should expose the new tool, bump MCP version too — same auto-publish.
9. If CLI should bundle the new op, bump CLI version too — same auto-publish (needs `NPM_TOKEN` to be a Granular Automation token with 2FA bypass; rotated 2026-05-16).

## @hey-api/openapi-ts config gotchas

**Symptom → fix table:**

| TypeScript error                                                                                  | Root cause                                                                                 | Fix                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `Cannot find module './types.gen' or its corresponding type declarations`                         | hey-api emits extension-less imports by default; NodeNext module resolution requires `.js` | Set `output.importFileExtension: '.js'` in `openapi-ts.config.ts`                                         |
| `An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled` | `runtimeConfigPath` was given as `.ts`, generator preserves the extension                  | Use `runtimeConfigPath: './src/runtime-config.js'` (NOT `.ts`) — the `.js` extension works with NodeNext  |
| `format is deprecated. Use postProcess: ['prettier'] instead`                                     | Old generator config field                                                                 | Change `output.format: 'prettier'` → top-level `postProcess: ['prettier']`                                |
| `@hey-api/client-fetch deprecated: bundled directly inside @hey-api/openapi-ts v0.73+`            | Standalone fetch client moved into the generator package                                   | Remove `@hey-api/client-fetch` from dependencies; it's automatically bundled into `src/generated/client/` |

Reference config: `packages/sdk/openapi-ts.config.ts`.

## npm publish scope-level token gotcha

**Symptom**: First-time publish of a new package in the `@oriva` scope returns:

```
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/@oriva%2fsdk
npm error 404 The requested resource '@oriva/sdk@0.1.0' could not be found or you do not have permission to access it.
```

Despite `npm whoami` returning `timebinder` and being able to update existing `@oriva/*` packages (e.g., `npm owner ls @oriva/mcp-server` works).

**Root cause**: Granular npm tokens with **package-list** scoping allow updates to listed packages but BLOCK new-package creation in the namespace. Classic tokens (legacy) didn't have this restriction.

**Fix**: At https://www.npmjs.com/settings/timebinder/tokens, generate a granular token with:

- **Permission**: Read and write
- **Packages and scopes**: select the **@oriva** scope (NOT individual packages)

The wildcard granted by selecting the scope itself covers all current AND future packages under `@oriva/*`. Store the token in `~/.npmrc` via `npm config set //registry.npmjs.org/:_authToken=TOKEN`. For CI auto-publish, set the same token as `NPM_TOKEN` repo secret.

**Convenient one-liner** (pipes the token from `~/.npmrc` to `gh secret set` via stdin — token never appears in process args or terminal scrollback):

```bash
grep '_authToken' "$HOME/.npmrc" | sed 's/.*_authToken=//' | gh secret set NPM_TOKEN --repo 0riva/oriva-platform
```

**Status**: `NPM_TOKEN` is set on `0riva/oriva-platform` as of 2026-05-16 (`gh secret list --repo 0riva/oriva-platform | grep NPM_TOKEN` to verify). CI auto-publish pipeline (`api-sdk-ci.yml`) will fire on next SDK or MCP version bump pushed to main.

## CI drift guard

`.github/workflows/api-sdk-ci.yml` runs on push/PR touching `packages/sdk/**`, `claudedocs/openapi-snapshot.json`, or itself:

1. Install workspace root deps
2. `cd packages/sdk && npm run generate`
3. `git diff --exit-code src/generated` — **fails the build** if the regenerated SDK differs from what's committed
4. `npx tsc` (type-check + build)
5. `npm pack --dry-run`
6. On main, if version in `packages/sdk/package.json` exceeds the latest npm version: `npm publish --access public` using `NPM_TOKEN` repo secret

The drift guard catches the failure mode of editing the OpenAPI snapshot without regenerating the SDK. It catches it BEFORE the SDK ships and confuses consumers with stale types.

## npm workspaces

Root `package.json` declares `"workspaces": ["packages/*"]`. This means:

- `@oriva/sdk` and `@oriva/mcp-server` link locally (no publish round-trip needed during dev)
- `npm install` at root installs deps for all workspace members in one pass
- `npm install -w packages/sdk` targets a single workspace member
- The MCP server depends on `"@oriva/sdk": "^0.1.0"` — npm resolves this from the local workspace first when running locally, from the npm registry when running as a published package consumer

## Critical files

- `packages/sdk/openapi-ts.config.ts` — generator config (importFileExtension + runtimeConfigPath gotchas)
- `packages/sdk/src/runtime-config.ts` — sets default `baseUrl` via `ORIVA_API_BASE_URL` env fallback
- `packages/sdk/src/index.ts` — `createOrivaClient()` factory + `rawClient`/`rawSdk` exports
- `packages/sdk/src/generated/` — auto-generated, COMMITTED (not gitignored)
- `packages/mcp-server/src/client.ts` — SDK delegation by operationId
- `packages/mcp-server/src/openapi.ts` — dynamic tool projection (UNCHANGED by SDK refactor)
- `packages/mcp-server/scripts/copy-spec.mjs` — `MCP_HIDDEN_OPERATION_IDS` filter
- `.github/workflows/api-sdk-ci.yml` — drift guard + auto-publish
