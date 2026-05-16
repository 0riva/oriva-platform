# @oriva/cli

Spec-driven CLI for the Oriva public API. Every endpoint in the OpenAPI spec becomes an `oriva <command>` subcommand — zero CLI code changes when new endpoints ship.

For shell scripts, Claude Code agents, ops one-offs, and humans who'd rather not write Node TypeScript to hit the API.

## Install

```sh
npm i -g @oriva/cli
# or
npx @oriva/cli <command>
```

Requires Node ≥ 18.

## Auth

The CLI looks for an API key in this order (highest precedence first):

1. `--api-key=<value>` flag
2. `ORIVA_API_KEY` env var
3. `~/.config/oriva/config.json` → `profiles[<active>].apiKey`

For most uses, export the env var:

```sh
export ORIVA_API_KEY=oriva_pk_live_…
oriva getCurrentUser
```

For multi-environment work, write `~/.config/oriva/config.json`:

```json
{
  "activeProfile": "default",
  "profiles": {
    "default": { "apiKey": "oriva_pk_live_…" },
    "staging": {
      "apiKey": "oriva_pk_test_…",
      "baseUrl": "https://staging.api.oriva.io"
    }
  }
}
```

Switch with `--profile=staging` or `ORIVA_PROFILE=staging`.

## Usage

```sh
oriva --help                       # List all commands (grouped by OpenAPI tag)
oriva <command> --help             # Per-command help: required + optional params
oriva --version                    # CLI + spec version

oriva getCurrentUser               # GET — pretty JSON
oriva getCurrentUser --json        # Structured envelope { ok, status, data, error, request_id }
oriva listProfiles --json | jq .

# Request bodies — three input modes
oriva createDeveloperApp --body='{"name":"my app"}'
oriva createDeveloperApp --body=@app.json
echo '{"name":"my app"}' | oriva createDeveloperApp --body=-
```

## Global flags

| Flag                 | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `--api-key=<value>`  | One-off override of `ORIVA_API_KEY`                                  |
| `--profile=<name>`   | Use a different config-file profile                                  |
| `--base-url=<url>`   | Override the API base URL                                            |
| `--spec=<url\|path>` | Use a different OpenAPI spec (default: bundled snapshot)             |
| `--json`             | Emit `{ ok, status, data, error, request_id }` envelope (for agents) |
| `--raw`              | Print body unchanged — no JSON pretty-print                          |
| `--show-status`      | Print `HTTP <code> (request_id=<id>)` to stderr                      |
| `--quiet`            | Suppress stderr progress lines                                       |
| `--help`, `-h`       | Show this help (or per-command)                                      |
| `--version`, `-V`    | Print CLI + spec version                                             |

## Exit codes

| Code | Meaning                     |
| ---- | --------------------------- |
| 0    | HTTP 2xx                    |
| 1    | HTTP 4xx (client error)     |
| 2    | HTTP 5xx or network failure |
| 3    | Usage/parse error           |
| 4    | Spec load failure           |

## Error envelope (with `--json`)

```json
{
  "ok": false,
  "status": 401,
  "data": null,
  "error": { "code": "unauthenticated", "message": "..." },
  "request_id": "req_ABC"
}
```

Always parseable — same shape regardless of success/failure. Network errors return `status: 0`.

## CLI vs SDK

| Use case                           | Tool                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Node/TypeScript application code   | [`@oriva/sdk`](https://www.npmjs.com/package/@oriva/sdk) — typed client, IDE autocomplete |
| Shell scripts, CI/CD, ops one-offs | `@oriva/cli` — no Node project needed                                                     |
| Claude Code agents, MCP servers    | Either — CLI for general invocation, SDK for typed Node code                              |

The CLI bundles its own OpenAPI snapshot so it works offline with sub-second cold start. The `peerDependency` on `@oriva/sdk` is optional and only declared for version-pinning hints — the CLI doesn't import the SDK at runtime.

## License

MIT
