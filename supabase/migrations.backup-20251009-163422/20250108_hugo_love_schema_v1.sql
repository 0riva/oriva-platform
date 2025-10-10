-- Migration: HugoLove Schema v1 - Multi-Platform AI Coaching
-- Date: 2025-01-08
-- Feature: specs/007-hugolove-schema-v1
-- Description: Extends Hugo Love with AI coaching capabilities powered by Claude + The Intimacy Code knowledge base

-- ===========================================================================
-- PART 1: Profile Extension (Beliefs & Deal-breakers)
-- ===========================================================================

-- Add beliefs and deal_breakers columns to existing profiles table
ALTER TABLE hugo_love.profiles
ADD COLUMN IF NOT EXISTS beliefs TEXT CHECK (char_length(beliefs) <= 500),
ADD COLUMN IF NOT EXISTS deal_breakers TEXT CHECK (char_length(deal_breakers) <= 500);

COMMENT ON COLUMN hugo_love.profiles.beliefs IS 'User''s core values and beliefs (max 500 chars). Public data visible to matches.';
COMMENT ON COLUMN hugo_love.profiles.deal_breakers IS 'Relationship deal-breakers (max 500 chars). Public data visible to matches.';

-- ===========================================================================
-- PART 2: Private Coaching Data (ai_documents)
-- ===========================================================================

-- Create ai_documents table for storing private coaching context
CREATE TABLE IF NOT EXISTS hugo_love.ai_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (
    content_type IN (
      'BaseCharacteristics',
      'RelationshipGoals',
      'LifeEvents',
      'StickingPoints'
    )
  ),
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hugo_love.ai_documents IS 'Private coaching data (goals, events, sticking points) - NOT visible to other users';
COMMENT ON COLUMN hugo_love.ai_documents.tenant_id IS 'User ID for multi-tenant isolation via RLS';
COMMENT ON COLUMN hugo_love.ai_documents.content_type IS 'Document type: BaseCharacteristics, RelationshipGoals, LifeEvents, StickingPoints';
COMMENT ON COLUMN hugo_love.ai_documents.content IS 'JSONB content varying by content_type';

-- Index for tenant queries
CREATE INDEX IF NOT EXISTS idx_ai_documents_tenant ON hugo_love.ai_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_documents_content_type ON hugo_love.ai_documents(tenant_id, content_type);

-- ===========================================================================
-- PART 3: Conversations & Messages
-- ===========================================================================

-- Create conversations table
CREATE TABLE IF NOT EXISTS hugo_love.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  current_stage TEXT NOT NULL CHECK (
    current_stage IN ('celebration', 'connection', 'spark', 'payOff', 'spiral')
  ),
  message_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

COMMENT ON TABLE hugo_love.conversations IS 'Chat sessions between user and Hugo AI coach';
COMMENT ON COLUMN hugo_love.conversations.current_stage IS 'TIC coaching stage: celebration, connection, spark, payOff, spiral';
COMMENT ON COLUMN hugo_love.conversations.archived_at IS 'Null if active, timestamp if archived';

-- Indexes for conversation queries
CREATE INDEX IF NOT EXISTS idx_conversations_user ON hugo_love.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_active ON hugo_love.conversations(user_id, archived_at) WHERE archived_at IS NULL;

-- Create messages table
CREATE TABLE IF NOT EXISTS hugo_love.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES hugo_love.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) <= 10000),
  tone TEXT CHECK (tone IN ('friendly', 'supportive', 'encouraging')),
  tags JSONB,
  tic_chunk_ids UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hugo_love.messages IS 'Individual messages in coaching conversations';
COMMENT ON COLUMN hugo_love.messages.role IS 'Message sender: user or assistant (Hugo AI)';
COMMENT ON COLUMN hugo_love.messages.tone IS 'Coaching tone (assistant messages only): friendly, supportive, encouraging';
COMMENT ON COLUMN hugo_love.messages.tags IS 'Stage-specific tags applied to message';
COMMENT ON COLUMN hugo_love.messages.tic_chunk_ids IS 'TIC knowledge base chunks used in RAG (assistant messages only)';

-- Indexes for message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON hugo_love.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON hugo_love.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON hugo_love.messages(conversation_id, created_at);

-- ===========================================================================
-- PART 4: Vector Embeddings (pgvector for RAG)
-- ===========================================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table for TIC knowledge base
CREATE TABLE IF NOT EXISTS hugo_love.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_pdf TEXT NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hugo_love.document_chunks IS 'TIC knowledge base chunks with vector embeddings for RAG';
COMMENT ON COLUMN hugo_love.document_chunks.source_pdf IS 'Source PDF filename (e.g., "TIC Workbook 1 - Celebration.pdf")';
COMMENT ON COLUMN hugo_love.document_chunks.embedding IS 'OpenAI text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN hugo_love.document_chunks.metadata IS 'JSONB: {stage, tags, workbookTitle, pageNumber}';

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON hugo_love.document_chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN index for metadata queries (stage filtering)
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON hugo_love.document_chunks USING gin(metadata);

-- ===========================================================================
-- PART 5: Row Level Security (RLS) Policies
-- ===========================================================================

-- Enable RLS on all private tables
ALTER TABLE hugo_love.ai_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_love.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_love.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_love.document_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: ai_documents (tenant isolation)
CREATE POLICY tenant_isolation_ai_documents ON hugo_love.ai_documents
  FOR ALL
  USING (tenant_id = auth.uid());

COMMENT ON POLICY tenant_isolation_ai_documents ON hugo_love.ai_documents IS 'Users can only access their own coaching data';

-- RLS Policy: conversations (user isolation)
CREATE POLICY tenant_isolation_conversations ON hugo_love.conversations
  FOR ALL
  USING (user_id = auth.uid());

COMMENT ON POLICY tenant_isolation_conversations ON hugo_love.conversations IS 'Users can only access their own conversations';

-- RLS Policy: messages (user isolation)
CREATE POLICY tenant_isolation_messages ON hugo_love.messages
  FOR ALL
  USING (user_id = auth.uid());

COMMENT ON POLICY tenant_isolation_messages ON hugo_love.messages IS 'Users can only access their own messages';

-- RLS Policy: document_chunks (public read)
CREATE POLICY public_read_chunks ON hugo_love.document_chunks
  FOR SELECT
  USING (true);

COMMENT ON POLICY public_read_chunks ON hugo_love.document_chunks IS 'TIC knowledge base chunks are readable by all authenticated users';

-- ===========================================================================
-- PART 6: Helper Functions
-- ===========================================================================

-- Function to update conversation message count
CREATE OR REPLACE FUNCTION hugo_love.increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE hugo_love.conversations
  SET message_count = message_count + 1,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-increment message_count on message insert
DROP TRIGGER IF EXISTS trigger_increment_message_count ON hugo_love.messages;
CREATE TRIGGER trigger_increment_message_count
  AFTER INSERT ON hugo_love.messages
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.increment_message_count();

-- Function to update ai_documents updated_at timestamp
CREATE OR REPLACE FUNCTION hugo_love.update_ai_documents_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on ai_documents update
DROP TRIGGER IF EXISTS trigger_update_ai_documents_timestamp ON hugo_love.ai_documents;
CREATE TRIGGER trigger_update_ai_documents_timestamp
  BEFORE UPDATE ON hugo_love.ai_documents
  FOR EACH ROW
  EXECUTE FUNCTION hugo_love.update_ai_documents_timestamp();

-- ===========================================================================
-- PART 7: Grants & Permissions
-- ===========================================================================

-- Grant authenticated users access to tables
GRANT SELECT, INSERT, UPDATE, DELETE ON hugo_love.ai_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON hugo_love.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON hugo_love.messages TO authenticated;
GRANT SELECT ON hugo_love.document_chunks TO authenticated;

-- Grant service role full access (for Edge Functions)
GRANT ALL ON hugo_love.ai_documents TO service_role;
GRANT ALL ON hugo_love.conversations TO service_role;
GRANT ALL ON hugo_love.messages TO service_role;
GRANT ALL ON hugo_love.document_chunks TO service_role;
