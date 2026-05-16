# @oriva/mcp-server

Model Context Protocol server for the [Oriva](https://api.oriva.io) public API.

Exposes 46 public Oriva API endpoints as MCP tools so AI agents (Claude Code, Cursor, Continue, Claude Desktop) can read and write Oriva data on behalf of a user with an `oriva_pk_live_*` Personal Access Token.

## Get a Personal Access Token

1. Sign in to [oriva.io](https://oriva.io)
2. Go to [Settings → Personal Access Tokens](https://oriva.io/settings/personal-access-tokens)
3. Click **Create Token**, name it (e.g. `claude-code`), and optionally set an expiry
4. **Copy the token now** — the full value is shown only once
5. Treat it like a password — never commit it to git, never paste it into chat

Token format: `oriva_pk_live_<48 hex chars>`. The token grants read+write on your account; revoke any time from the same settings page.

## Install + connect (Claude Code)

```bash
claude mcp add oriva -e ORIVA_API_KEY=oriva_pk_live_xxx -- npx -y @oriva/mcp-server
```

Then in any Claude Code session, `/mcp` lists `oriva` and you can ask things like:

- "use oriva to show my current user"
- "list my marketplace apps with oriva"
- "create an Oriva event titled 'Demo Day' on 2026-06-01"

## Install + connect (other MCP clients)

For clients that read a JSON config file (Claude Desktop, Cursor, Continue, etc.), add this entry to your MCP config — the exact filename and location differs per client, see your client's docs.

```json
{
  "mcpServers": {
    "oriva": {
      "command": "npx",
      "args": ["-y", "@oriva/mcp-server"],
      "env": {
        "ORIVA_API_KEY": "oriva_pk_live_xxx"
      }
    }
  }
}
```

Common config locations:

| Client                                            | Config file                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Claude Desktop                                    | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows) |
| Cursor                                            | `~/.cursor/mcp.json` (user-level) or `<project>/.cursor/mcp.json` (project-level)                                                   |
| Continue                                          | `~/.continue/config.json` under the `experimental.modelContextProtocolServers` key                                                  |
| Project-level (any client supporting `.mcp.json`) | `<project-root>/.mcp.json`                                                                                                          |

Restart the client after editing the config. The Oriva tools appear in the client's tool picker once the connection succeeds.

## Troubleshooting

| Symptom                                                                | Likely cause                                                                             | Fix                                                                                                                                                                      |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tool call returns `isError: true` with `HTTP 401 / INVALID_API_KEY`    | `ORIVA_API_KEY` is missing, has whitespace, or is wrong                                  | Re-export the env var, verify with `echo "$ORIVA_API_KEY" \| head -c 14` (should print `oriva_pk_live_`)                                                                 |
| Tool call returns `HTTP 401 / API_KEY_EXPIRED`                         | The token's `expires_at` is in the past                                                  | Mint a fresh token at [Settings → Personal Access Tokens](https://oriva.io/settings/personal-access-tokens) and update the env var                                       |
| Tool call returns `HTTP 401 / API_KEY_INACTIVE`                        | Token was revoked                                                                        | Mint a new one                                                                                                                                                           |
| Tool call returns `HTTP 401 / Invalid API key format`                  | Token doesn't start with `oriva_pk_live_` (e.g. you pasted a JWT or a developer-app key) | Generate a PAT — see "Get a Personal Access Token" above                                                                                                                 |
| Server fails at boot: `ORIVA_API_KEY environment variable is required` | Env var not reaching the spawned process                                                 | Most MCP clients require env vars under an `env` key in the JSON config, not inherited from the shell                                                                    |
| `/mcp` in Claude Code shows oriva but tool count is 0                  | The bundled spec failed to parse, or `npx` couldn't download the package                 | Run `npx @oriva/mcp-server` manually with `ORIVA_API_KEY` set — the stderr line `[oriva-mcp] Loaded N tools from spec` tells you the actual count, plus any parse errors |
| Old version of the package keeps running after upgrade                 | `npx` caches packages by name+version                                                    | Force-refresh: `npx -y @oriva/mcp-server@latest`                                                                                                                         |

## Environment variables

| Variable             | Required | Purpose                                                                                                    |
| -------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `ORIVA_API_KEY`      | yes      | Bearer key for `Authorization` header. Get one from https://api.oriva.io/developer                         |
| `ORIVA_API_BASE_URL` | no       | Override the API base URL (default `https://api.oriva.io`). Useful for local development against a tunnel. |

## What's exposed

Every public Oriva API endpoint that the OpenAPI spec marks with an `operationId` becomes an MCP tool with the same name. Path + required query parameters are flagged required; optional query params and JSON body fields are optional. Response bodies come back verbatim as text content.

### Coverage

- 46 operations across 40 paths
- Read + write surfaces: profiles, groups, sessions, marketplace, developer, entries, events, auth/profile, analytics, users
- v1 supports `application/json` requests + responses only. Multipart, octet-stream, and server-sent events are **not** wired (the projector throws at boot if the spec adds them).

### Excluded by design

- First-party tenant routes (`/api/v1/tenant/*`) — never part of the public contract
- Internal debug / dev routes (`/dev-profiles`, `/api/v1/debug/cors`)
- Admin routes that require a separate `requireAdminToken`
- Personal Access Token management routes (`POST/GET/DELETE /api/v1/me/tokens`) — these require a Supabase session JWT, not a PAT, because of a chain-of-trust constraint: a PAT cannot mint or revoke another PAT. Manage tokens from the web at [oriva.io/settings/personal-access-tokens](https://oriva.io/settings/personal-access-tokens) instead. The routes still exist on the live API for browser clients; only the MCP tool projection is filtered.

The complete list lives in `claudedocs/public-api-contract.md` in the o-platform repo.

## How tools are derived

This server hand-rolls a projection from `o-platform/claudedocs/openapi-snapshot.json` at build time. The snapshot is bundled into `dist/spec.json`, so `npx` consumers don't need the repo. When the spec changes upstream, `npm run build` re-bundles and re-projects with zero hand edits.

Mapping:

| OpenAPI                                          | MCP                                         |
| ------------------------------------------------ | ------------------------------------------- |
| `operationId`                                    | `tools/list[].name`                         |
| `summary` + `description`                        | `tools/list[].description`                  |
| `parameters[in=path]`                            | required input field                        |
| `parameters[in=query]`                           | required iff `required: true`               |
| `requestBody.content['application/json'].schema` | flattened into input fields                 |
| 2xx response body                                | `CallToolResult.content[0].text` (verbatim) |
| Non-2xx                                          | `isError: true` with HTTP status prefix     |

Path-param vs body-field name collisions are resolved with path-param wins; the body field gets a `body_` prefix.

## Develop locally

```bash
git clone https://github.com/0riva/o-platform.git
cd o-platform/packages/mcp-server
npm install
npm run build
ORIVA_API_KEY=oriva_pk_xxx npx @modelcontextprotocol/inspector node dist/index.js
```

The [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) gives you a web UI to list and call tools without needing an LLM client.

To add the locally-built server to Claude Code:

```bash
claude mcp add oriva-dev -e ORIVA_API_KEY=oriva_pk_live_xxx -- node $PWD/dist/index.js
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for what changed in each release.

## Reporting issues

Open an issue at https://github.com/0riva/o-platform/issues with the `mcp-server` label. Include:

- The MCP client you're using (Claude Code, Claude Desktop, Cursor, etc.) and its version
- The output of `npx @oriva/mcp-server@latest --help` if it errors at boot, OR the `[oriva-mcp] Loaded N tools` line if it boots cleanly
- The tool call that misbehaved (tool name + the arguments you passed, redacting any PII)
- The actual response (`HTTP <status>` + body), redacting `Authorization` headers and PAT values

Never paste your `ORIVA_API_KEY` value into an issue — only the `oriva_pk_live_` prefix is safe to share for diagnostics.

## License

MIT — see [LICENSE](../../LICENSE) in the o-platform repo root.
