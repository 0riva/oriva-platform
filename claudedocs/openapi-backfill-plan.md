# OpenAPI Backfill Plan — o-platform

**Produced**: 2026-05-14  
**Branch**: `feat/public-api-contract-hardening`

## Outcome

**Spec coverage is already 100%.** No backfill required.

All 46 public routes identified in `docs/public-api-contract.md` are registered
in `src/openapi/schemas/` and imported via side-effects in `src/openapi/spec.ts`.

## Coverage Map

| Domain                                           | Public routes | Schema file                          | Status       |
| ------------------------------------------------ | ------------- | ------------------------------------ | ------------ |
| auth                                             | 8             | `src/openapi/schemas/auth.ts`        | ✅ 100%      |
| user + analytics                                 | 2             | `src/openapi/schemas/user.ts`        | ✅ 100%      |
| profiles                                         | 4             | `src/openapi/schemas/profiles.ts`    | ✅ 100%      |
| groups                                           | 2             | `src/openapi/schemas/groups.ts`      | ✅ 100%      |
| sessions + team                                  | 3             | `src/openapi/schemas/sessions.ts`    | ✅ 100%      |
| entries + templates + storage + ui/notifications | 4             | `src/openapi/schemas/entries.ts`     | ✅ 100%      |
| marketplace                                      | 13            | `src/openapi/schemas/marketplace.ts` | ✅ 100%      |
| developer                                        | 7             | `src/openapi/schemas/developer.ts`   | ✅ 100%      |
| events                                           | 3             | `src/openapi/schemas/events.ts`      | ✅ 100%      |
| **Total**                                        | **46**        | 9 schema files                       | **✅ 46/46** |

## OpenAPI JSON stat

`claudedocs/openapi-snapshot.json` — 40 path entries (paths with multiple
methods count as one path entry in the JSON). Validated clean by
`@apidevtools/swagger-cli`.

## Note on path count discrepancy

`docs:check` reports 46 spec paths because it counts method+path combinations.
The OpenAPI JSON has 40 path keys because POST and GET on the same path (e.g.
`/api/oriva/events`, `/api/v1/marketplace/search`) share a single path entry.
Both numbers are correct and consistent.
