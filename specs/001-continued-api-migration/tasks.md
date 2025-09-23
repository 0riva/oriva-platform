# Tasks: Continued API Migration

**Input**: Phase 1 design docs from `specs/001-continued-api-migration/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/api-types.ts, quickstart.md

## Execution Flow (main)
```
1. Load plan.md, data-model.md, contracts/api-types.ts
   → Extract TypeScript migration goals, entity list, success metrics
2. Inspect api/tsconfig.json and package.json for compiler + dependency gaps
   → Queue updates for strict mode readiness and type packages
3. Map Express middleware/endpoints in api/index.ts to planned type modules
4. Identify Supabase query hotspots requiring typed wrappers
5. Align Jest suites (tests/typescript, tests/api) to fail first for new type guarantees
6. Generate ordered tasks per category (Setup → Tests → Implementation → Integration → Validation)
   → Mark [P] only when files do not overlap
7. Build dependency graph so type exports land before endpoint refactors
8. Provide parallel execution guidance for independent type files
9. Return: SUCCESS (tasks ready for implementation)
```

## Phase 3.1: Setup
- [x] T001 Create TypeScript type directories in `api/types/` (api/, database/, middleware/, errors/) and add an export barrel stub in `api/types/index.ts` aligned with Phase 1 contracts.
- [x] T002 Update `api/tsconfig.json` with `baseUrl`, path aliases for `@api/*`, nodenext module resolution, incremental builds, and ensure emit targets `dist/` to prepare for strict mode.
- [x] T003 Refresh type dependencies in the root `package.json` (`@types/express`, `@types/cors`, `@types/node`, `@types/winston`, add `@types/jest` and `ts-node-dev`) and regenerate `package-lock.json` with `npm install`.

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
- [x] T004 [P] Extend `tests/typescript/migration.test.js` to import from `api/types/index.ts` and fail until `ApiResponse`, `AuthenticatedRequest`, and `DatabaseQueryResult` exports exist.
- [x] T005 [P] Update `tests/api/auth.test.js` to assert error payloads expose typed `{ success, code, message, details }` per the new `ErrorResponse` contract (fails until middleware returns structured errors).
- [x] T006 [P] Update `tests/api/marketplace.test.js` to expect typed marketplace responses (`status` union, developer metadata, pagination meta) matching forthcoming `MarketplaceApp` definitions.

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [x] T007 Port `ApiResponse`, `PaginatedResponse`, and `ErrorResponse` into `api/types/api/responses.ts` using the contracts file as source of truth.
- [x] T008 [P] Create `api/types/middleware/auth.ts` with `ApiKeyInfo`, `AuthenticatedRequest`, `ApiMiddleware`, and helper guards for API key context.
- [x] T009 [P] Create `api/types/database/entities.ts` defining `Profile`, `Group`, `GroupMember`, `Entry`, and shared enums exactly matching Supabase schema.
- [x] T010 [P] Create `api/types/database/marketplace.ts` covering `DeveloperApiKey`, `MarketplaceApp`, external ID helpers, and status/type unions.
- [x] T011 [P] Create `api/types/errors/index.ts` with `ApiError`, `ValidationError`, `AuthenticationError`, `DatabaseError`, and factory helpers for consistent responses.
- [x] T012 Update `api/types/index.ts` to export all new type modules and provide named exports for downstream imports.
- [x] T013 Refactor `api/index.ts` top-level to use ES module imports, typed constants, and export the typed Express app/handler instead of `module.exports`.
- [x] T014 Build typed authentication middleware in `api/middleware/auth.ts`, porting hash/lookup logic with `AuthenticatedRequest`, `ApiKeyInfo` annotations.
- [x] T015 Replace inline auth in `api/index.ts` with the new middleware, update handler signatures to consume `AuthenticatedRequest`, and ensure rate limiter + admin guard typings compile.
- [x] T016 Annotate `/api/v1/profiles/*` handlers in `api/index.ts` with `Profile` types, typed Supabase results, and `ApiResponse<Profile>` wrappers.
- [x] T017 Annotate group endpoints in `api/index.ts` with `Group`/`GroupMember` types, including typed pagination via `PaginatedResponse`.
- [x] T018 Annotate entry endpoints in `api/index.ts` with `Entry` types and enforce `audience_type` enums through compile-time checks.
- [x] T019 Annotate marketplace endpoints in `api/index.ts` with `MarketplaceApp` + `DeveloperApiKey` types and typed filter/sort helpers.
- [x] T020 Introduce typed error middleware in `api/middleware/error-handler.ts` returning `ErrorResponse` structures and wire it into `api/index.ts`.
- [x] T021 Implement `api/services/database.ts` to expose typed Supabase helpers returning `DatabaseQueryResult<T>` and refactor `api/index.ts` queries to use the service.

## Phase 3.4: Integration & Hardening
- [x] T022 Enable `strict`, `noImplicitAny`, and `strictNullChecks` in `api/tsconfig.json`, then resolve all compiler errors revealed across `api/**/*.ts`.
- [x] T023 Update the root `package.json` to make TypeScript the default workflow (`dev` → `npm run dev:ts`, coverage globs include `.ts`, lint targets `.ts`), and adjust Jest `collectCoverageFrom` for `.ts` sources.
- [x] T024 Refresh developer documentation in `docs/developer-guides/README.md` and `specs/001-continued-api-migration/quickstart.md` with TypeScript-first workflow, scripts, and type-safety guidelines.

## Phase 3.5: Validation & Sign-off
- [x] T025 Run `npm run type-check`, `npm test`, `npm run test:coverage`, and targeted performance probes (<200ms) documenting results for the migration sign-off.

## Dependencies
- T001 → T002 → T003 → T004-T021 (type scaffolding and deps before tests and implementation)
- T004-T006 must pass before T007-T021 begin (tests fail-first)
- T007-T012 precede T013+ (type exports before consumption)
- T013 → T014 → T015 → T016-T021 (sequential `api/index.ts` refactors)
- T021 → T022 → T023 → T024 → T025 (service + strict mode before validation and docs)

## Parallel Example
```
# After T007 completes, run these in parallel:
Task: "T008 Create api/types/middleware/auth.ts with ApiKeyInfo and AuthenticatedRequest"
Task: "T009 Create api/types/database/entities.ts with Profile/Group/Entry"
Task: "T010 Create api/types/database/marketplace.ts with DeveloperApiKey + MarketplaceApp"
Task: "T011 Create api/types/errors/index.ts with typed error hierarchy"
```

## Notes
- [P] tasks touch disjoint files—changing scope requires clearing the [P] flag.
- Keep tests failing until corresponding implementation task completes to honor TDD.
- Ensure Supabase environment variables remain untouched; migration focuses on TypeScript safety.
- Commit after each task to simplify regression tracking.
