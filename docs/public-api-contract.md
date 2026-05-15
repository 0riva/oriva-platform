# Public API Contract — o-platform (api.oriva.io)

**Last updated**: 2026-05-14  
**Branch**: `feat/public-api-contract-hardening`  
**Purpose**: Single source of truth for which routes are part of the public 3rd-party developer API contract.  
**Generator readiness**: SDK / MCP / CLI generation uses the `public` subset only.

---

## Classification Key

| Class         | Meaning                                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `public`      | Part of the 3rd-party developer API contract. Must be in OpenAPI spec.       |
| `first-party` | Internal / first-party use only. Not in spec. Never document externally.     |
| `deprecated`  | Deprecated in-tree. Bears `X-Deprecated-API` headers. Removal tracked below. |

---

## Route Inventory

### Infrastructure / Health

| Method | Path                      | Class       | Justification                                             |
| ------ | ------------------------- | ----------- | --------------------------------------------------------- |
| GET    | `/health`                 | first-party | Monitoring endpoint; no contract value for 3rd-party devs |
| GET    | `/api/v1/health`          | first-party | Legacy health; duplicates above                           |
| GET    | `/api/v1/test`            | first-party | Routing smoke-test; dev-only purpose                      |
| GET    | `/dev-profiles`           | first-party | Dev-mode only, guarded by `NODE_ENV !== development`      |
| GET    | `/api/v1/debug/cors`      | first-party | Admin-token-gated diagnostics endpoint                    |
| GET    | `/api/v1/dev/permissions` | first-party | Developer portal documentation helper; not a callable API |

---

### Auth — `/api/v1/auth/*`

Served by `src/express/routes/auth-public.ts`, mounted at `/api/v1/auth`.

| Method | Path                         | Class  | Justification                    |
| ------ | ---------------------------- | ------ | -------------------------------- |
| POST   | `/api/v1/auth/register`      | public | Standard account registration    |
| POST   | `/api/v1/auth/login`         | public | Standard login                   |
| POST   | `/api/v1/auth/logout`        | public | Standard logout                  |
| POST   | `/api/v1/auth/token/refresh` | public | Token refresh                    |
| GET    | `/api/v1/auth/profile`       | public | Get authenticated user's profile |
| PATCH  | `/api/v1/auth/profile`       | public | Update profile                   |
| PUT    | `/api/v1/auth/profile`       | public | Replace profile                  |
| DELETE | `/api/v1/auth/account`       | public | Delete account                   |

**Note**: The legacy `api/v1/auth.ts` handler covers the same routes. It is wired via the `vercel.json` rewrite `/api/v1/auth/:path* → /api/v1/auth`. See §Legacy Handlers below — classified `first-party` (superseded, Express router wins).

---

### User — `/api/v1/user/*`

Served by `src/express/routes/user-public.ts`, mounted at `/api/v1`.

| Method | Path               | Class       | Justification                                                                                |
| ------ | ------------------ | ----------- | -------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/user/me`  | public      | Primary user identity endpoint                                                               |
| GET    | `/api/v1/users/me` | first-party | Compat alias; internally re-dispatches to `/user/me`. Excluded from spec to avoid duplicate. |

---

### Analytics

Served by `src/express/routes/user-public.ts`.

| Method | Path                        | Class  | Justification                  |
| ------ | --------------------------- | ------ | ------------------------------ |
| GET    | `/api/v1/analytics/summary` | public | Usage summary for API consumer |

---

### Profiles — `/api/v1/profiles/*`

Served by `src/express/routes/user-public.ts`.

| Method | Path                                   | Class  | Justification              |
| ------ | -------------------------------------- | ------ | -------------------------- |
| GET    | `/api/v1/profiles/available`           | public | List caller's profiles     |
| GET    | `/api/v1/profiles/active`              | public | Get active/default profile |
| PUT    | `/api/v1/profiles/:profileId`          | public | Update a profile           |
| POST   | `/api/v1/profiles/:profileId/activate` | public | Switch active profile      |

---

### Groups — `/api/v1/groups/*`

Served by `src/express/routes/user-public.ts`.

| Method | Path                              | Class  | Justification        |
| ------ | --------------------------------- | ------ | -------------------- |
| GET    | `/api/v1/groups`                  | public | List caller's groups |
| GET    | `/api/v1/groups/:groupId/members` | public | List group members   |

---

### Sessions — `/api/v1/sessions/*`

Served by `src/express/routes/user-public.ts`.

| Method | Path                        | Class  | Justification                                         |
| ------ | --------------------------- | ------ | ----------------------------------------------------- |
| GET    | `/api/v1/sessions`          | public | List sessions (stub returning empty, feature pending) |
| GET    | `/api/v1/sessions/upcoming` | public | Upcoming sessions (stub, feature pending)             |

---

### Team — `/api/v1/team/*`

Served by `src/express/routes/user-public.ts`.

| Method | Path                   | Class  | Justification                            |
| ------ | ---------------------- | ------ | ---------------------------------------- |
| GET    | `/api/v1/team/members` | public | Team members (maps to group memberships) |

---

### Entries / Templates / Storage / UI

Served by `src/express/routes/user-public.ts`.

| Method | Path                       | Class  | Justification                           |
| ------ | -------------------------- | ------ | --------------------------------------- |
| GET    | `/api/v1/entries`          | public | List caller's entries                   |
| GET    | `/api/v1/templates`        | public | List templates (stub, feature pending)  |
| GET    | `/api/v1/storage`          | public | Storage summary (stub, feature pending) |
| POST   | `/api/v1/ui/notifications` | public | Send UI notification to user            |

---

### Marketplace — `/api/v1/marketplace/*`

Served by `src/express/routes/marketplace.ts`, mounted at `/api/v1`.

| Method | Path                                   | Class       | Justification                                    |
| ------ | -------------------------------------- | ----------- | ------------------------------------------------ |
| GET    | `/api/v1/marketplace/apps`             | public      | Browse approved apps                             |
| GET    | `/api/v1/marketplace/apps/:appId`      | public      | Get app details                                  |
| GET    | `/api/v1/marketplace/trending`         | public      | Trending apps                                    |
| GET    | `/api/v1/marketplace/featured`         | public      | Featured apps                                    |
| GET    | `/api/v1/marketplace/categories`       | public      | Category counts (first match, API-key auth)      |
| GET    | `/api/v1/marketplace/installed`        | public      | List caller's installed apps                     |
| POST   | `/api/v1/marketplace/install/:appId`   | public      | Install an app                                   |
| DELETE | `/api/v1/marketplace/uninstall/:appId` | public      | Uninstall an app                                 |
| GET    | `/api/v1/marketplace/items`            | public      | Public item listing                              |
| GET    | `/api/v1/marketplace/items/:id`        | public      | Get single item                                  |
| POST   | `/api/v1/marketplace/search`           | public      | Search marketplace                               |
| GET    | `/api/v1/marketplace/categories/tree`  | public      | Category hierarchy                               |
| GET    | `/api/v1/marketplace/categories/:id`   | public      | Single category                                  |
| POST   | `/api/v1/marketplace/items`            | first-party | Seller-side mutation; not yet part of public API |
| PUT    | `/api/v1/marketplace/items/:id`        | first-party | Seller-side mutation; not yet part of public API |
| DELETE | `/api/v1/marketplace/items/:id`        | first-party | Seller-side mutation; not yet part of public API |
| POST   | `/api/v1/marketplace/categories`       | first-party | Admin-only category mutation                     |
| PUT    | `/api/v1/marketplace/categories/:id`   | first-party | Admin-only category mutation                     |
| DELETE | `/api/v1/marketplace/categories/:id`   | first-party | Admin-only category mutation                     |

---

### Developer Portal — `/api/v1/developer/*`

Served by `src/express/routes/marketplace.ts`.

| Method | Path                                     | Class  | Justification                       |
| ------ | ---------------------------------------- | ------ | ----------------------------------- |
| GET    | `/api/v1/developer/apps`                 | public | Developer lists their own apps      |
| GET    | `/api/v1/developer/apps/:appId`          | public | Developer gets single app detail    |
| POST   | `/api/v1/developer/apps`                 | public | Developer creates app               |
| PUT    | `/api/v1/developer/apps/:appId`          | public | Developer updates app               |
| DELETE | `/api/v1/developer/apps/:appId`          | public | Developer deletes draft app         |
| POST   | `/api/v1/developer/apps/:appId/submit`   | public | Developer submits app for review    |
| POST   | `/api/v1/developer/apps/:appId/resubmit` | public | Developer resubmits after rejection |

---

### Admin — `/api/v1/admin/*`

Served by `src/express/routes/marketplace.ts`.

| Method | Path                               | Class       | Justification                               |
| ------ | ---------------------------------- | ----------- | ------------------------------------------- |
| GET    | `/api/v1/admin/apps/pending`       | first-party | Admin-token gated; internal review workflow |
| POST   | `/api/v1/admin/apps/:appId/review` | first-party | Admin-token gated; internal review workflow |

---

### Events — `/api/oriva/events/*`

Served by `src/express/routes/oriva-events.ts`, mounted at `/api/oriva/events`.

| Method | Path                         | Class  | Justification        |
| ------ | ---------------------------- | ------ | -------------------- |
| GET    | `/api/oriva/events`          | public | List platform events |
| GET    | `/api/oriva/events/:eventId` | public | Get single event     |
| POST   | `/api/oriva/events`          | public | Create event         |

---

### Photos — `/api/v1/apps/photos/*`

Served by `src/express/routes/photos.ts`, mounted at `/api/v1/apps/photos`.

| Method | Path                             | Class       | Justification                                                |
| ------ | -------------------------------- | ----------- | ------------------------------------------------------------ |
| POST   | `/api/v1/apps/photos/upload-url` | first-party | Pre-signed S3 URL generation; internal infra, API key scoped |
| POST   | `/api/v1/apps/photos/confirm`    | first-party | Upload confirmation; internal infra                          |

**Rationale**: Photo upload is a platform infrastructure primitive. It does not model domain entities useful to 3rd-party devs. The auth model (API key only, no per-user scoping in the route itself) makes it unsuitable for public API exposure without additional scope/ownership design.

---

### User Media — `/api/v1/user/media/*`

Served by `src/express/routes/userMedia.ts`, mounted at `/api/v1/user/media`.

| Method | Path                                   | Class       | Justification                                |
| ------ | -------------------------------------- | ----------- | -------------------------------------------- |
| POST   | `/api/v1/user/media/avatar/upload-url` | first-party | Internal avatar upload; JWT-only, no API key |
| POST   | `/api/v1/user/media/avatar/confirm`    | first-party | Avatar upload confirmation                   |

---

### Video Meetings — `/api/v1/video-meetings/*`

Served by `src/express/routes/video-meetings.ts`, mounted at `/api/v1/video-meetings`.

| Method | Path                                               | Class       | Justification                                             |
| ------ | -------------------------------------------------- | ----------- | --------------------------------------------------------- |
| GET    | `/api/v1/video-meetings/meetings`                  | first-party | Twilio-based meetings; internal infrastructure dependency |
| GET    | `/api/v1/video-meetings/meetings/:meetingId`       | first-party | Same                                                      |
| POST   | `/api/v1/video-meetings/meetings`                  | first-party | Same                                                      |
| PATCH  | `/api/v1/video-meetings/meetings/:meetingId`       | first-party | Same                                                      |
| DELETE | `/api/v1/video-meetings/meetings/:meetingId`       | first-party | Same                                                      |
| POST   | `/api/v1/video-meetings/meetings/:meetingId/start` | first-party | Same                                                      |
| POST   | `/api/v1/video-meetings/meetings/:meetingId/end`   | first-party | Same                                                      |

---

### Locations — `/api/locations/*`

Served by `src/express/routes/locations.ts`, mounted at `/api/locations`.

| Method | Path                                     | Class       | Justification                                                                |
| ------ | ---------------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| GET    | `/api/locations/*` (Google Places proxy) | first-party | Google Places proxy; uses server-side API key. Not a stable public contract. |

---

### Merlin AI — `/api/merlin/*`

Served by `src/routes/merlin-ai.ts`, mounted at `/api/merlin` (and `/api/hugo` legacy alias).

| Method | Path                   | Class       | Justification                                                    |
| ------ | ---------------------- | ----------- | ---------------------------------------------------------------- |
| POST   | `/api/merlin/chat`     | first-party | Anthropic AI; internal product feature, not public API primitive |
| POST   | `/api/merlin/analyze`  | first-party | AI analysis; internal product feature                            |
| POST   | `/api/merlin/insights` | first-party | AI insights; internal product feature                            |
| POST   | `/api/merlin/sync`     | first-party | AI sync; internal product feature                                |
| GET    | `/api/hugo/*`          | first-party | Legacy alias for `/api/merlin`; same classification              |

---

### Hugo Love (Tenant) — `/api/v1/tenant/hugo-love/*`

Served by `src/express/routes/hugo-love/`, mounted at `/api/v1/tenant/hugo-love`.  
Routed by `vercel.json` rewrite.

| Method | Path                         | Class      | Justification                                                                                           |
| ------ | ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| ALL    | `/api/v1/tenant/hugo-love/*` | deprecated | Tenant API deprecated 2025-12-21. Bears `X-Deprecated-API` headers. Removal pending traffic monitoring. |

---

### Ask Me Anything — `/api/v1/ask-me-anything/*`

Served by `src/express/routes/ask-me-anything/`, mounted at `/api/v1/ask-me-anything`.

| Method | Path                           | Class       | Justification                                                            |
| ------ | ------------------------------ | ----------- | ------------------------------------------------------------------------ |
| ALL    | `/api/v1/ask-me-anything/*`    | first-party | AMA is a first-party tenant app feature; not part of public platform API |
| ALL    | `/api/oriva/ask-me-anything/*` | first-party | Same (second mount alias)                                                |

---

### OpenAPI Spec / Docs

| Method | Path                | Class       | Justification                                              |
| ------ | ------------------- | ----------- | ---------------------------------------------------------- |
| GET    | `/api/openapi.json` | first-party | Spec endpoint; excluded from its own spec (infrastructure) |
| GET    | `/api/docs`         | first-party | Swagger UI; excluded                                       |

---

## Legacy `api/v1/*.ts` Handler Resolution

See §Legacy Handlers section for per-file decisions.

### api/v1/auth.ts

**Classification**: `first-party` (superseded)  
**Decision**: The Express `createAuthPublicRouter` mounted at `/api/v1/auth` wins all traffic — Vercel's `/api/v1/auth/:path* → /api/v1/auth` rewrite routes to the legacy file only when the catch-all `api/index` doesn't handle it first, but since `api/index` is the Vercel entry point for the main Express app, it handles these requests. The legacy file remains on disk for now as a reference implementation. No spec registration needed — the Express router routes are already in the spec.  
**Action**: Leave in place; document as superseded. No rewrite changes needed.

### api/v1/canvas.ts

**Classification**: `first-party`  
**Decision**: Canvas (whiteboard) is an internal Oriva Core feature with no current 3rd-party use case. Uses `whiteboard_canvas.*` schema. Not referenced by any vercel.json rewrite that isn't caught by the main catch-all. No public API exposure.  
**Action**: No spec registration. Leave in place.

### api/v1/hugo.ts

**Classification**: `first-party`  
**Decision**: Hugo AI is the legacy name for Merlin AI — conversation management backed by Anthropic. First-party AI product; not appropriate as a public API primitive without additional design work (scoping, rate limiting, billing). The `vercel.json` routes `/api/v1/conversations*` and `/api/v1/hugo/*` to this file — these are superseded by `/api/merlin` in the Express app.  
**Action**: No spec registration. Routes classified first-party. The `vercel.json` rewrites for `/api/v1/conversations` and `/api/v1/hugo/:path*` can be left as fallbacks; the main Express catch-all handles all `/api/(.*)` traffic.

### api/v1/integrations.ts

**Classification**: `first-party`  
**Decision**: Events, notifications, and webhooks via this handler are Vercel-legacy. The routes (`/api/v1/apps/:appId/events`, `/api/v1/apps/:appId/notifications`, `/api/v1/apps/:appId/webhooks`) are internal integrations infrastructure, not documented public API. They use the old Vercel handler pattern and are not wired into the Express OpenAPI spec pipeline.  
**Action**: No spec registration. Leave in place as internal infrastructure. If/when these become public API candidates, they should be migrated to Express sub-routers first.

### api/v1/marketing.ts

**Classification**: `first-party`  
**Decision**: Affiliate campaign management and ad serving are internal Oriva monetisation infrastructure. Not appropriate for 3rd-party developer API exposure.  
**Action**: No spec registration. Leave in place.

### api/v1/marketplace.ts

**Classification**: `first-party` (superseded)  
**Decision**: The Express `createMarketplaceRouter` mounted via `api/index.ts` handles all marketplace traffic. This legacy handler is superseded. The `vercel.json` rewrite `/api/v1/marketplace/:path* → /api/v1/marketplace` routes to this file, but in practice the main Express catch-all `/api/(.*)` at the bottom of `vercel.json` picks up all traffic first.  
**Action**: Leave in place. All marketplace spec entries are already registered via `src/openapi/schemas/marketplace.ts`.

---

## Deprecated Route Removal Timeline

| Route prefix                       | Deprecated | Status             | Removal target                  |
| ---------------------------------- | ---------- | ------------------ | ------------------------------- |
| `/api/v1/tenant/hugo-love/*`       | 2025-12-21 | Monitoring traffic | After zero-traffic confirmation |
| `/api/v1/tenant/ask-me-anything/*` | 2025-12-21 | Monitoring traffic | After zero-traffic confirmation |
| `/api/v1/tenant/travel-hub/*`      | 2025-12-21 | Monitoring traffic | After zero-traffic confirmation |

---

## Summary Counts

| Class       | Count           |
| ----------- | --------------- |
| public      | 46              |
| first-party | 33              |
| deprecated  | 3 prefix groups |
