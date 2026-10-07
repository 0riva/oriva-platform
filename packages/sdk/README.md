# @oriva/sdk

Typed TypeScript SDK for the Oriva public API. Generated from the OpenAPI v3 spec — every endpoint, every request body, every response is fully typed.

## Install

```bash
npm install @oriva/sdk
```

## Quick start

```ts
import { createOrivaClient } from '@oriva/sdk';

const oriva = createOrivaClient({
  apiKey: process.env.ORIVA_API_KEY!, // oriva_pk_live_... or oriva_pk_test_...
});

const me = await oriva.getCurrentUser();
console.log(me.data?.email);
```

Get an API key at <https://api.oriva.io/developer>.

## Examples

### List profiles

```ts
const profiles = await oriva.listProfiles({
  query: { limit: 10, status: 'active' },
});

if (profiles.error) {
  console.error('API error:', profiles.error);
} else {
  for (const p of profiles.data?.profiles ?? []) {
    console.log(p.id, p.displayName);
  }
}
```

### Create a group

```ts
const result = await oriva.createGroup({
  body: {
    name: 'Engineering',
    description: 'Eng team workspace',
    visibility: 'private',
  },
});

if (result.data) {
  console.log('Created group:', result.data.id);
}
```

### Agent buying and listing

`buyListing`, `createListing` and `listAgentPurchases` are served by the Oriva web app at
`https://oriva.io` (not `api.oriva.io`); the client sends them there. Override with the
`appBaseUrl` option or `ORIVA_APP_BASE_URL`.

**`buyListing` spends the key owner's real money**, only after they saved a card and switched
agent buying on at https://oriva.io/settings/agent-buying, and only within the limits they set
there.

```ts
const oriva = createOrivaClient({ apiKey: process.env.ORIVA_API_KEY! });

const result = await oriva.buyListing({
  body: {
    listingId: '11111111-2222-4333-8444-555555555555',
    expectedAmountCents: 1200,
  },
  headers: { 'Idempotency-Key': 'order-42' }, // reuse it to retry this same purchase
});

// The key actually sent (yours, or a fresh one generated when you pass none):
console.log(result.idempotencyKey);

switch (result.response?.status) {
  case 201: // bought — result.data.purchase
  case 200: // repeat of an earlier key — nothing new bought
    break;
  case 202: // not finished — still counts; do NOT buy again, check listAgentPurchases later
    break;
  case 403: // refused, final — result.error.refused === true; do not retry
  case 402: // the card was not charged
    console.error(result.error);
}

const { data } = await oriva.listAgentPurchases(); // { purchases: [...] }, newest first

const listed = await oriva.createListing({
  body: {
    title: 'Notion planning template',
    description: 'A weekly planner.',
    price: 12,
  },
});
// 201 listed · 422 content check refused (error + hint) · 403 switched off / paid plan needed · 429 hourly limit
```

`expectedAmountCents` must be the exact current total: a different price is refused before any
charge. With the raw generated client, use `makeAgentOperations(appBaseUrl)` to get the same
wrappers; the raw `rawSdk.buyListing` would otherwise go to `api.oriva.io` and send no key.

### Error handling

Every SDK method returns `{ data, error, response }`. Check `response.ok` for HTTP-level success, or check `error` for structured error payloads:

```ts
const result = await oriva.getProfile({ path: { profileId: 'xyz' } });

if (!result.response.ok) {
  // HTTP 4xx/5xx
  console.error(`HTTP ${result.response.status}:`, result.error);
} else {
  console.log('Got profile:', result.data);
}
```

## Advanced: raw client + per-call overrides

`createOrivaClient` configures a singleton client. For multi-tenant scenarios or per-request overrides, import the raw generated SDK:

```ts
import { rawClient, rawSdk } from '@oriva/sdk';

rawClient.setConfig({ baseUrl: 'https://staging.api.oriva.io' });
const result = await rawSdk.getCurrentUser({
  headers: { Authorization: `Bearer ${differentKey}` }, // per-call override
});
```

## Generated from OpenAPI

This package is generated from [the Oriva OpenAPI v3 spec](https://api.oriva.io/docs/openapi.yml) using [`@hey-api/openapi-ts`](https://heyapi.dev/). When the API surface changes, regenerate with:

```bash
npm run generate
```

## License

MIT
