# Technical Research: Hugo Platform Integration

**Feature**: 003-hugo-platform-integration
**Date**: 2025-01-14
**Status**: Complete

## Research Objectives

1. PostgreSQL Full-Text Search best practices for knowledge retrieval
2. Vercel Edge Functions patterns for AI/LLM integration
3. Multi-layered prompt composition strategies
4. Personality schema versioning and management
5. Multi-modal authentication architecture (SSO + Native + Social)
6. Performance optimization for high-scale AI chat applications

---

## 1. PostgreSQL Full-Text Search for Knowledge Retrieval

### Decision
Use PostgreSQL `tsvector` with GIN indexes for full-text search, implementing a hybrid scoring approach that combines text relevance with metadata filtering.

### Rationale
- **Native PostgreSQL feature**: No external dependencies, included in Supabase
- **Performance**: GIN indexes provide O(log n) search performance, acceptable for <1s requirement
- **Flexibility**: Supports English language stemming, phrase matching, boolean operators
- **Migration-ready**: Can coexist with future vector search (store both tsvector and vector_id)

### Implementation Pattern
```sql
-- Knowledge base table with full-text search
CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id TEXT NOT NULL,
  app_ids TEXT[] NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  metadata JSONB,

  -- Full-text search vector (auto-generated)
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optimized GIN index for fast text search
CREATE INDEX knowledge_search_idx ON knowledge_base USING GIN(search_vector);

-- Index for app filtering
CREATE INDEX knowledge_app_idx ON knowledge_base USING GIN(app_ids);

-- Example query with relevance ranking
SELECT
  id,
  title,
  content,
  ts_rank(search_vector, websearch_to_tsquery('english', $1)) as relevance
FROM knowledge_base
WHERE
  app_ids @> ARRAY[$2]::text[]
  AND search_vector @@ websearch_to_tsquery('english', $1)
ORDER BY relevance DESC
LIMIT 5;
```

### Alternatives Considered
1. **PostgreSQL LIKE/ILIKE**: Too slow for fuzzy matching, no relevance ranking
2. **Elasticsearch**: Overkill for initial scale, adds infrastructure complexity
3. **pgvector immediately**: Premature optimization, higher cost and complexity

### Limitations & Migration Path
- **Limitations**: Keyword-based only, no semantic understanding of concepts
- **When to migrate**: When semantic queries show >30% relevance failures in analytics
- **Migration strategy**: Add `vector_id` column, run dual queries during transition, A/B test results

---

## 2. Vercel Edge Functions for AI Integration

### Decision
Use Vercel Edge Functions with streaming responses for AI chat completions, implementing intelligent timeout and retry strategies.

### Rationale
- **Global distribution**: Edge deployment reduces latency for worldwide users
- **Streaming support**: Real-time token-by-token response improves perceived performance
- **Auto-scaling**: Handles Hugo Matchmaker's top-5 app scale target automatically
- **Cost efficiency**: Pay-per-execution model scales with usage

### Implementation Pattern
```typescript
// /api/hugo/chat.ts - Vercel Edge Function
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'fra1'], // US East, West, EU
};

export default async function handler(req: Request) {
  const { sessionId, message, appId } = await req.json();

  // 1. Load app configuration and knowledge
  const context = await loadContext(appId, sessionId);

  // 2. Compose multi-layered prompt
  const systemPrompt = composePrompt(context);

  // 3. Stream OpenAI response
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      ...context.recentMessages,
      { role: 'user', content: message }
    ],
    stream: true
  });

  // 4. Return streaming response
  return new Response(stream.toReadableStream(), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  });
}
```

### Performance Optimizations
- **Parallel data loading**: Fetch app config, knowledge, and user context concurrently
- **Connection pooling**: Reuse Supabase client connections
- **Smart caching**: Cache personality schemas and app configs (15min TTL)
- **Timeout strategy**: 3s hard limit, fail fast with graceful error

### Alternatives Considered
1. **AWS Lambda**: Higher cold start latency, less integrated with deployment
2. **Traditional Node.js server**: Requires manual scaling and load balancing
3. **Cloudflare Workers**: Similar but less integrated with existing stack

---

## 3. Multi-Layered Prompt Composition

### Decision
Implement a declarative prompt composition engine that layers contexts in a fixed order: Core HugoAI → App-Specific → User Context.

### Rationale
- **Predictable behavior**: Fixed order ensures consistent personality across sessions
- **Override semantics**: Later layers can refine earlier ones (app overrides core tone)
- **Debuggability**: Each layer is inspectable and testable independently
- **Token efficiency**: Smart truncation based on layer importance

### Composition Strategy
```typescript
interface PromptContext {
  coreHugo: PersonalitySchema;      // Base cognitive enhancement
  appPersonality: PersonalitySchema; // Domain-specific overlay
  knowledgeBase: KnowledgeEntry[];   // Relevant principles
  userContext: UserMemory[];         // Conversation history
  currentGoals: string[];            // User's stated objectives
}

function composePrompt(context: PromptContext): string {
  const layers: PromptLayer[] = [
    // Layer 1: Core HugoAI (always included)
    {
      priority: 1,
      maxTokens: 500,
      content: buildCoreHugoPrompt(context.coreHugo)
    },

    // Layer 2: App-specific personality & knowledge
    {
      priority: 2,
      maxTokens: 1000,
      content: buildAppPrompt(context.appPersonality, context.knowledgeBase)
    },

    // Layer 3: User context (truncate oldest if needed)
    {
      priority: 3,
      maxTokens: 1500,
      content: buildUserContextPrompt(context.userContext, context.currentGoals)
    }
  ];

  return assembleLayers(layers, MAX_CONTEXT_TOKENS);
}

function assembleLayers(layers: PromptLayer[], maxTokens: number): string {
  // Sort by priority, allocate tokens, truncate if needed
  // Higher priority layers protected from truncation
}
```

### Token Budget Allocation
- **Total context**: 4096 tokens (GPT-3.5) or 8192 tokens (GPT-4)
- **Reserve**: 500 tokens for user message + 1000 tokens for response
- **Available for prompt**: 2596 tokens (GPT-3.5) or 6692 tokens (GPT-4)
- **Layer allocation**:
  - Core HugoAI: 500 tokens (protected)
  - App personality + knowledge: 1000 tokens (protected for first 3 principles)
  - User context: 1096 tokens (truncate oldest messages first)

### Alternatives Considered
1. **Dynamic layer ordering**: Too complex, unpredictable behavior
2. **Single mega-prompt**: Not maintainable, can't update layers independently
3. **RAG without structure**: No guarantee of personality consistency

---

## 4. Personality Schema Management

### Decision
Implement SageMaker-style schema management with version control, A/B testing support, and gradual rollout capabilities.

### Rationale
- **Safe updates**: Test schema changes on subset of users before full deployment
- **Rollback capability**: Instant revert to previous version if issues detected
- **Experimentation**: A/B test personality variations to optimize user satisfaction
- **Audit trail**: Track who changed what and when for compliance

### Schema Structure
```typescript
interface PersonalitySchema {
  id: string;
  version: string;            // Semantic versioning: 1.2.3
  layer: 'base' | 'overlay';  // Core or app-specific
  parentSchemaId?: string;    // For overlays, reference to base

  schema: {
    tone: string;             // e.g., "collaborative", "warm", "professional"
    focus: string[];          // e.g., ["cognitive_clarity", "empathy"]
    constraints: string[];    // e.g., ["no_medical_advice", "GDPR_compliant"]
    examples: {               // Few-shot examples
      situation: string;
      response: string;
    }[];
  };

  metadata: {
    createdBy: string;
    createdAt: Date;
    status: 'draft' | 'testing' | 'active' | 'archived';
    rolloutPercentage: number; // 0-100 for gradual deployment
    abTestGroup?: string;      // For A/B testing
  };
}
```

### Management Interface Requirements
1. **Schema Editor**: YAML-based editing with schema validation
2. **Version Diff**: Show changes between versions
3. **Deployment Control**: Percentage-based rollout slider (0% → 10% → 50% → 100%)
4. **A/B Testing**: Create variant schemas, compare performance metrics
5. **Rollback**: One-click revert to previous stable version
6. **Analytics Integration**: Track user satisfaction, message quality, error rates per schema version

### Alternatives Considered
1. **File-based schemas in Git**: No A/B testing, requires deployment for changes
2. **Database JSON column**: No version control, harder to diff changes
3. **External CMS**: Adds complexity, another system to maintain

---

## 5. Multi-Modal Authentication Architecture

### Decision
Implement unified authentication layer supporting three entry points (Oriva SSO, native account creation, social login) all creating/linking to Oriva 101 accounts.

### Rationale
- **Unified identity**: Single user record regardless of entry point
- **Marketplace integration**: All users gain access to Oriva app ecosystem
- **Future-proof**: Architecture supports adding more SSO providers (Google, Apple)
- **Security**: Centralized auth reduces attack surface

### Architecture Pattern
```
┌─────────────────────────────────────────────────────┐
│           Hugo Matchmaker iOS App                   │
└────────────┬────────────┬────────────┬──────────────┘
             │            │            │
    ┌────────▼───┐   ┌───▼─────┐  ┌──▼──────────┐
    │ Native Reg │   │ Oriva   │  │ Sign in     │
    │            │   │ SSO     │  │ with Oriva  │
    └────────┬───┘   └───┬─────┘  └──┬──────────┘
             │            │            │
             └────────────┼────────────┘
                          │
             ┌────────────▼────────────┐
             │  Oriva Auth Service     │
             │  (Supabase Auth + RLS)  │
             └────────────┬────────────┘
                          │
             ┌────────────▼────────────┐
             │  Oriva 101 User DB      │
             │  (Single source          │
             │   of truth)             │
             └─────────────────────────┘
```

### Implementation Details

**Native Account Creation**:
```typescript
// iOS app calls this on first launch sign-up
POST /api/auth/register
{
  email: string,
  password: string,
  source: "hugo_matchmaker_ios"
}

Response:
{
  userId: uuid,
  orivaUserId: uuid,  // Created in Oriva 101
  accessToken: jwt,
  marketplace Access: true
}
```

**Oriva SSO**:
```typescript
// Redirect flow for marketplace users
GET /api/auth/sso?provider=oriva&redirectUri=hugomatchmaker://auth

// Callback after Oriva auth
GET /api/auth/callback?code=xxx&state=yyy

// Exchange code for tokens
{
  userId: uuid,        // Existing Oriva user
  accessToken: jwt,
  apps: ["hugo_matchmaker", ...] // User's installed apps
}
```

**Sign in with Oriva (Social Login)**:
```typescript
// OAuth-style flow like "Sign in with GitHub"
// iOS app shows Oriva OAuth consent screen
GET https://oriva.com/oauth/authorize?
  client_id=hugo_matchmaker&
  redirect_uri=hugomatchmaker://oauth&
  scope=profile+apps

// User approves, gets redirected back
hugomatchmaker://oauth?code=xxx

// Exchange for token
POST /api/auth/token
{
  grant_type: "authorization_code",
  code: "xxx",
  client_id: "hugo_matchmaker"
}
```

### Security Considerations
- **JWT tokens**: Short-lived (1 hour) with refresh tokens (30 days)
- **Row-level security**: Supabase RLS ensures users only access their own data
- **Rate limiting**: Prevent brute force attacks (5 attempts/hour per IP)
- **Token rotation**: Automatic refresh before expiration

### Alternatives Considered
1. **Separate auth systems**: Data silos, poor UX when user switches apps
2. **Third-party only (Auth0)**: Vendor lock-in, higher cost at scale
3. **Manual account linking**: Terrible UX, users won't bother

---

## 6. Performance Optimization for High-Scale AI Chat

### Decision
Implement multi-tier caching strategy, database query optimization, and intelligent request batching to meet <3s response time at 10k+ concurrent users.

### Rationale
- **User expectations**: Chat must feel instant, >3s is perceived as broken
- **LLM latency**: OpenAI API typically 1-2s, leaves 1s budget for platform work
- **Scale target**: Top-5 app ranking requires handling 10k+ concurrent, 1000+ msg/min

### Performance Strategy

**Tier 1: In-Memory Cache (Edge Function)**
```typescript
// Cache hot data at edge (15min TTL)
const edgeCache = new Map<string, CachedData>();

interface CachedData {
  appConfig: AppConfig;       // Rarely changes
  personalitySchema: Schema;  // Versioned, cacheable
  knowledgePrinciples: KB[];  // Top 100 most-accessed principles
}

// Cache key: `app:${appId}:v${schemaVersion}`
// Invalidation: On schema deployment
```

**Tier 2: Database Optimization**
```sql
-- Prepared statement for hot path
PREPARE get_chat_context AS
SELECT
  a.personality_schema_id,
  p.schema,
  u.preferences,
  array_agg(m.* ORDER BY m.created_at DESC)[:10] as recent_messages
FROM apps a
JOIN personality_schemas p ON p.id = a.personality_schema_id
JOIN users u ON u.id = $2
LEFT JOIN messages m ON m.user_id = $2 AND m.app_id = $1
WHERE a.app_id = $1
GROUP BY a.id, p.id, u.id;

-- Execute with parameters
EXECUTE get_chat_context('hugo_matchmaker', 'user-uuid');
```

**Tier 3: Connection Pooling**
```typescript
// Supabase connection pool (shared across edge functions)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: {
    pool: {
      min: 2,
      max: 10,
      idleTimeoutMillis: 30000
    }
  }
});
```

**Tier 4: Parallel Data Loading**
```typescript
async function loadContext(appId: string, userId: string) {
  // Load all data in parallel (400ms instead of 1200ms sequential)
  const [appConfig, knowledge, userContext] = await Promise.all([
    getAppConfig(appId),           // 200ms
    searchKnowledge(query, appId), // 800ms (full-text search)
    getUserContext(userId, appId)  // 200ms
  ]);

  return { appConfig, knowledge, userContext };
}
```

### Performance Budget Breakdown
```
Total: 3000ms
├── Platform overhead: 500ms
│   ├── Request parsing: 50ms
│   ├── Authentication: 100ms
│   ├── Data loading (parallel): 300ms
│   └── Prompt composition: 50ms
├── LLM inference: 2000ms
│   ├── API call overhead: 100ms
│   ├── Token generation: 1800ms
│   └── Streaming buffer: 100ms
└── Response assembly: 500ms
    ├── Database write (message): 200ms
    ├── Memory update: 100ms
    └── Response formatting: 200ms
```

### Monitoring & Alerts
- **p50 latency**: <2s (acceptable)
- **p95 latency**: <3s (goal)
- **p99 latency**: <5s (degraded but functional)
- **Error rate**: <0.1%
- **Alert thresholds**: p95 >3.5s or error rate >0.5%

### Alternatives Considered
1. **Synchronous blocking**: Simpler but can't hit performance goals
2. **Background jobs**: Terrible UX for chat, must be real-time
3. **Websockets**: Overkill for request-response, adds complexity

---

## Implementation Readiness

### Research Complete ✅
All technical unknowns resolved, ready for Phase 1 (Design & Contracts).

### Key Decisions Made
1. PostgreSQL full-text search with migration path to vector
2. Vercel Edge Functions with streaming
3. Multi-layered prompt composition (Core → App → User)
4. SageMaker-style personality schema management
5. Unified multi-modal authentication
6. Multi-tier caching for <3s performance

### Risks Identified
1. **Full-text search limitations**: May need vector sooner if Intimacy Code content is highly conceptual
   - *Mitigation*: Monitor query relevance, have vector migration plan ready
2. **Token budget pressure**: Complex knowledge bases may exceed context limits
   - *Mitigation*: Implement smart truncation, summarization for long context
3. **LLM latency variability**: OpenAI API can spike to 5s+ during high load
   - *Mitigation*: Implement fallback to faster model, show streaming progress

### Next Phase
Ready for Phase 1: Design data models, generate API contracts, create contract tests.