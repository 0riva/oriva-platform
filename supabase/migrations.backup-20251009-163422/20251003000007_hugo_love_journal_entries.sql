-- Hugo Love: Journal Entries table
-- Personal reflections with partner sharing option
-- Aligns with specs/004-hugo-love-app/data-model.md and FR-064

CREATE TABLE IF NOT EXISTS hugo_love.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User reference (foreign key to oriva_platform.users)
  user_id UUID NOT NULL REFERENCES oriva_platform.users(id) ON DELETE CASCADE,

  -- Entry content
  title TEXT CHECK (length(title) <= 200),
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 10000),

  -- Mood tracking
  mood TEXT CHECK (mood IN (
    'great', 'good', 'okay', 'difficult', 'challenging', 'stressed', 'anxious'
  )),

  -- Partner sharing
  is_shared_with_partner BOOLEAN NOT NULL DEFAULT FALSE,
  partner_connection_id UUID, -- UUID of partner (from matches or partner connection)

  -- Tags for categorization
  tags TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_hugo_love_journal_entries_user ON hugo_love.journal_entries(user_id);
CREATE INDEX idx_hugo_love_journal_entries_created_at ON hugo_love.journal_entries(created_at DESC);
CREATE INDEX idx_hugo_love_journal_entries_mood ON hugo_love.journal_entries(mood);
CREATE INDEX idx_hugo_love_journal_entries_partner_connection ON hugo_love.journal_entries(partner_connection_id)
  WHERE partner_connection_id IS NOT NULL;
CREATE INDEX idx_hugo_love_journal_entries_shared ON hugo_love.journal_entries(is_shared_with_partner);
CREATE INDEX idx_hugo_love_journal_entries_tags ON hugo_love.journal_entries USING gin(tags);

-- RLS Policies: Users can only see their own entries + partner-shared entries
ALTER TABLE hugo_love.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own journal entries"
  ON hugo_love.journal_entries
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view partner-shared journal entries"
  ON hugo_love.journal_entries
  FOR SELECT
  USING (
    is_shared_with_partner = TRUE
    AND partner_connection_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM hugo_love.matches
      WHERE (matches.user_a_id = auth.uid() AND matches.user_b_id = journal_entries.user_id)
         OR (matches.user_b_id = auth.uid() AND matches.user_a_id = journal_entries.user_id)
    )
  );

CREATE POLICY "Users can insert their own journal entries"
  ON hugo_love.journal_entries
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own journal entries"
  ON hugo_love.journal_entries
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own journal entries"
  ON hugo_love.journal_entries
  FOR DELETE
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_hugo_love_journal_entries_updated_at
  BEFORE UPDATE ON hugo_love.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE hugo_love.journal_entries IS 'Personal journal entries with partner sharing (FR-064)';
COMMENT ON COLUMN hugo_love.journal_entries.is_shared_with_partner IS 'Shared entries visible to both partners';
COMMENT ON COLUMN hugo_love.journal_entries.partner_connection_id IS 'UUID of partner (from match or partner connection)';
COMMENT ON COLUMN hugo_love.journal_entries.mood IS 'Mood tracking: great, good, okay, difficult, challenging, stressed, anxious';
COMMENT ON COLUMN hugo_love.journal_entries.tags IS 'Tags for categorization and filtering';
