# @oriva/mcp-server

Model Context Protocol server for the [Oriva](https://api.oriva.io) public API.

Exposes all 46 public Oriva API endpoints as MCP tools so AI agents (Claude Code, Cursor, Continue, Claude Desktop) can read and write Oriva data on behalf of a user with an `oriva_pk_*` API key.

## Install + connect (Claude Code)

```bash
claude mcp add oriva -e ORIVA_API_KEY=oriva_pk_live_xxx -- npx -y @oriva/mcp-server
```

Then in any Claude Code session, `/mcp` lists `oriva` and you can ask things like:

- "use oriva to show my current user"
- "list my marketplace apps with oriva"
- "create an Oriva event titled 'Demo Day' on 2026-06-01"

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

## License

MIT — see [LICENSE](../../LICENSE) in the o-platform repo root.
