# Changelog

All notable changes to `@oriva/mcp-server` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] — 2026-05-16

### Changed

- `serverInfo.version` reported over MCP handshake now reads from `package.json` at boot — previously hardcoded as a literal, leading to drift between the version `npm` served and what the running server announced. Future `npm version` bumps now stay in sync automatically.

### Removed

- Three Personal Access Token management operations dropped from the bundled OpenAPI spec — they were exposed as MCP tools but always returned 401 because PAT-management routes require a Supabase JWT (chain-of-trust: a PAT cannot mint or revoke another PAT). PATs are still managed from the web at `/settings/personal-access-tokens`.
  - `createPersonalAccessToken`
  - `listPersonalAccessTokens`
  - `revokePersonalAccessToken`

### Server-side compatibility note

The upstream Oriva API (`api.oriva.io`) now enforces PAT `expires_at` and returns 401 `API_KEY_EXPIRED` for past-expiry tokens. MCP tool calls authenticated with an expired PAT will surface as `isError: true` with the expired-key body. Mint a fresh PAT to recover. No MCP server change required.

## [0.1.1] — 2026-05-16

### Fixed

- Install snippet flag order in README — `claude mcp add` requires `-e` before the positional `--` separator. The original snippet failed for users copying verbatim.

## [0.1.0] — 2026-05-16

### Added

- Initial release. Projects the Oriva public OpenAPI spec into MCP tools — every `operationId` becomes a callable tool, with parameters and request-body fields flattened into the input schema and 2xx response bodies returned verbatim.
- Bundled `dist/spec.json` so `npx`-style consumers don't need to clone the repo.
- 46 operations across 40 paths covering profiles, groups, sessions, marketplace, developer apps, entries, events, auth/profile, analytics, and users.
- Bearer auth via `ORIVA_API_KEY` environment variable.

[0.1.2]: https://www.npmjs.com/package/@oriva/mcp-server/v/0.1.2
[0.1.1]: https://www.npmjs.com/package/@oriva/mcp-server/v/0.1.1
[0.1.0]: https://www.npmjs.com/package/@oriva/mcp-server/v/0.1.0
