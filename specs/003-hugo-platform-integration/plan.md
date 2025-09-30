
# Implementation Plan: Hugo Platform Integration

**Branch**: `003-hugo-platform-integration` | **Date**: 2025-01-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-hugo-platform-integration/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Build a centralized platform API that enables Hugo Matchmaker and future coaching apps to leverage multi-layered AI intelligence by composing:
1. **Core HugoAI** - Cognitive enhancement capabilities (clarity, bias detection, planning) applied universally
2. **App-Specific Knowledge** - Domain expertise (Intimacy Code for dating, career frameworks, etc.)
3. **User Context** - Conversation history, progress tracking, and personalized memory

**Phase 1 Approach**: Use Supabase PostgreSQL with full-text search for knowledge retrieval, personality schema composition, and user context management. Architecture designed for future migration to semantic vector search without service disruption.

**Key Innovation**: iOS apps that currently bypass the platform (direct OpenAI calls) will be integrated to use the full platform intelligence, while maintaining <3s response times and supporting top-5 app store scale for Hugo Matchmaker.

## Technical Context
**Language/Version**:
- Backend: TypeScript 5.x (Vercel Edge Functions)
- iOS Client: Swift 5.9+ with SwiftUI
- Database: PostgreSQL 15+ (Supabase)

**Primary Dependencies**:
- Supabase (PostgreSQL, Auth, Storage)
- OpenAI/Anthropic SDK for LLM integration
- Existing OrivaPlatformClient (NetworkingKit)
- SwiftUI + Combine for iOS
- Vercel for edge function deployment

**Storage**:
- Supabase PostgreSQL for all structured data (users, apps, conversations, knowledge bases, personality schemas)
- PostgreSQL full-text search (tsvector) for knowledge retrieval
- Future: Vector store (Pinecone/Qdrant) for semantic search (Phase 2)

**Testing**:
- Backend: Jest for TypeScript edge functions
- iOS: XCTest for Swift packages
- Contract tests for API integration
- Integration tests for platform composition

**Target Platform**:
- Backend: Vercel Edge Functions (globally distributed)
- iOS: iOS 16+ (Hugo Matchmaker app)
- Future: macOS 13+, Web browsers (PWA)

**Project Type**: Mobile + API (iOS app + Vercel backend)

**Performance Goals**:
- API response time: <3s end-to-end for coaching messages
- Knowledge retrieval: <1s for full-text search queries
- Concurrent users: Hugo Matchmaker targets top-5 app scale (10k+ concurrent)
- Message throughput: 1000+ messages/minute sustained

**Constraints**:
- Must work with existing OrivaPlatformClient Swift types
- Cannot break current iOS app functionality
- Must support gradual rollout (A/B testing capability)
- Database migration path to vector search must be non-breaking
- SageMaker-style personality schema management required

**Scale/Scope**:
- Initial: Hugo Matchmaker (dating coach) with Intimacy Code knowledge base (~500-1000 principles)
- Future: 3-5 additional coaching apps (career, health, relationships, finance)
- User base: Hugo Matchmaker targeting 100k+ DAU at top-5 ranking
- Knowledge base: 10k+ entries across all apps
- Personality schemas: ~20 schemas (base + overlays)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Constitutional Principles (from CLAUDE.md)

**✅ Swift Package-First**
- OrivaPlatformClient already exists as Swift package in NetworkingKit
- API integration code will extend existing NetworkingKit package
- No new packages required for iOS client integration
- **Status**: COMPLIANT

**✅ SwiftUI Interface**
- Hugo Matchmaker app already uses SwiftUI
- No new UI components required for platform integration (backend work)
- Future: SageMaker-style management UI will use SwiftUI
- **Status**: COMPLIANT (N/A for Phase 1)

**✅ Quality-First**
- Contract tests required before implementation (Phase 1)
- Integration tests for platform composition
- XCTest for Swift, Jest for TypeScript
- **Status**: COMPLIANT (enforced in Phase 1)

**✅ Native Performance**
- <3s response time enforced through performance monitoring
- Knowledge retrieval <1s requirement
- Edge function deployment for global low latency
- **Status**: COMPLIANT (performance requirements defined)

**✅ Multi-Platform Strategy**
- iOS-first implementation (Hugo Matchmaker integration)
- Platform API designed for future macOS/Web clients
- Vercel edge functions support all client types
- **Status**: COMPLIANT

### Complexity Justification

**Backend Technology Choice (TypeScript/Vercel)**:
- *Rationale*: Existing Oriva Platform uses TypeScript/Vercel stack
- *Complexity*: Medium (new codebase but established patterns)
- *Justification*: Consistency with Oriva Platform infrastructure, team familiarity, edge function performance
- *Constitutional Note*: Exempt from Swift Package-First per Constitution v1.0.1 "Platform Infrastructure" exception

**Supabase PostgreSQL (Oriva 101 database)**:
- *Rationale*: Centralized data store for all Hugo intelligence
- *Complexity*: Low (standard SQL with full-text search)
- *Justification*: Simpler than vector store initially, clear migration path

**Multi-Repository Coordination**:
- *Rationale*: Backend and iOS are separate concerns with different teams/cadences
- *Complexity*: Medium (coordination overhead, integration testing complexity)
- *Justification*: Allows backend team to move independently, iOS team to focus on native experience
- *Mitigation*: Explicit coordination documented in REPOSITORIES.md, clear integration contracts

**No Other Constitution Violations Detected**

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 3 (Mobile + API) - iOS app with Vercel backend API

**Rationale**:
- Hugo Matchmaker iOS app already exists with established structure
- Vercel backend will be separate repository (Oriva 101 platform codebase)
- This plan focuses on API design and iOS client integration
- Backend implementation uses existing Oriva platform patterns

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh codex`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

The `/tasks` command will analyze Phase 1 design artifacts to generate a comprehensive, ordered task list following TDD and dependency principles.

**Input Documents**:
1. `data-model.md` - 9 database tables with indexes and constraints
2. `contracts/*.yaml` - 4 OpenAPI specifications (24 endpoints)
3. `quickstart.md` - 6 validation test suites
4. `spec.md` - 43 functional requirements across 8 categories
5. `research.md` - Technical implementation patterns

**Task Categories to Generate**:

1. **Database Tasks** (from data-model.md):
   - [P] Create migration for users table
   - [P] Create migration for apps table
   - [P] Create migration for conversations table
   - [P] Create migration for messages table
   - [P] Create migration for knowledge_bases table
   - [P] Create migration for knowledge_entries table with full-text search
   - [P] Create migration for personality_schemas table
   - [P] Create migration for user_progress table
   - [P] Create migration for user_memories table
   - [P] Create Row-Level Security policies for all tables
   - Verify database schema matches data-model.md specification

2. **Contract Test Tasks** (from contracts/*.yaml):
   - [P] Write contract test for POST /hugo/chat (streaming validation)
   - [P] Write contract test for POST /hugo/knowledge/search (<1s requirement)
   - [P] Write contract test for POST /auth/register (native account)
   - [P] Write contract test for GET /auth/sso (SSO redirect flow)
   - [P] Write contract test for GET /auth/oauth/authorize (OAuth flow)
   - [P] Write contract test for POST /auth/oauth/token (token exchange)
   - [P] Write contract test for GET /hugo/user/progress
   - [P] Write contract test for POST /hugo/user/memory
   - [P] Write contract test for GET /hugo/user/conversations
   - [P] Write contract test for PUT /hugo/user/preferences (data retention)
   - [P] Write contract test for DELETE /hugo/user/account (cascade deletion)
   - Verify all contract tests initially fail (no implementation yet)

3. **Backend Implementation Tasks** (from research.md patterns):
   - Implement Supabase connection pool and configuration
   - Implement JWT authentication middleware
   - Implement rate limiting middleware (5 attempts/hour)
   - Implement POST /hugo/chat endpoint with streaming response
   - Implement multi-layered prompt composition engine (Core → App → User)
   - Implement PostgreSQL full-text search for knowledge retrieval
   - Implement POST /hugo/knowledge/search endpoint (<1s performance)
   - Implement GET /hugo/user/progress endpoint
   - Implement POST /hugo/user/memory endpoint
   - Implement GET /hugo/user/conversations endpoint
   - Implement PUT /hugo/user/preferences endpoint
   - Implement DELETE /hugo/user/account with cascade deletion
   - Implement POST /auth/register endpoint (native account creation)
   - Implement GET /auth/sso endpoint (Oriva SSO redirect)
   - Implement GET /auth/sso/callback endpoint
   - Implement GET /auth/oauth/authorize endpoint (OAuth flow)
   - Implement POST /auth/oauth/token endpoint
   - Implement POST /auth/refresh endpoint (token refresh)
   - Implement personality schema loading and caching (15min TTL)
   - Implement prepared statement optimization for hot paths
   - Configure Vercel Edge Function regions (iad1, sfo1, fra1)

4. **iOS Client Integration Tasks** (from existing NetworkingKit):
   - Update OrivaPlatformClient with new chat endpoint
   - Implement ChatRequest and ChatResponse types
   - Implement streaming response handler for chat
   - Add KnowledgeSearchRequest and KnowledgeSearchResponse types
   - Add UserProgressRequest and UserProgressResponse types
   - Add UserMemoryRequest and UserMemoryResponse types
   - Update authentication flow for multi-modal support
   - Add native account registration flow
   - Add Oriva SSO flow integration
   - Add OAuth social login flow
   - Write XCTest for chat endpoint integration
   - Write XCTest for knowledge search integration
   - Write XCTest for user progress tracking
   - Write XCTest for multi-modal authentication flows

5. **Integration Test Tasks** (from quickstart.md test suites):
   - Write Test 1: Database schema validation (9 tables, indexes, RLS)
   - Write Test 2: Knowledge base search (<1s, relevance scoring)
   - Write Test 3: Multi-layered chat composition (<3s, streaming)
   - Write Test 4: Multi-modal authentication (3 flows)
   - Write Test 5: iOS client integration (Swift async/await)
   - Write Test 6: Performance validation (p95 latency, 100+ concurrent)
   - Implement load testing script with k6
   - Set up performance monitoring and alerting

6. **Documentation and Deployment Tasks**:
   - Create deployment guide for Vercel Edge Functions
   - Document Supabase project setup and configuration
   - Document environment variables and secrets management
   - Create runbook for production monitoring
   - Set up error tracking and logging (Sentry/LogRocket)
   - Configure CI/CD pipeline for automated testing
   - Document rollback procedures for migrations
   - Create architecture decision records (ADRs)

**Ordering Strategy**:

**Phase A: Foundation** (Database + Config)
1. Database migrations (parallel, independent)
2. RLS policies (depends on migrations)
3. Schema validation (depends on migrations)
4. Supabase connection configuration
5. JWT middleware setup

**Phase B: Contract Tests** (TDD Setup)
- All contract tests in parallel (should fail initially)
- Contract tests establish the specification

**Phase C: Backend Implementation** (Make Tests Pass)
1. Authentication endpoints (foundational for all other endpoints)
2. Knowledge search endpoint (independent of chat)
3. Chat endpoint with prompt composition (depends on knowledge search)
4. User management endpoints (parallel, independent)
5. Performance optimization (prepared statements, caching)

**Phase D: iOS Integration**
1. Update OrivaPlatformClient types (parallel with backend if contract tests pass)
2. Implement iOS request/response handlers
3. Write iOS integration tests

**Phase E: Integration Testing**
1. Database validation
2. API integration tests
3. Performance tests
4. End-to-end user journey tests

**Phase F: Deployment & Monitoring**
1. Deployment documentation
2. CI/CD setup
3. Monitoring configuration
4. Production readiness checklist

**Parallelization Opportunities**:
- All database migration tasks are [P] parallel
- All contract test tasks are [P] parallel
- User management endpoints can be implemented in parallel
- iOS type definitions can be created in parallel with backend work
- Documentation can be written in parallel with implementation

**Estimated Task Count**: 85-91 numbered, dependency-ordered tasks (updated from initial 55-65 estimate after detailed design and coverage analysis)

**Success Criteria for Task List**:
- All tasks reference specific files or endpoints from Phase 1
- Clear dependency ordering (sequential where needed, parallel where possible)
- TDD workflow enforced (tests before implementation)
- Performance requirements explicitly stated (<3s chat, <1s search)
- Constitutional compliance maintained throughout
- All 43 functional requirements from spec.md covered

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command) - 62 tasks across 6 phases
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (4 of 5, vector migration deferred to Phase 2)
- [x] Complexity deviations documented (None - all principles compliant)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*
