-- =====================================================
-- EntryCard Enhancement Foundation Migration
-- Epic 2.1: Database Schema for Markdown Sync & Response Threading
-- =====================================================

-- =====================================================
-- MARKDOWN FILES TABLE
-- Purpose: Store markdown files with ORIVA_ID tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS markdown_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  oriva_id UUID NOT NULL UNIQUE,
  path TEXT NOT NULL,
  filename TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  content TEXT,
  content_hash TEXT, -- For change detection
  sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_local_modified TIMESTAMP WITH TIME ZONE,
  last_cloud_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_markdown_files_user_id ON markdown_files(user_id);
CREATE INDEX IF NOT EXISTS idx_markdown_files_oriva_id ON markdown_files(oriva_id);
CREATE INDEX IF NOT EXISTS idx_markdown_files_path ON markdown_files(user_id, path);
CREATE INDEX IF NOT EXISTS idx_markdown_files_sync_status ON markdown_files(sync_status);
CREATE INDEX IF NOT EXISTS idx_markdown_files_updated_at ON markdown_files(updated_at);

-- =====================================================
-- MARKDOWN SECTIONS TABLE
-- Purpose: Store sections with ENTRY_ID tracking for threading
-- =====================================================

CREATE TABLE IF NOT EXISTS markdown_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES markdown_files(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  heading_level INTEGER DEFAULT 1 CHECK (heading_level BETWEEN 1 AND 6),
  order_index INTEGER NOT NULL,
  parent_section_id UUID REFERENCES markdown_sections(id) ON DELETE CASCADE,
  response_count INTEGER DEFAULT 0,
  last_response_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_markdown_sections_file_id ON markdown_sections(file_id);
CREATE INDEX IF NOT EXISTS idx_markdown_sections_entry_id ON markdown_sections(entry_id);
CREATE INDEX IF NOT EXISTS idx_markdown_sections_order ON markdown_sections(file_id, order_index);
CREATE INDEX IF NOT EXISTS idx_markdown_sections_parent ON markdown_sections(parent_section_id);
CREATE INDEX IF NOT EXISTS idx_markdown_sections_response_count ON markdown_sections(response_count DESC);

-- =====================================================
-- SECTION RESPONSES TABLE
-- Purpose: Infinite dimensional response threading
-- =====================================================

CREATE TABLE IF NOT EXISTS section_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_entry_id UUID REFERENCES markdown_sections(entry_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('moderate', 'iterate', 'curate', 'applaud')),
  content TEXT NOT NULL,
  parent_response_id UUID REFERENCES section_responses(id) ON DELETE CASCADE,

  -- Threading depth tracking
  thread_depth INTEGER DEFAULT 0,
  thread_path TEXT[], -- Materialized path for efficient queries

  -- Engagement metrics
  reply_count INTEGER DEFAULT 0,
  applaud_count INTEGER DEFAULT 0,
  curation_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,

  -- Algorithmic scoring
  relevance_score FLOAT DEFAULT 0.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  traction_score FLOAT DEFAULT 0.0 CHECK (traction_score >= 0 AND traction_score <= 1),
  quality_score FLOAT DEFAULT 0.0 CHECK (quality_score >= 0 AND quality_score <= 1),

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by_user_id UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_section_responses_section ON section_responses(section_entry_id);
CREATE INDEX IF NOT EXISTS idx_section_responses_user ON section_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_section_responses_type ON section_responses(type);
CREATE INDEX IF NOT EXISTS idx_section_responses_parent ON section_responses(parent_response_id);
CREATE INDEX IF NOT EXISTS idx_section_responses_thread_depth ON section_responses(thread_depth);
CREATE INDEX IF NOT EXISTS idx_section_responses_relevance ON section_responses(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_section_responses_traction ON section_responses(traction_score DESC);
CREATE INDEX IF NOT EXISTS idx_section_responses_activity ON section_responses(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_section_responses_created ON section_responses(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_section_responses_feed ON section_responses(section_entry_id, traction_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_section_responses_thread ON section_responses(parent_response_id, created_at ASC);

-- =====================================================
-- RESPONSE INTERACTIONS TABLE
-- Purpose: Track user interactions with responses (applauds, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS response_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES section_responses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('applaud', 'bookmark', 'report', 'view')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Prevent duplicate interactions
  UNIQUE(response_id, user_id, interaction_type)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_response_interactions_response ON response_interactions(response_id);
CREATE INDEX IF NOT EXISTS idx_response_interactions_user ON response_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_response_interactions_type ON response_interactions(interaction_type);

-- =====================================================
-- FEED ITEMS TABLE
-- Purpose: Materialized view for personalized feeds
-- =====================================================

CREATE TABLE IF NOT EXISTS feed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  response_id UUID REFERENCES section_responses(id) ON DELETE CASCADE,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('following', 'trending', 'personalized', 'collections')),
  relevance_score FLOAT NOT NULL DEFAULT 0.0,
  feed_position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),

  -- Prevent duplicate feed items
  UNIQUE(user_id, response_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_feed_items_user_position ON feed_items(user_id, feed_position);
CREATE INDEX IF NOT EXISTS idx_feed_items_relevance ON feed_items(user_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_expires ON feed_items(expires_at);

-- =====================================================
-- SYNC LOGS TABLE
-- Purpose: Track sync operations for debugging and recovery
-- =====================================================

CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES markdown_files(id) ON DELETE SET NULL,
  operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('upload', 'download', 'conflict', 'resolve', 'delete')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  details JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_file ON sync_logs(file_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_operation ON sync_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON sync_logs(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE markdown_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE markdown_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Markdown Files Policies (skip if already exist from base schema)
DROP POLICY IF EXISTS "Users can manage their own markdown files" ON markdown_files;
CREATE POLICY "Users can manage their own markdown files" ON markdown_files
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view public markdown files" ON markdown_files;
CREATE POLICY "Users can view public markdown files" ON markdown_files
  FOR SELECT USING (is_private = false OR auth.uid() = user_id);

-- Markdown Sections Policies
DROP POLICY IF EXISTS "Users can manage sections of their files" ON markdown_sections;
CREATE POLICY "Users can manage sections of their files" ON markdown_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM markdown_files
      WHERE markdown_files.id = markdown_sections.file_id
      AND markdown_files.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view sections of accessible files" ON markdown_sections;
CREATE POLICY "Users can view sections of accessible files" ON markdown_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM markdown_files
      WHERE markdown_files.id = markdown_sections.file_id
      AND (markdown_files.is_private = false OR markdown_files.user_id = auth.uid())
    )
  );

-- Section Responses Policies
DROP POLICY IF EXISTS "Users can manage their own responses" ON section_responses;
CREATE POLICY "Users can manage their own responses" ON section_responses
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view responses on accessible sections" ON section_responses;
CREATE POLICY "Users can view responses on accessible sections" ON section_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM markdown_sections
      JOIN markdown_files ON markdown_files.id = markdown_sections.file_id
      WHERE markdown_sections.entry_id = section_responses.section_entry_id
      AND (markdown_files.is_private = false OR markdown_files.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create responses on accessible sections" ON section_responses;
CREATE POLICY "Users can create responses on accessible sections" ON section_responses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM markdown_sections
      JOIN markdown_files ON markdown_files.id = markdown_sections.file_id
      WHERE markdown_sections.entry_id = section_responses.section_entry_id
      AND (markdown_files.is_private = false OR markdown_files.user_id = auth.uid())
    )
  );

-- Response Interactions Policies
DROP POLICY IF EXISTS "Users can manage their own interactions" ON response_interactions;
CREATE POLICY "Users can manage their own interactions" ON response_interactions
  FOR ALL USING (auth.uid() = user_id);

-- Feed Items Policies
DROP POLICY IF EXISTS "Users can manage their own feed items" ON feed_items;
CREATE POLICY "Users can manage their own feed items" ON feed_items
  FOR ALL USING (auth.uid() = user_id);

-- Sync Logs Policies
DROP POLICY IF EXISTS "Users can view their own sync logs" ON sync_logs;
CREATE POLICY "Users can view their own sync logs" ON sync_logs
  FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_markdown_files_updated_at ON markdown_files;
CREATE TRIGGER update_markdown_files_updated_at
  BEFORE UPDATE ON markdown_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_markdown_sections_updated_at ON markdown_sections;
CREATE TRIGGER update_markdown_sections_updated_at
  BEFORE UPDATE ON markdown_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_section_responses_updated_at ON section_responses;
CREATE TRIGGER update_section_responses_updated_at
  BEFORE UPDATE ON section_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update response counts
CREATE OR REPLACE FUNCTION update_response_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update parent response reply count
  IF NEW.parent_response_id IS NOT NULL THEN
    UPDATE section_responses
    SET reply_count = reply_count + 1,
        last_activity_at = NOW()
    WHERE id = NEW.parent_response_id;
  END IF;

  -- Update section response count
  UPDATE markdown_sections
  SET response_count = response_count + 1,
      last_response_at = NOW()
  WHERE entry_id = NEW.section_entry_id;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply response count trigger (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_response_counts_trigger ON section_responses;
CREATE TRIGGER update_response_counts_trigger
  AFTER INSERT ON section_responses
  FOR EACH ROW EXECUTE FUNCTION update_response_counts();

-- Function to update thread paths
CREATE OR REPLACE FUNCTION update_thread_path()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate thread depth and path
  IF NEW.parent_response_id IS NULL THEN
    NEW.thread_depth = 0;
    NEW.thread_path = ARRAY[NEW.id::TEXT];
  ELSE
    SELECT
      thread_depth + 1,
      thread_path || NEW.id::TEXT
    INTO NEW.thread_depth, NEW.thread_path
    FROM section_responses
    WHERE id = NEW.parent_response_id;
  END IF;

  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply thread path trigger (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_thread_path_trigger ON section_responses;
CREATE TRIGGER update_thread_path_trigger
  BEFORE INSERT ON section_responses
  FOR EACH ROW EXECUTE FUNCTION update_thread_path();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get response thread hierarchy
CREATE OR REPLACE FUNCTION get_response_thread(section_entry_id_param UUID, max_depth INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  content TEXT,
  user_id UUID,
  type VARCHAR(20),
  parent_response_id UUID,
  thread_depth INTEGER,
  reply_count INTEGER,
  applaud_count INTEGER,
  relevance_score FLOAT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.content,
    r.user_id,
    r.type,
    r.parent_response_id,
    r.thread_depth,
    r.reply_count,
    r.applaud_count,
    r.relevance_score,
    r.created_at
  FROM section_responses r
  WHERE r.section_entry_id = section_entry_id_param
    AND r.thread_depth <= max_depth
  ORDER BY r.thread_path;
END;
$$ language 'plpgsql';

-- Function to calculate traction score
CREATE OR REPLACE FUNCTION calculate_traction_score(response_id_param UUID)
RETURNS FLOAT AS $$
DECLARE
  reply_weight FLOAT := 0.4;
  applaud_weight FLOAT := 0.3;
  curation_weight FLOAT := 0.3;
  max_replies INTEGER := 15;
  max_applauds INTEGER := 25;
  max_curations INTEGER := 8;
  normalized_replies FLOAT;
  normalized_applauds FLOAT;
  normalized_curations FLOAT;
  score FLOAT;
BEGIN
  SELECT
    LEAST(reply_count::FLOAT / max_replies, 1.0),
    LEAST(applaud_count::FLOAT / max_applauds, 1.0),
    LEAST(curation_count::FLOAT / max_curations, 1.0)
  INTO normalized_replies, normalized_applauds, normalized_curations
  FROM section_responses
  WHERE id = response_id_param;

  score := (normalized_replies * reply_weight) +
           (normalized_applauds * applaud_weight) +
           (normalized_curations * curation_weight);

  RETURN GREATEST(0.0, LEAST(1.0, score));
END;
$$ language 'plpgsql';

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Sample data insertion removed to prevent foreign key constraint violations
-- Test data should be created with valid user IDs in development environment

-- Comment: Migration completed successfully
-- This migration creates the complete database schema for EntryCard enhancement
-- including markdown sync, response threading, and feed generation capabilities.