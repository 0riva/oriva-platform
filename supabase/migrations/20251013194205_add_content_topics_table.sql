-- Create content_topics table for AI-extracted topic analysis
-- This table stores topics extracted from entry content using OpenAI

CREATE TABLE content_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL,
  topic_label TEXT NOT NULL,
  confidence_score FLOAT NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  keywords TEXT[] NOT NULL DEFAULT '{}',
  source TEXT DEFAULT 'ai',
  extraction_method TEXT DEFAULT 'openai-gpt4',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique topic per entry
  UNIQUE(entry_id, topic_slug)
);

-- Create indexes for fast lookups
CREATE INDEX idx_content_topics_entry_id ON content_topics(entry_id);
CREATE INDEX idx_content_topics_confidence ON content_topics(confidence_score DESC);
CREATE INDEX idx_content_topics_slug ON content_topics(topic_slug);
CREATE INDEX idx_content_topics_category ON content_topics(category);

-- Enable RLS
ALTER TABLE content_topics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see topics for their own entries
CREATE POLICY "Users can view topics for their own entries" ON content_topics
  FOR SELECT USING (
    entry_id IN (
      SELECT id FROM entries WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert topics for their own entries
CREATE POLICY "Users can insert topics for their own entries" ON content_topics
  FOR INSERT WITH CHECK (
    entry_id IN (
      SELECT id FROM entries WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can update topics for their own entries
CREATE POLICY "Users can update topics for their own entries" ON content_topics
  FOR UPDATE USING (
    entry_id IN (
      SELECT id FROM entries WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can delete topics for their own entries
CREATE POLICY "Users can delete topics for their own entries" ON content_topics
  FOR DELETE USING (
    entry_id IN (
      SELECT id FROM entries WHERE user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_topics_updated_at 
  BEFORE UPDATE ON content_topics 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
