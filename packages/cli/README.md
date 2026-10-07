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

| Flag                   | Purpose                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `--api-key=<value>`    | One-off override of `ORIVA_API_KEY`                                           |
| `--profile=<name>`     | Use a different config-file profile                                           |
| `--base-url=<url>`     | Override the API base URL                                                     |
| `--app-base-url=<url>` | Override the web-app host for the Agent commands (default `https://oriva.io`) |
| `--spec=<url\|path>`   | Use a different OpenAPI spec (default: bundled snapshot)                      |
| `--json`               | Emit `{ ok, status, data, error, request_id }` envelope (for agents)          |
| `--raw`                | Print body unchanged — no JSON pretty-print                                   |
| `--show-status`        | Print `HTTP <code> (request_id=<id>)` to stderr                               |
| `--quiet`              | Suppress stderr progress lines                                                |
| `--help`, `-h`         | Show this help (or per-command)                                               |
| `--version`, `-V`      | Print CLI + spec version                                                      |

## Agent buying and listing

Three commands let an agent buy and sell in the Oriva marketplace for the owner of the
API key. They are served by the Oriva web app at `https://oriva.io`, not by
`api.oriva.io`; the CLI sends them there automatically. `--base-url` and
`ORIVA_API_BASE_URL` do not move them — use `--app-base-url` or `ORIVA_APP_BASE_URL`.

**Buying spends the owner's real money.** It works only after the owner has saved a card and
switched agent buying on at https://oriva.io/settings/agent-buying, and only within the
per-purchase and per-day limits they set there.

### `buyListing`

```bash
oriva buyListing \
  --body='{"listingId":"11111111-2222-4333-8444-555555555555","expectedAmountCents":1200}' \
  --idempotencyKey=order-42 --json
```

- `expectedAmountCents` must be the exact current total; a different price is refused.
- Always send `--idempotencyKey`, and reuse it to retry the same purchase. Without one the CLI
  generates a key and reports it (`idempotency_key` in `--json` output, a stderr line otherwise).

| HTTP      | Meaning                                                                      | Exit |
| --------- | ---------------------------------------------------------------------------- | ---- |
| 201       | Bought: `data.purchase` has `id`, `orderId`, `orderNumber`, `amountCents`    | 0    |
| 200       | Repeat of an earlier key (`repeat: true`): nothing new was bought            | 0    |
| 202       | Not finished (`pending: true`): still counts — do not buy again; check later | 0    |
| 403       | Refused, final (`details.refused: true`): do not retry; `error` says why     | 1    |
| 402       | The card was not charged                                                     | 1    |
| 400 / 401 | Bad input / bad or missing personal access token                             | 1    |

### `listAgentPurchases`

```bash
oriva listAgentPurchases --json
```

Returns the owner's 50 most recent agent purchases, refused ones included, with `status` and
`reason`. Use it to check on a purchase that answered 202.

### `createListing`

```bash
oriva createListing --json \
  --body='{"title":"Notion planning template","description":"A weekly planner.","price":12,"publish":false}'
```

Works only once the owner has switched agent listing on (separately from buying), at most 20 an
hour. 201 returns `data.listing`. 422 means the content check refused it: `error` and
`details.hint` say what to change. 403: switched off, a paid listing on a free plan (retry with
`"publish": false`), or a profile that is not the owner's. 429: over the hourly limit.

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

When an error body carries more than `error` (for example a refused purchase's `refused` and
`purchaseId`, or a content check's `hint`), those fields are kept under `details`. A request that
carried an `Idempotency-Key` reports it as `idempotency_key`.

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
