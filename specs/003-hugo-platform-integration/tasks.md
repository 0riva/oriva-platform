# Tasks: Hugo Platform Integration

**Feature**: 003-hugo-platform-integration
**Branch**: `003-hugo-platform-integration`
**Input**: Design documents from `/specs/003-hugo-platform-integration/`
**Prerequisites**: ✅ plan.md, research.md, data-model.md, contracts/, quickstart.md

## Execution Summary

**Total Tasks**: 85 numbered tasks across 6 phases (updated after /analyze coverage review)
**Estimated Duration**: 4-5 weeks
**Parallelization Opportunities**: 50 tasks marked [P]
**Critical Path**: Database migrations → Contract tests → Backend implementation → iOS integration → Performance validation

**Project Structure**: Mobile + API (iOS app + Vercel backend)
- Backend: `oriva-platform/api/` (TypeScript/Vercel Edge Functions)
- iOS Client: `oo-ios/Platform/NetworkingKit/` (Swift 5.9+)
- Database: Supabase PostgreSQL migrations

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions
- Performance requirements noted where applicable

---

## Phase 3.1: Foundation Setup

### Database Schema & Configuration

- [x] **T001** [P] Create Supabase migration for `users` table in `oriva-platform/supabase/migrations/20250114000001_create_users.sql`
- [x] **T002** [P] Create Supabase migration for `apps` table in `oriva-platform/supabase/migrations/20250114000002_create_apps.sql`
- [x] **T003** [P] Create Supabase migration for `conversations` table in `oriva-platform/supabase/migrations/20250114000003_create_conversations.sql`
- [x] **T004** [P] Create Supabase migration for `messages` table in `oriva-platform/supabase/migrations/20250114000004_create_messages.sql`
- [x] **T005** [P] Create Supabase migration for `knowledge_bases` table in `oriva-platform/supabase/migrations/20250114000005_create_knowledge_bases.sql`
- [x] **T006** [P] Create Supabase migration for `knowledge_entries` table with full-text search in `oriva-platform/supabase/migrations/20250114000006_create_knowledge_entries.sql`
- [x] **T007** [P] Create Supabase migration for `personality_schemas` table in `oriva-platform/supabase/migrations/20250114000007_create_personality_schemas.sql`
- [x] **T008** [P] Create Supabase migration for `user_progress` table in `oriva-platform/supabase/migrations/20250114000008_create_user_progress.sql`
- [x] **T009** [P] Create Supabase migration for `user_memories` table in `oriva-platform/supabase/migrations/20250114000009_create_user_memories.sql`
- [x] **T010** Create Row-Level Security policies for all tables in `oriva-platform/supabase/migrations/20250114000010_create_rls_policies.sql` (depends on T001-T009)
- [x] **T011** Create prepared statements for hot paths in `oriva-platform/supabase/migrations/20250114000011_create_prepared_statements.sql` (depends on T001-T009)

### Backend Configuration

- [x] **T012** [P] Create Supabase connection configuration in `oriva-platform/api/lib/supabase.ts`
- [x] **T013** [P] Create JWT authentication middleware in `oriva-platform/api/middleware/auth.ts`
- [x] **T014** [P] Create rate limiting middleware in `oriva-platform/api/middleware/rateLimit.ts`
- [x] **T015** [P] Create error handling middleware in `oriva-platform/api/middleware/errorHandler.ts`
- [x] **T016** [P] Configure Vercel Edge Function regions in `oriva-platform/vercel.json`

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoint Specifications)

- [x] **T017** [P] Contract test for POST /hugo/chat (streaming validation, <3s requirement) in `oriva-platform/tests/contract/hugoChatPost.test.ts`
- [x] **T018** [P] Contract test for POST /hugo/knowledge/search (<1s requirement) in `oriva-platform/tests/contract/hugoKnowledgeSearchPost.test.ts`
- [x] **T019** [P] Contract test for POST /auth/register (native account creation) in `oriva-platform/tests/contract/authRegisterPost.test.ts`
- [x] **T020** [P] Contract test for GET /auth/sso (SSO redirect flow) in `oriva-platform/tests/contract/authSsoGet.test.ts`
- [x] **T021** [P] Contract test for GET /auth/sso/callback in `oriva-platform/tests/contract/authSsoCallbackGet.test.ts`
- [x] **T022** [P] Contract test for GET /auth/oauth/authorize (OAuth flow) in `oriva-platform/tests/contract/authOauthAuthorizeGet.test.ts`
- [x] **T023** [P] Contract test for POST /auth/oauth/token (token exchange) in `oriva-platform/tests/contract/authOauthTokenPost.test.ts`
- [x] **T024** [P] Contract test for POST /auth/refresh in `oriva-platform/tests/contract/authRefreshPost.test.ts`
- [x] **T025** [P] Contract test for GET /hugo/user/progress in `oriva-platform/tests/contract/hugoUserProgressGet.test.ts`
- [x] **T026** [P] Contract test for PUT /hugo/user/progress in `oriva-platform/tests/contract/hugoUserProgressPut.test.ts`
- [x] **T027** [P] Contract test for POST /hugo/user/memory in `oriva-platform/tests/contract/hugoUserMemoryPost.test.ts`
- [x] **T028** [P] Contract test for GET /hugo/user/memory in `oriva-platform/tests/contract/hugoUserMemoryGet.test.ts`
- [x] **T029** [P] Contract test for GET /hugo/user/conversations in `oriva-platform/tests/contract/hugoUserConversationsGet.test.ts`
- [x] **T030** [P] Contract test for GET /hugo/user/conversations/{id}/messages in `oriva-platform/tests/contract/hugoUserConversationMessagesGet.test.ts`
- [x] **T031** [P] Contract test for GET /hugo/user/preferences in `oriva-platform/tests/contract/hugoUserPreferencesGet.test.ts`
- [x] **T032** [P] Contract test for PUT /hugo/user/preferences (data retention) in `oriva-platform/tests/contract/hugoUserPreferencesPut.test.ts`
- [x] **T033** [P] Contract test for DELETE /hugo/user/account (cascade deletion) in `oriva-platform/tests/contract/hugoUserAccountDelete.test.ts`
- [x] **T034** Verify all contract tests fail (no implementation exists yet)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Authentication Endpoints (Foundational)

- [x] **T035** Implement POST /auth/register endpoint with Oriva 101 account creation in `oriva-platform/api/auth/register.ts` (depends on T013, T019)
- [x] **T036** Implement GET /auth/sso endpoint with Oriva SSO redirect in `oriva-platform/api/auth/sso.ts` (depends on T013, T020)
- [x] **T037** Implement GET /auth/sso/callback endpoint in `oriva-platform/api/auth/sso/callback.ts` (depends on T036, T021)
- [x] **T038** Implement GET /auth/oauth/authorize endpoint in `oriva-platform/api/auth/oauth/authorize.ts` (depends on T013, T022)
- [x] **T039** Implement POST /auth/oauth/token endpoint in `oriva-platform/api/auth/oauth/token.ts` (depends on T038, T023)
- [x] **T040** Implement POST /auth/refresh endpoint in `oriva-platform/api/auth/refresh.ts` (depends on T013, T024)

### Knowledge & AI Services

- [x] **T041** [P] Implement PostgreSQL full-text search service in `oriva-platform/api/services/knowledgeSearch.ts` (depends on T006, T012)
- [x] **T042** [P] Implement personality schema loader with 15min cache in `oriva-platform/api/services/personalityLoader.ts` (depends on T007, T012)
- [x] **T043** Implement multi-layered prompt composition engine (Core → App → User) in `oriva-platform/api/services/promptComposer.ts` (depends on T041, T042)
- [x] **T044** Implement POST /hugo/knowledge/search endpoint (<1s performance) in `oriva-platform/api/hugo/knowledge/search.ts` (depends on T041, T018)
- [x] **T045** Implement POST /hugo/chat endpoint with streaming response in `oriva-platform/api/hugo/chat.ts` (depends on T043, T044, T017)

### User Management Endpoints

- [x] **T046** [P] Implement GET /hugo/user/progress endpoint in `oriva-platform/api/hugo/user/progress.ts` (depends on T013, T025)
- [x] **T047** [P] Implement PUT /hugo/user/progress endpoint in `oriva-platform/api/hugo/user/progress.ts` (depends on T046, T026)
- [x] **T048** [P] Implement POST /hugo/user/memory endpoint in `oriva-platform/api/hugo/user/memory.ts` (depends on T013, T027)
- [x] **T049** [P] Implement GET /hugo/user/memory endpoint in `oriva-platform/api/hugo/user/memory.ts` (depends on T048, T028)
- [x] **T050** [P] Implement GET /hugo/user/conversations endpoint in `oriva-platform/api/hugo/user/conversations.ts` (depends on T013, T029)
- [x] **T051** [P] Implement GET /hugo/user/conversations/{id}/messages endpoint in `oriva-platform/api/hugo/user/conversations/[id]/messages.ts` (depends on T050, T030)
- [x] **T052** [P] Implement GET /hugo/user/preferences endpoint in `oriva-platform/api/hugo/user/preferences.ts` (depends on T013, T031)
- [x] **T053** [P] Implement PUT /hugo/user/preferences endpoint (data retention settings) in `oriva-platform/api/hugo/user/preferences.ts` (depends on T052, T032)
- [x] **T054** [P] Implement DELETE /hugo/user/account endpoint with cascade deletion in `oriva-platform/api/hugo/user/account.ts` (depends on T013, T033)

---

## Phase 3.4: iOS Client Integration

### NetworkingKit Extensions (Swift)

- [x] **T055** [P] Add ChatRequest and ChatResponse types in `oo-ios/Platform/NetworkingKit/Sources/NetworkingKit/Models/ChatModels.swift`
- [x] **T056** [P] Add KnowledgeSearchRequest and KnowledgeSearchResponse types in `oo-ios/Platform/NetworkingKit/Sources/NetworkingKit/Models/KnowledgeModels.swift`
- [x] **T057** [P] Add UserProgressRequest and UserProgressResponse types in `oo-ios/Platform/NetworkingKit/Sources/NetworkingKit/Models/UserProgressModels.swift`
- [x] **T058** [P] Add UserMemoryRequest and UserMemoryResponse types in `oo-ios/Platform/NetworkingKit/Sources/NetworkingKit/Models/UserMemoryModels.swift`
- [x] **T059** Implement streaming chat response handler in `oo-ios/Platform/NetworkingKit/Sources/NetworkingKit/Services/ChatService.swift` (depends on T055)
- [x] **T060** Update OrivaPlatformClient with multi-modal auth support in `oo-ios/Platform/NetworkingKit/Sources/NetworkingKit/OrivaPlatformClient.swift` (depends on T035-T040)

### iOS Integration Tests (XCTest)

- [x] **T061** [P] Write XCTest for chat endpoint with streaming in `oo-ios/Platform/NetworkingKit/Tests/NetworkingKitTests/ChatServiceTests.swift` (depends on T059)
- [x] **T062** [P] Write XCTest for knowledge search integration in `oo-ios/Platform/NetworkingKit/Tests/NetworkingKitTests/KnowledgeSearchTests.swift` (depends on T056)

---

## Phase 3.5: Data Retention & User Preferences

### iOS Data Retention Settings

- [x] **T063** [P] Create DataRetentionPreferences model in `oo-ios/Platform/OrivaCore/Sources/OrivaCore/Models/DataRetentionPreferences.swift`
- [x] **T064** Create DataRetentionSettingsView in `oo-ios/Apps/HugoMatchmaker/Sources/Views/Settings/DataRetentionSettingsView.swift` (depends on T063)
- [x] **T065** Implement sync with Oriva Platform in `oo-ios/Platform/NetworkingKit/Sources/NetworkingKit/Services/PreferencesSync.swift` (depends on T052-T053, T063)
- [x] **T066** Write XCTest for preferences sync in `oo-ios/Platform/NetworkingKit/Tests/NetworkingKitTests/PreferencesSyncTests.swift` (depends on T065)

---

## Phase 3.6: Scaling & Infrastructure

### Backend Scaling Configuration (oriva-platform)

- [x] **T067** [P] Configure Vercel Edge Function auto-scaling in `oriva-platform/vercel.json` (regions: iad1, sfo1, fra1, concurrency limits)
- [x] **T068** [P] Configure Oriva 101 connection pooling in `oriva-platform/api/config/supabase.ts` (max connections, timeout, retry logic)
- [x] **T069** [P] Implement database connection pool monitoring in `oriva-platform/api/lib/dbMonitor.ts`
- [x] **T070** [P] Configure CDN caching for personality schemas in `oriva-platform/vercel.json` (15min TTL, stale-while-revalidate)
- [x] **T071** Implement rate limiting per user in `oriva-platform/api/middleware/userRateLimit.ts` (depends on T014)
- [x] **T072** Document scaling runbook in `oriva-platform/docs/SCALING.md` (scaling triggers, monitoring dashboards, incident response)

---

## Phase 3.7: Performance Monitoring & Observability

### Backend Monitoring Setup (oriva-platform)

- [x] **T073** [P] Set up Vercel Analytics integration in `oriva-platform/vercel.json`
- [x] **T074** [P] Configure Sentry error tracking in `oriva-platform/api/lib/sentry.ts`
- [x] **T075** [P] Implement custom performance metrics in `oriva-platform/api/lib/metrics.ts` (chat response time, knowledge search latency, token usage)
- [x] **T076** Create performance dashboard queries in `oriva-platform/supabase/functions/analytics/performance-dashboard.sql`
- [x] **T077** Configure alerting rules in `oriva-platform/api/lib/alerts.ts` (p95 > 3s, error rate > 1%, knowledge search > 1s)
- [x] **T078** Implement load testing script with k6 in `oriva-platform/tests/load/chat-load-test.js` (100+ concurrent users, 1000 msg/min)
- [x] **T079** Document monitoring runbook in `oriva-platform/docs/MONITORING.md` (dashboards, alert response, performance SLOs)

---

## Phase 3.8: Documentation & Deployment Readiness

### Production Documentation (oriva-platform)

- [x] **T080** [P] Create deployment guide in `oriva-platform/docs/DEPLOYMENT.md` (Vercel setup, environment variables, Oriva 101 configuration)
- [x] **T081** [P] Document environment variables in `oriva-platform/docs/ENVIRONMENT.md` (all required secrets, API keys, connection strings)
- [x] **T082** [P] Create architecture decision records in `oriva-platform/docs/adr/` (6 comprehensive ADRs documenting key architectural decisions)
- [x] **T083** [P] Document rollback procedures in `oriva-platform/docs/ROLLBACK.md` (database migrations, API deployments, emergency procedures)
- [x] **T084** Configure CI/CD pipeline in `oriva-platform/.github/workflows/ci-cd.yml` (test → staging → production with health checks)
- [x] **T085** Create production readiness checklist in `oriva-platform/docs/PRODUCTION_READINESS.md` (depends on T080-T084)

---

## Dependencies

### Critical Path
```
T001-T011 (Database) → T017-T034 (Contract Tests) → T035-T040 (Auth) → T045 (Chat) → T059-T061 (iOS) → T078 (Load Testing)
```

### Parallel Execution Groups

**Group 1: Database Migrations** (9 parallel tasks)
- T001-T009 can all run in parallel (independent table creations)

**Group 2: Backend Config** (5 parallel tasks)
- T012-T016 can all run in parallel (independent configuration files)

**Group 3: Contract Tests** (17 parallel tasks)
- T017-T033 can all run in parallel (different test files, should all fail initially)

**Group 4: User Management** (9 parallel tasks after auth)
- T046-T054 can run in parallel after T035-T040 (authentication) is complete

**Group 5: iOS Types** (4 parallel tasks)
- T055-T058 can run in parallel (independent model files)

**Group 6: iOS Tests** (2 parallel tasks after implementation)
- T061-T062 can run in parallel after T059-T060

**Group 7: Data Retention** (1 parallel task for model)
- T063 independent [P], T064-T066 sequential after T063

**Group 8: Scaling Config** (4 parallel tasks)
- T067-T070 can run in parallel [P]

**Group 9: Monitoring Setup** (3 parallel tasks)
- T073-T075 can run in parallel [P]

**Group 10: Documentation** (4 parallel tasks)
- T080-T083 can run in parallel [P]

### Sequential Dependencies
- T010-T011 depend on T001-T009 (RLS policies need tables)
- T034 depends on T017-T033 (verification after all tests written)
- T035-T040 depend on T013 (auth middleware required)
- T041-T043 depend on T006, T007, T012 (database tables and config)
- T044-T045 depend on T041-T043 (AI services)
- T046-T054 depend on T013 (auth middleware)
- T059 depends on T055 (chat types)
- T060 depends on T035-T040 (auth endpoints)
- T061-T062 depend on T059-T060 (implementation complete)
- T064-T066 depend on T063 (data retention model)
- T065 depends on T052-T053 (backend preferences endpoints)
- T071 depends on T014 (rate limit middleware)
- T076-T077 depend on T073-T075 (monitoring infrastructure)
- T084 depends on T001-T011 (database migrations for CI/CD)
- T085 depends on T080-T084 (aggregates all readiness docs)

---

## Validation Checklist
*GATE: Complete before marking phase done*

### Phase 3.1: Foundation
- [ ] All 9 database tables created in Supabase
- [ ] RLS policies active on all sensitive tables
- [ ] GIN indexes created for full-text search
- [ ] Prepared statements optimize hot paths
- [ ] Backend middleware configured and tested

### Phase 3.2: Tests
- [ ] All 17 contract tests written
- [ ] All contract tests FAIL (no implementation yet)
- [ ] Test coverage includes performance requirements (<3s, <1s)
- [ ] Test coverage includes all 24 API endpoints from contracts

### Phase 3.3: Implementation
- [ ] All contract tests PASS
- [ ] Authentication supports 3 flows (native, SSO, OAuth)
- [ ] Chat endpoint streams responses <3s
- [ ] Knowledge search completes <1s
- [ ] Multi-layered prompt composition working (Core → App → User)
- [ ] Data retention settings configurable by users
- [ ] Account deletion cascades properly

### Phase 3.4: iOS Integration
- [ ] NetworkingKit types match API contracts
- [ ] Streaming chat response handler works with async/await
- [ ] All iOS integration tests pass
- [ ] Multi-modal auth flows work from iOS

### Phase 3.5: Data Retention
- [ ] iOS data retention settings UI implemented
- [ ] Preferences sync with Oriva Platform backend
- [ ] XCTest for sync functionality passes

### Phase 3.6: Scaling
- [ ] Vercel auto-scaling configured for target regions
- [ ] Oriva 101 connection pooling optimized
- [ ] CDN caching configured for static assets
- [ ] Rate limiting per user implemented
- [ ] Scaling runbook documented

### Phase 3.7: Monitoring
- [ ] Vercel Analytics and Sentry integrated
- [ ] Custom performance metrics tracking
- [ ] Alert rules configured for SLO violations
- [ ] Load testing validates 100+ concurrent users
- [ ] Monitoring runbook documented

### Phase 3.8: Deployment Readiness
- [ ] Deployment guide complete
- [ ] Environment variables documented
- [ ] Architecture decision records created
- [ ] Rollback procedures documented
- [ ] CI/CD pipeline configured
- [ ] Production readiness checklist passed

---

## Performance Requirements

**Must Validate**:
- POST /hugo/chat: <3s end-to-end response time (p95)
- POST /hugo/knowledge/search: <1s query execution (p95)
- Concurrent users: 100+ without degradation
- Error rate: <0.1%

**Monitoring**:
- Set up performance tracking in T075 (custom metrics)
- Set up query time tracking in T044 (knowledge search implementation)
- Alert configuration in T077 (automated threshold monitoring)
- Load test in T078 (validates 100+ concurrent users)

---

## Quick Reference

**Backend Path**: `oriva-platform/api/`
**iOS Path**: `oo-ios/Platform/NetworkingKit/`
**Database**: `oriva-platform/supabase/migrations/`
**Tests**: `oriva-platform/tests/contract/`

**Branch**: `003-hugo-platform-integration`
**Jira/Tracking**: Link to project tracker if applicable

---

## Notes

- [P] tasks = different files, no dependencies, safe for parallel execution
- Verify contract tests fail before implementing (Phase 3.2 → 3.3)
- Commit after each task or logical group
- Run `npm test` frequently during Phase 3.3
- Follow quickstart.md validation after Phase 3.8
- Performance requirements are non-negotiable (<3s chat, <1s search)
- Multi-repository coordination: See REPOSITORIES.md for backend/iOS sync points

**Constitution Compliance**: All tasks maintain constitutional principles per v1.0.1:
- Swift Package-First: iOS features use NetworkingKit package
- Platform Infrastructure Exception: Backend TypeScript work exempt
- SwiftUI Interface: iOS UI (T064) follows SwiftUI/accessibility
- Quality-First: TDD enforced (contract tests before implementation)
- Native Performance: <3s chat, <1s search requirements
- Multi-Platform Strategy: iOS-first with backend API supporting future platforms

**Terminology**:
- "Hugo Matchmaker" = user-facing product name
- "HugoApp" = code/directory name
- "Oriva Platform" = backend API (TypeScript/Vercel)
- "Oriva 101" = Supabase database name