# Feature Specification: Hugo Platform Integration with Supabase Knowledge Management

**Feature Branch**: `003-hugo-platform-integration`
**Created**: 2025-01-14
**Status**: Draft
**Input**: User description: "Hugo Platform Integration with Supabase Knowledge Management - Build centralized platform API that composes Core HugoAI cognitive enhancement with app-specific knowledge bases (starting with Hugo Matchmaker's Intimacy Code), using Supabase for structured data and PostgreSQL full-text search for knowledge retrieval, with clear migration path to vector search later."

## Execution Flow (main)
```
1. Parse user description from Input
   � Extracted: Platform integration for multi-layered AI coaching system
2. Extract key concepts from description
   � Actors: Users, Hugo Matchmaker app, Core HugoAI, App-specific coaches
   � Actions: Chat interactions, knowledge retrieval, personality composition, memory storage
   � Data: User profiles, conversation history, knowledge bases, personality schemas
   � Constraints: Phase 1 uses PostgreSQL full-text search, must support vector migration later
3. For each unclear aspect:
   � [NEEDS CLARIFICATION: What triggers migration from full-text to vector search?]
   � [NEEDS CLARIFICATION: How are personality schemas updated after deployment?]
   � [NEEDS CLARIFICATION: User data retention and deletion policies?]
4. Fill User Scenarios & Testing section
   � Primary: User has coaching conversation enhanced by layered intelligence
5. Generate Functional Requirements
   � Platform must compose multiple knowledge layers
   � System must support multiple coaching apps
   � Search must work with PostgreSQL initially
6. Identify Key Entities
   � Apps, Users, Conversations, Knowledge Bases, Personality Schemas, Memories
7. Receive stakeholder clarifications
   → Personality schemas: SageMaker-style management interface
   → Data retention: User-configurable in Oriva settings
   → Scale: Hugo Matchmaker top 5 target, others moderate
   → Auth: Multi-modal (SSO, native creation, social login)
8. Run Review Checklist
   → SUCCESS: 4 of 5 clarifications resolved
   → DEFER: Vector search migration triggers (Phase 2 decision)
9. Return: SUCCESS (spec ready for planning phase)
```

---

## � Quick Guidelines
-  Focus on WHAT users need and WHY
- L Avoid HOW to implement (no tech stack, APIs, code structure)
- =e Written for business stakeholders, not developers

---

## Terminology Guide

### Product vs. Code Names
- **"Hugo Matchmaker"**: User-facing product name (marketing, App Store, user documentation)
- **"HugoApp"**: Code/directory name (Xcode project, package names, file paths)
- **Usage**: Use "Hugo Matchmaker" in requirements and user stories; use "HugoApp" in technical tasks and code references

### Platform & Database Names
- **"Oriva Platform"**: The Oriva API/backend infrastructure (TypeScript/Vercel)
- **"Oriva 101"**: Supabase database name (used in connection strings, migrations, database contexts)
- **Usage**: Use "Oriva Platform" for API/backend references; use "Oriva 101" for database-specific operations

### AI Intelligence Layers
- **"Core HugoAI"**: Base cognitive enhancement intelligence layer (clarity, bias detection, planning)
- **"App-specific knowledge"**: Domain expertise (e.g., Intimacy Code for dating, career frameworks)
- **"User context"**: Conversation history, progress tracking, personalized memory

---

## User Scenarios & Testing

### Primary User Story
Sarah downloads Hugo Matchmaker to improve her dating confidence. When she asks Hugo "How do I show vulnerability without seeming weak?", the system:

1. Recognizes she's using Hugo Matchmaker (dating coach context)
2. Applies Core HugoAI's cognitive enhancement capabilities (clarity, bias detection, planning)
3. Retrieves relevant Intimacy Code principles from Hugo Matchmaker's knowledge base
4. Recalls Sarah's previous conversations and progress in learning the framework
5. Responds with personalized guidance that combines general cognitive support with dating-specific expertise

The response feels tailored to her learning journey, references concepts she's already learned, and introduces new principles at the right pace.

### Acceptance Scenarios

**Scenario 1: First-Time User Conversation**
- **Given** a new user starts their first conversation in Hugo Matchmaker
- **When** they ask "How do I start a conversation with someone I'm interested in?"
- **Then** the system responds with:
  - Core HugoAI cognitive enhancement (clarity, planning structure)
  - Intimacy Code principles relevant to initiating connection
  - No reference to previous conversations (none exist)
  - Warm, coaching tone specific to dating domain

**Scenario 2: Returning User with Conversation History**
- **Given** a user has had 5 previous conversations about building confidence
- **When** they ask "I'm ready to try approaching someone - what should I remember?"
- **Then** the system responds with:
  - References to principles discussed in previous conversations
  - Recognition of their progress ("You've been working on authentic self-expression")
  - Personalized advice building on their learning journey
  - Encouragement based on their stated goals

**Scenario 3: Cross-App User Experience**
- **Given** a user has profiles in both Hugo Matchmaker and Hugo Career (future app)
- **When** they switch between apps
- **Then** each app maintains:
  - Separate conversation history appropriate to each domain
  - Separate progress tracking (dating coach vs. career coach)
  - Shared user preferences (notification settings, subscription tier)
  - Consistent Core HugoAI cognitive enhancement in both contexts

**Scenario 4: Knowledge Base Query Without Exact Match**
- **Given** the knowledge base contains "Principle 1: Authentic Vulnerability"
- **When** user asks "How can I be more open without oversharing?"
- **Then** the system:
  - Finds relevant content using text search (keywords: open, sharing, authentic)
  - Returns guidance from Intimacy Code principles
  - Provides helpful response even without exact keyword match

**Scenario 5: App-Specific Personality Consistency**
- **Given** Hugo Matchmaker has a "warm, supportive dating coach" personality
- **When** users interact across multiple sessions over weeks
- **Then** the tone, style, and approach remain consistent with the dating coach personality

**Scenario 6: Native iOS User Account Creation**
- **Given** a user downloads Hugo Matchmaker from the App Store without an Oriva account
- **When** they create an account in the app
- **Then** the system:
  - Creates a new Oriva 101 account for them automatically
  - Enables them to use Oriva SSO for future logins
  - Allows them to discover other Oriva apps via the marketplace

**Scenario 7: Oriva Auth Social Login**
- **Given** a user wants to sign in to Hugo Matchmaker
- **When** they choose "Sign in with Oriva"
- **Then** they can authenticate using their existing Oriva account (like "Sign in with GitHub")
- **And** gain access to all Oriva platform features and app marketplace

### Edge Cases

**Knowledge Retrieval Edge Cases:**
- What happens when a user's question has no relevant matches in the knowledge base?
  - System should fall back to Core HugoAI cognitive support without domain-specific advice
  - Should acknowledge when answering outside specialized domain

- What happens when multiple knowledge base entries are equally relevant?
  - System should synthesize information from multiple sources
  - Should maintain coherent response without overwhelming detail

**User Context Edge Cases:**
- What happens when conversation history becomes very long (100+ messages)?
  - System must limit context window to recent and most relevant messages
  - Should maintain continuity despite selective history

- What happens when a user deletes their account?
  - All user-specific data (conversations, progress, memories) must be removed
  - App configurations and knowledge bases remain for other users

**Multi-App Edge Cases:**
- What happens when personality schemas conflict between Core HugoAI and app-specific layers?
  - App-specific personality should take precedence for tone and style
  - Core HugoAI cognitive principles should always apply underneath

**Search Migration Edge Cases:**
- What happens when the platform transitions from full-text search to vector search?
  - Existing conversations should not be disrupted
  - Users should see improved relevance without service interruption
  - [NEEDS CLARIFICATION: Is this a gradual rollout or instant switchover?]

**Performance Edge Cases:**
- What happens when knowledge base grows to thousands of entries?
  - Search must remain responsive (under 2 seconds)
  - Results must stay relevant as scale increases
  - [NEEDS CLARIFICATION: What is the expected maximum knowledge base size?]

---

## Requirements

### Functional Requirements

**Core Platform Composition:**
- **FR-001**: System MUST compose responses using multiple intelligence layers: Core HugoAI (cognitive enhancement) + App-specific knowledge (e.g., Intimacy Code) + User context (memory, progress)
- **FR-002**: System MUST apply Core HugoAI cognitive enhancement capabilities to all coaching interactions regardless of app
- **FR-003**: System MUST maintain separate app-specific knowledge bases that can be queried independently
- **FR-004**: System MUST support multiple coaching apps sharing the same platform infrastructure

**Knowledge Retrieval:**
- **FR-005**: System MUST retrieve relevant knowledge from app-specific knowledge bases based on user questions
- **FR-006**: System MUST use PostgreSQL full-text search for knowledge retrieval in Phase 1
- **FR-007**: System MUST be designed to support migration to semantic vector search without breaking existing functionality
- **FR-008**: System MUST return helpful responses even when exact keyword matches are not found in knowledge base
- **FR-009**: System MUST filter knowledge base queries to only return content relevant to the current app

**User Context & Memory:**
- **FR-010**: System MUST store conversation history for each user within each app
- **FR-011**: System MUST recall relevant previous conversations when responding to users
- **FR-012**: System MUST track user progress in learning app-specific frameworks (e.g., Intimacy Code principles)
- **FR-013**: System MUST maintain user preferences across all apps (subscription tier, notification settings)
- **FR-014**: System MUST keep conversation history and progress separate between different apps for the same user

**Personality & Tone:**
- **FR-015**: System MUST maintain consistent personality for each coaching app across all user interactions
- **FR-016**: System MUST compose personality by layering app-specific traits over Core HugoAI base characteristics
- **FR-017**: System MUST allow personality schemas to be updated independently of application code using SageMaker-style management interface
- **FR-018**: Hugo Matchmaker MUST present a "warm, supportive dating coach" personality in all responses
- **FR-019**: System MUST support viewing, editing, and version control of personality schemas through management interface

**Data Management:**
- **FR-020**: System MUST persist all user conversations for continuity across sessions
- **FR-021**: System MUST allow users to delete their account and all associated data
- **FR-022**: System MUST allow users to configure data retention preferences in Oriva settings page
- **FR-023**: iOS apps MUST provide data retention settings that sync with Oriva platform preferences
- **FR-024**: System MUST maintain data isolation between different users
- **FR-025**: System MUST store app registry (app ID, name, knowledge base references, personality schema)

**Performance & Scale:**
- **FR-026**: System MUST respond to user messages within 3 seconds under normal load
- **FR-027**: System MUST handle concurrent users from multiple apps without performance degradation
- **FR-028**: Knowledge retrieval MUST complete within 1 second to maintain conversational flow
- **FR-029**: Hugo Matchmaker MUST scale to support top 5 app store ranking performance requirements (high concurrent user volume)
- **FR-030**: Other Oriva coaching apps MUST support lower but sustainable concurrent user volumes
- **FR-031**: System MUST implement auto-scaling infrastructure to handle variable load patterns across apps

**Migration Path:**
- **FR-032**: System MUST support upgrading from full-text search to vector search without service interruption
- **FR-033**: System MUST maintain backward compatibility when knowledge retrieval method changes
- **FR-034**: System MUST allow testing vector search in parallel with full-text search before migration
- ~~**FR-035**: System MUST [NEEDS CLARIFICATION: who decides when to migrate from full-text to vector search, and based on what criteria?]~~ **[DEFERRED TO PHASE 2 - see Phase 2 Backlog below]**

**Authentication & Integration:**
- **FR-036**: Hugo Matchmaker iOS app MUST connect to platform for all coaching interactions
- **FR-037**: Platform MUST authenticate app requests to prevent unauthorized access
- **FR-038**: Platform MUST support multiple client types (iOS, web, Android future) with consistent behavior
- **FR-039**: System MUST support Oriva SSO for users accessing apps via Oriva marketplace
- **FR-040**: iOS apps MUST create new Oriva 101 accounts for users who download directly from App Store
- **FR-041**: System MUST provide "Sign in with Oriva" social authentication option (similar to GitHub OAuth)
- **FR-042**: Native iOS account creation MUST automatically register users in Oriva 101 platform
- **FR-043**: All authentication methods MUST grant access to shared Oriva ecosystem (marketplace, cross-app profiles)

### Key Entities

**User**
- Represents an Oriva platform user who may use multiple coaching apps
- Attributes: unique identifier, email, subscription tier, preferences, created date
- Relationships: Has conversations in multiple apps, has progress in multiple apps, has shared preferences

**App**
- Represents a coaching application in the Oriva ecosystem (e.g., Hugo Matchmaker, Hugo Career)
- Attributes: app ID, display name, domain (dating, career, health), active status
- Relationships: References personality schema, references knowledge bases, has many users

**Conversation**
- Represents a chat session between a user and a specific coaching app
- Attributes: session ID, user ID, app ID, created date, last message date
- Relationships: Contains many messages, belongs to one user, belongs to one app

**Message**
- Represents a single exchange in a conversation (user message or coach response)
- Attributes: message ID, conversation ID, role (user/assistant), content, timestamp, confidence score
- Relationships: Belongs to one conversation

**Knowledge Base**
- Represents a collection of domain expertise content for a coaching app
- Attributes: knowledge base ID, title, description, app IDs (which apps can access)
- Relationships: Contains many knowledge entries, belongs to one or more apps

**Knowledge Entry**
- Represents a single piece of domain knowledge (e.g., an Intimacy Code principle)
- Attributes: entry ID, knowledge base ID, title, content, category, search keywords
- Relationships: Belongs to one knowledge base

**Personality Schema**
- Represents the tone, style, and characteristics of a coaching personality
- Attributes: schema ID, layer (base/overlay), name, description, personality traits
- Relationships: May inherit from parent schema (Core HugoAI � App-specific)

**User Progress**
- Represents a user's learning progress within a specific coaching app
- Attributes: user ID, app ID, progress data, milestones reached, current focus area
- Relationships: Belongs to one user and one app

**User Memory**
- Represents context and history that informs future coaching interactions
- Attributes: memory ID, user ID, app ID, conversation ID, memory type, content, importance, timestamp
- Relationships: Belongs to one user, one app, optionally one conversation

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain in Phase 1 requirements (FR-035 deferred to Phase 2)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (3 second response time, knowledge retrieval under 1 second)
- [x] Scope is clearly bounded (Phase 1: full-text search, Phase 2: vector search migration)
- [x] Dependencies and assumptions identified (Supabase database, Oriva user authentication)

**Clarified Requirements:**
1. ✅ Personality schemas: SageMaker-style management interface with version control
2. ✅ User data retention: Configurable by users in Oriva settings, synced to apps
3. ✅ Peak concurrent users: Hugo Matchmaker targets top 5 app (high scale), others lower volume
4. ✅ Authentication: Multi-modal (Oriva SSO, native account creation, "Sign in with Oriva" social login)

**Outstanding Clarification:**
1. ~~Migration trigger criteria for moving from full-text to vector search~~ **[DEFERRED TO PHASE 2]**

---

## Phase 2 Backlog (Deferred Requirements)

### Vector Search Migration Decision Criteria
**Requirement ID**: FR-035 (deferred from Phase 1)

**Question**: Who decides when to migrate from full-text to vector search, and based on what criteria?

**Proposed Criteria** (to be validated in Phase 2):
- Knowledge base size exceeds 10,000 entries across all apps
- Full-text search p95 latency exceeds 1 second performance threshold
- User feedback indicates poor relevance matching (search quality metrics)
- Budget allocated for vector database infrastructure (Pinecone/Qdrant)

**Decision Maker**: Product owner + Engineering lead joint decision based on metrics

**Acceptance Criteria** (Phase 2):
- Document migration decision framework with quantitative thresholds
- Implement feature flag for gradual rollout (A/B testing capability)
- Create migration playbook with step-by-step procedures
- Define rollback procedure if vector search underperforms

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted (actors, actions, data, constraints)
- [x] Ambiguities marked and 4 of 5 clarified through stakeholder input
- [x] User scenarios defined (7 acceptance scenarios including auth flows, 5 edge case categories)
- [x] Requirements generated (43 functional requirements across 8 categories)
- [x] Entities identified (9 key entities with attributes and relationships)
- [x] Major clarifications completed (personality management, data retention, scale targets, authentication)
- [ ] Review checklist passed - **1 minor clarification remains (vector search migration triggers)**

---

## Next Steps

1. **Final Clarification** (Optional): Determine vector search migration decision criteria - can be deferred to Phase 2
2. **Planning Phase**: Ready to proceed with `/plan` command for implementation planning
3. **Key Architecture Decisions to Detail**:
   - Platform API endpoint structure and composition logic
   - Supabase database schema (apps, users, conversations, knowledge bases, personality schemas)
   - PostgreSQL full-text search configuration
   - SageMaker-style personality schema management interface
   - Multi-modal authentication flow (SSO, native, social)
   - Auto-scaling infrastructure for Hugo Matchmaker's high-volume target
4. **Implementation Priorities**:
   - Phase 1A: Database schema + API foundation
   - Phase 1B: Knowledge retrieval (PostgreSQL full-text)
   - Phase 1C: Personality composition engine
   - Phase 1D: Authentication integration
   - Phase 2: Vector search migration (future)