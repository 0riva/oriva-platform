# OpenAPI Schema-First Migration — Phase 0+1+2

## Summary

Implemented the foundational OpenAPI spec infrastructure and registered all public API + auth endpoints for o-platform (api.oriva.io). The spec is now served live at `/api/openapi.json` and `/api/docs` (Swagger UI).

## What was built

- `src/openapi/registry.ts` — singleton OpenAPIRegistry with `extendZodWithOpenApi(z)`, `ApiKeyAuth` + `BearerAuth` security schemes
- `src/openapi/spec.ts` — generates `openApiDocument` at import time; imports schema files as side effects
- `src/openapi/schemas/user.ts` — `GET /api/v1/user/me`, `GET /api/v1/analytics/summary`
- `src/openapi/schemas/profiles.ts` — 4 paths: available, active, PUT /:profileId, POST /:profileId/activate
- `src/openapi/schemas/groups.ts` — 2 paths: GET /groups, GET /groups/:groupId/members
- `src/openapi/schemas/auth.ts` — 8 paths: register, login, logout, token/refresh, GET/PATCH/PUT profile, DELETE account
- Added runtime validation via `validateRequestData()` to 6 handlers (profiles PUT+POST, groups GET members, register, login, token/refresh)
- Pattern file: `api/patterns/openapi-schema-first.md`

## Key library

`@asteasolutions/zod-to-openapi@7.3.4` — must use v7, NOT v8 (v8 requires Zod v4, repo is on Zod v3.25.x)

## Critical patterns (see api/patterns/openapi-schema-first.md for full detail)

- Always capture `registry.register()` return value — it's a Zod schema with OpenAPI metadata
- `registry.registerPath()` uses `{param}` not `:param` for path params
- Express 4: does NOT auto-catch thrown errors in async handlers — every catch block needs `instanceof ValidationError` check BEFORE the generic 500 handler
- Body schemas: use `.optional()` + `.passthrough()` to match current handler permissiveness
- Duplicate routes: Express 4 uses first match — document the first registration's shape

## Next phases (not started)

- Phase 3: Marketplace + Developer routes (~20+ endpoints)
- Phase 4: Sub-router migration (profiles.ts, sessions.ts)
- Phase 5: CI enforcement (drift detection on `npm run docs:generate`)
