# Data Model: Hugo Platform Integration

**Feature**: 003-hugo-platform-integration
**Date**: 2025-01-14
**Database**: Supabase PostgreSQL 15+

## Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    Users    │───────│  Conversations   │───────│  Messages   │
│             │  1:N  │                  │  1:N  │             │
└─────────────┘       └──────────────────┘       └─────────────┘
       │                       │
       │ 1:N                   │ N:1
       │                       │
┌─────────────┐       ┌──────────────────┐
│UserProgress │       │      Apps        │
│             │       │                  │
└─────────────┘       └──────────────────┘
       │                       │
       │ 1:N                   │ N:N
       │                       │
┌─────────────┐       ┌──────────────────┐       ┌─────────────────────┐
│UserMemories │       │ KnowledgeBase    │───────│PersonalitySchemas   │
│             │       │                  │  N:1  │                     │
└─────────────┘       └──────────────────┘       └─────────────────────┘
                              │
                              │ 1:N
                              │
                      ┌──────────────────┐
                      │KnowledgeEntries  │
                      │                  │
                      └──────────────────┘
```

---

## Core Entities

### 1. Users

Represents an Oriva platform user who may use multiple coaching apps.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oriva_user_id UUID NOT NULL UNIQUE, -- Reference to Oriva 101 user
  email TEXT NOT NULL UNIQUE,

  -- User preferences (shared across all apps)
  preferences JSONB DEFAULT '{}'::jsonb, -- {notifications: bool, theme: string}
  subscription_tier TEXT DEFAULT 'free', -- free, premium, enterprise

  -- Data retention settings
  data_retention_days INTEGER DEFAULT 365, -- User-configurable

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX users_oriva_id_idx ON users(oriva_user_id);
CREATE INDEX users_email_idx ON users(email);
CREATE INDEX users_active_idx ON users(last_active_at DESC);

-- RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (id = auth.uid());
```

**Validation Rules**:
- Email must be valid format
- Subscription tier must be one of: free, premium, enterprise
- Data retention days must be between 30 and 1825 (5 years)

---

### 2. Apps

Represents a coaching application in the Oriva ecosystem (e.g., Hugo Matchmaker, Hugo Career).

```sql
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL UNIQUE, -- e.g., "hugo_matchmaker"
  display_name TEXT NOT NULL, -- e.g., "Hugo Matchmaker"
  domain TEXT NOT NULL, -- dating, career, health, finance, relationships

  -- Configuration
  personality_schema_id UUID REFERENCES personality_schemas(id),
  knowledge_base_ids TEXT[] DEFAULT '{}', -- Array of KB IDs

  -- Status
  is_active BOOLEAN DEFAULT true,
  requires_subscription BOOLEAN DEFAULT false,

  -- Metadata
  description TEXT,
  icon_url TEXT,
  app_store_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX apps_app_id_idx ON apps(app_id);
CREATE INDEX apps_domain_idx ON apps(domain);
CREATE INDEX apps_active_idx ON apps(is_active) WHERE is_active = true;

-- No RLS - apps table is public read
```

**Validation Rules**:
- app_id must be lowercase with underscores only
- domain must be one of: dating, career, health, finance, relationships, general
- At least one knowledge_base_id required

---

### 3. Conversations

Represents a chat session between a user and a specific coaching app.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE, -- Client-generated for idempotency
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id),

  -- Session metadata
  title TEXT, -- Auto-generated from first message
  message_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

-- Indexes
CREATE UNIQUE INDEX conversations_session_id_idx ON conversations(session_id);
CREATE INDEX conversations_user_app_idx ON conversations(user_id, app_id);
CREATE INDEX conversations_recent_idx ON conversations(last_message_at DESC);

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_user_access ON conversations
  FOR ALL USING (user_id = auth.uid());
```

**Validation Rules**:
- session_id must be valid UUIDv4
- message_count must be >= 0
- closed_at must be after created_at if set

**State Transitions**:
- Created → Active (first message)
- Active → Closed (user ends conversation or 30 days inactive)

---

### 4. Messages

Represents a single exchange in a conversation (user message or coach response).

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,

  -- AI metadata (for assistant messages)
  model TEXT, -- e.g., "gpt-4", "claude-3-opus"
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  intimacy_code_reference TEXT, -- e.g., "Principle 3: Authentic Vulnerability"

  -- Performance tracking
  generation_time_ms INTEGER, -- How long LLM took to respond
  tokens_used INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX messages_conversation_idx ON messages(conversation_id, created_at);
CREATE INDEX messages_role_idx ON messages(role);

-- RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_user_access ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );
```

**Validation Rules**:
- role must be 'user' or 'assistant'
- content must not be empty
- confidence_score must be between 0.00 and 1.00
- tokens_used must be > 0 for assistant messages

---

### 5. KnowledgeBase

Represents a collection of domain expertise content for a coaching app.

```sql
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id TEXT NOT NULL UNIQUE, -- e.g., "intimacy_code_v1"
  title TEXT NOT NULL,
  description TEXT,

  -- Ownership
  app_ids TEXT[] NOT NULL, -- Which apps can access this KB
  owner_org TEXT DEFAULT 'oriva',

  -- Versioning
  version TEXT DEFAULT '1.0.0',
  parent_kb_id TEXT, -- For versioned updates

  -- Stats
  entry_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX kb_kb_id_idx ON knowledge_bases(kb_id);
CREATE INDEX kb_app_ids_idx ON knowledge_bases USING GIN(app_ids);
CREATE INDEX kb_active_idx ON knowledge_bases(is_active) WHERE is_active = true;
```

**Validation Rules**:
- kb_id must be lowercase with underscores only
- app_ids array must contain at least one element
- version must follow semantic versioning (X.Y.Z)

---

### 6. KnowledgeEntries

Represents a single piece of domain knowledge (e.g., an Intimacy Code principle).

```sql
CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,

  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Organization
  category TEXT, -- e.g., "principles", "techniques", "examples"
  tags TEXT[] DEFAULT '{}',
  section_number INTEGER, -- For ordered content

  -- Full-text search vector (auto-generated)
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) STORED,

  -- Future vector search support
  vector_store_id TEXT, -- Reference to Pinecone/Qdrant entry

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Usage tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX ke_kb_id_idx ON knowledge_entries(knowledge_base_id);
CREATE INDEX ke_category_idx ON knowledge_entries(category);
CREATE INDEX ke_search_idx ON knowledge_entries USING GIN(search_vector);
CREATE INDEX ke_tags_idx ON knowledge_entries USING GIN(tags);
CREATE INDEX ke_popular_idx ON knowledge_entries(access_count DESC);

-- Function to increment access count
CREATE OR REPLACE FUNCTION increment_ke_access(entry_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE knowledge_entries
  SET access_count = access_count + 1,
      last_accessed_at = now()
  WHERE id = entry_id;
END;
$$ LANGUAGE plpgsql;
```

**Validation Rules**:
- title and content must not be empty
- section_number must be >= 0 if set
- category should be one of predefined categories for consistency

---

### 7. PersonalitySchemas

Represents the tone, style, and characteristics of a coaching personality.

```sql
CREATE TABLE personality_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_id TEXT NOT NULL, -- e.g., "core_hugo", "matchmaker_v1"
  version TEXT NOT NULL, -- Semantic versioning

  -- Schema hierarchy
  layer TEXT NOT NULL, -- 'base' or 'overlay'
  parent_schema_id UUID REFERENCES personality_schemas(id), -- For overlays

  -- Personality definition
  schema JSONB NOT NULL, -- {tone, focus, constraints, examples}

  -- Deployment metadata
  status TEXT DEFAULT 'draft', -- draft, testing, active, archived
  rollout_percentage INTEGER DEFAULT 0, -- 0-100 for gradual deployment
  ab_test_group TEXT, -- For A/B testing

  -- Audit trail
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX ps_schema_id_version_idx ON personality_schemas(schema_id, version);
CREATE INDEX ps_layer_idx ON personality_schemas(layer);
CREATE INDEX ps_status_idx ON personality_schemas(status);
CREATE INDEX ps_active_idx ON personality_schemas(status, rollout_percentage)
  WHERE status = 'active' AND rollout_percentage > 0;

-- Unique constraint for active schemas per schema_id
CREATE UNIQUE INDEX ps_unique_active_schema ON personality_schemas(schema_id)
  WHERE status = 'active' AND rollout_percentage = 100;
```

**Schema JSONB Structure**:
```json
{
  "tone": "warm|collaborative|professional|casual",
  "focus": ["cognitive_clarity", "empathy", "action_orientation"],
  "constraints": [
    "no_medical_advice",
    "GDPR_compliant",
    "no_financial_advice"
  ],
  "examples": [
    {
      "situation": "User expresses fear of rejection",
      "response": "That fear is completely valid. Let's explore what authentic vulnerability looks like in this context..."
    }
  ],
  "voice_characteristics": {
    "formality": 0.3,
    "empathy": 0.9,
    "directness": 0.7
  }
}
```

**Validation Rules**:
- layer must be 'base' or 'overlay'
- overlay schemas must have parent_schema_id
- base schemas must not have parent_schema_id
- status must be one of: draft, testing, active, archived
- rollout_percentage must be 0-100
- version must follow semantic versioning

**State Transitions**:
- draft → testing (schema validated)
- testing → active (testing successful, begin rollout)
- active (0%) → active (100%) (gradual rollout)
- active → archived (replaced by newer version)

---

### 8. UserProgress

Represents a user's learning progress within a specific coaching app.

```sql
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id),

  -- Progress tracking
  progress_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example: {
  --   "intimacy_code_principles_learned": [1, 3, 5],
  --   "current_focus": "authentic_vulnerability",
  --   "skill_levels": {"communication": 0.6, "confidence": 0.4}
  -- }

  milestones_reached TEXT[] DEFAULT '{}',
  current_focus_area TEXT,

  -- Stats
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, app_id)
);

-- Indexes
CREATE INDEX up_user_app_idx ON user_progress(user_id, app_id);
CREATE INDEX up_milestones_idx ON user_progress USING GIN(milestones_reached);

-- RLS
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY up_user_access ON user_progress
  FOR ALL USING (user_id = auth.uid());
```

**Validation Rules**:
- total_conversations and total_messages must be >= 0
- milestones_reached should not contain duplicates

---

### 9. UserMemories

Represents context and history that informs future coaching interactions.

```sql
CREATE TABLE user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id UUID NOT NULL REFERENCES apps(id),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- Memory content
  memory_type TEXT NOT NULL, -- conversation_context, user_preference, milestone, insight
  content TEXT NOT NULL,

  -- Importance scoring
  importance DECIMAL(3,2) DEFAULT 0.50, -- 0.00 to 1.00
  relevance_decay_rate DECIMAL(3,2) DEFAULT 0.05, -- How fast importance decreases

  -- Temporal tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ -- Based on user retention settings
);

-- Indexes
CREATE INDEX um_user_app_idx ON user_memories(user_id, app_id);
CREATE INDEX um_type_idx ON user_memories(memory_type);
CREATE INDEX um_importance_idx ON user_memories(importance DESC);
CREATE INDEX um_expires_idx ON user_memories(expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY um_user_access ON user_memories
  FOR ALL USING (user_id = auth.uid());

-- Function to decay memory importance over time
CREATE OR REPLACE FUNCTION decay_memory_importance()
RETURNS void AS $$
BEGIN
  UPDATE user_memories
  SET importance = GREATEST(0.0, importance - relevance_decay_rate)
  WHERE last_accessed_at < now() - INTERVAL '30 days'
    AND importance > 0.0;
END;
$$ LANGUAGE plpgsql;
```

**Memory Types**:
- **conversation_context**: Key points from past conversations
- **user_preference**: Stated preferences (communication style, topics to avoid)
- **milestone**: Achievements and breakthroughs
- **insight**: Pattern recognition about user's behavior/needs

**Validation Rules**:
- memory_type must be one of predefined types
- importance must be between 0.00 and 1.00
- relevance_decay_rate must be between 0.00 and 1.00

---

## Database Constraints

### Foreign Key Constraints
- All references use CASCADE for deletions to maintain referential integrity
- User deletion cascades to all user-owned data
- Conversation deletion cascades to messages

### Check Constraints
```sql
-- Users
ALTER TABLE users ADD CONSTRAINT users_retention_check
  CHECK (data_retention_days BETWEEN 30 AND 1825);

-- Messages
ALTER TABLE messages ADD CONSTRAINT messages_role_check
  CHECK (role IN ('user', 'assistant'));

ALTER TABLE messages ADD CONSTRAINT messages_confidence_check
  CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0));

-- PersonalitySchemas
ALTER TABLE personality_schemas ADD CONSTRAINT ps_layer_check
  CHECK (layer IN ('base', 'overlay'));

ALTER TABLE personality_schemas ADD CONSTRAINT ps_status_check
  CHECK (status IN ('draft', 'testing', 'active', 'archived'));

ALTER TABLE personality_schemas ADD CONSTRAINT ps_rollout_check
  CHECK (rollout_percentage BETWEEN 0 AND 100);

-- UserMemories
ALTER TABLE user_memories ADD CONSTRAINT um_importance_check
  CHECK (importance >= 0.0 AND importance <= 1.0);

ALTER TABLE user_memories ADD CONSTRAINT um_decay_check
  CHECK (relevance_decay_rate >= 0.0 AND relevance_decay_rate <= 1.0);
```

---

## Performance Optimization

### Prepared Statements

```sql
-- Get chat context (hot path - executed for every message)
PREPARE get_chat_context(text, uuid) AS
SELECT
  a.app_id,
  a.display_name,
  ps.schema as personality_schema,
  array_agg(DISTINCT kb.kb_id) as knowledge_bases,
  (
    SELECT array_agg(m.* ORDER BY m.created_at DESC)
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.user_id = $2 AND c.app_id = a.id
    LIMIT 10
  ) as recent_messages,
  up.progress_data,
  up.current_focus_area
FROM apps a
JOIN personality_schemas ps ON ps.id = a.personality_schema_id
LEFT JOIN knowledge_bases kb ON kb.kb_id = ANY(a.knowledge_base_ids)
LEFT JOIN user_progress up ON up.user_id = $2 AND up.app_id = a.id
WHERE a.app_id = $1
GROUP BY a.id, ps.id, up.id;

-- Search knowledge (hot path)
PREPARE search_knowledge(text, text, int) AS
SELECT
  ke.id,
  ke.title,
  ke.content,
  ke.category,
  ts_rank(ke.search_vector, websearch_to_tsquery('english', $1)) as relevance
FROM knowledge_entries ke
JOIN knowledge_bases kb ON kb.id = ke.knowledge_base_id
WHERE
  kb.kb_id = ANY(
    SELECT unnest(knowledge_base_ids)
    FROM apps
    WHERE app_id = $2
  )
  AND ke.search_vector @@ websearch_to_tsquery('english', $1)
ORDER BY relevance DESC
LIMIT $3;
```

### Partitioning Strategy (Future)

For high-scale deployment (>1M conversations):

```sql
-- Partition conversations by created_at (monthly)
CREATE TABLE conversations_2025_01 PARTITION OF conversations
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Partition messages by created_at (monthly)
CREATE TABLE messages_2025_01 PARTITION OF messages
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

## Data Lifecycle Management

### Automated Cleanup Jobs

```sql
-- Archive old conversations (closed > 90 days ago)
CREATE OR REPLACE FUNCTION archive_old_conversations()
RETURNS void AS $$
BEGIN
  -- Move to archive table or delete based on retention policy
  DELETE FROM conversations
  WHERE closed_at < now() - INTERVAL '90 days'
    AND user_id IN (
      SELECT id FROM users WHERE data_retention_days < 365
    );
END;
$$ LANGUAGE plpgsql;

-- Scheduled job (run daily at 2 AM UTC)
SELECT cron.schedule('archive-conversations', '0 2 * * *', 'SELECT archive_old_conversations()');

-- Expire user memories based on retention settings
CREATE OR REPLACE FUNCTION expire_user_memories()
RETURNS void AS $$
BEGIN
  DELETE FROM user_memories
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Scheduled job (run daily at 3 AM UTC)
SELECT cron.schedule('expire-memories', '0 3 * * *', 'SELECT expire_user_memories()');
```

---

## Migration Path to Vector Search

When transitioning from full-text to vector search:

```sql
-- Phase 1: Add vector_store_id column (already in schema)
-- Phase 2: Populate vectors in background
CREATE OR REPLACE FUNCTION sync_knowledge_to_vector()
RETURNS void AS $$
DECLARE
  entry RECORD;
BEGIN
  FOR entry IN
    SELECT id, title, content
    FROM knowledge_entries
    WHERE vector_store_id IS NULL
    LIMIT 100
  LOOP
    -- Call external function to generate embedding and store in Pinecone
    -- Update vector_store_id with returned ID
    -- This runs as background job, not inline
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Phase 3: Dual query mode (use both full-text and vector)
-- Phase 4: Switch to vector-only after validation
-- Phase 5: Archive tsvector columns (keep for rollback)
```

---

## Summary

**9 Core Tables**:
1. users (identity and preferences)
2. apps (coaching application registry)
3. conversations (chat sessions)
4. messages (individual exchanges)
5. knowledge_bases (domain expertise collections)
6. knowledge_entries (individual principles/content)
7. personality_schemas (coaching personality definitions)
8. user_progress (learning journey tracking)
9. user_memories (context for personalization)

**Performance Features**:
- GIN indexes for array and full-text search
- Prepared statements for hot paths
- Row-level security for data isolation
- Automated cleanup jobs for data retention
- Future-ready for partitioning and vector search

**Data Integrity**:
- Foreign key constraints with CASCADE
- Check constraints for valid ranges
- Unique constraints for business rules
- JSONB validation through application layer