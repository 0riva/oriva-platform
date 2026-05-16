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
