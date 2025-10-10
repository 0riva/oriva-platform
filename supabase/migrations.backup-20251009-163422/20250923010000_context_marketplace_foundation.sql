-- =====================================================
-- Context Marketplace Foundation Migration
-- Purpose: Enable 3rd party app contexts within Oriva ecosystem
-- Context: Oriva team as "3rd party developers" for Work Buddy
-- =====================================================

-- =====================================================
-- CONTEXT SYSTEM FOUNDATION
-- Purpose: Core infrastructure for app marketplace contexts
-- =====================================================

-- Create user_preferences table (cannot modify auth.users directly)
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own preferences (drop first to make idempotent)
DROP POLICY IF EXISTS "user_preferences_policy" ON user_preferences;
CREATE POLICY "user_preferences_policy" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Comment: This allows users to have preferences across different app contexts
-- Example: { "oriva-core": { "theme": "dark" }, "oo-work-buddy": { "goal": "efficient meetings" } }

-- =====================================================
-- USER CONTEXTS TABLE
-- Purpose: Context-specific user profiles for 3rd party apps
-- =====================================================

CREATE TABLE IF NOT EXISTS user_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  context TEXT NOT NULL, -- 'oriva-core', 'oo-work-buddy', 'oo-dating', etc.
  bio TEXT,
  traits JSONB DEFAULT '{}', -- Context-specific traits: { "collaboration": 0.9, "punctuality": 0.8 }
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100), -- Context-specific scoring
  preferences JSONB DEFAULT '{}', -- Context-specific preferences
  metadata JSONB DEFAULT '{}', -- Flexible data for different app needs
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one profile per user per context
  UNIQUE(user_id, context)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_id ON user_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_context ON user_contexts(context);
CREATE INDEX IF NOT EXISTS idx_user_contexts_active ON user_contexts(context, is_active);
CREATE INDEX IF NOT EXISTS idx_user_contexts_score ON user_contexts(context, score DESC);

-- =====================================================
-- CONTEXT INTERACTIONS TABLE
-- Purpose: Track context-specific user interactions
-- =====================================================

CREATE TABLE IF NOT EXISTS context_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  context TEXT NOT NULL,
  type TEXT NOT NULL, -- 'appointment', 'meeting', 'swipe', 'rating', 'productivity_log'
  data JSONB DEFAULT '{}', -- Flexible interaction data
  metadata JSONB DEFAULT '{}', -- Additional context-specific metadata

  -- Optional reference to another user (for interactions between users)
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'archived')),

  -- Timestamps
  scheduled_at TIMESTAMP WITH TIME ZONE, -- For scheduled interactions like appointments
  completed_at TIMESTAMP WITH TIME ZONE, -- When interaction was completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_context_interactions_user ON context_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_context_interactions_context ON context_interactions(context);
CREATE INDEX IF NOT EXISTS idx_context_interactions_type ON context_interactions(context, type);
CREATE INDEX IF NOT EXISTS idx_context_interactions_status ON context_interactions(status);
CREATE INDEX IF NOT EXISTS idx_context_interactions_scheduled ON context_interactions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_context_interactions_created ON context_interactions(created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_context_interactions_user_context ON context_interactions(user_id, context);
CREATE INDEX IF NOT EXISTS idx_context_interactions_context_status ON context_interactions(context, status, created_at DESC);

-- =====================================================
-- HUGO AI KNOWLEDGE BASE TABLE
-- Purpose: Store AI coaching snippets for different contexts
-- =====================================================

CREATE TABLE IF NOT EXISTS hugo_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context TEXT NOT NULL, -- Which app context this knowledge applies to
  category TEXT NOT NULL, -- 'coaching', 'tips', 'guidance', 'onboarding'

  -- Input/Output for AI coaching
  input JSONB NOT NULL, -- User input/situation: { "goal": "efficient meetings", "challenge": "remote team" }
  output TEXT NOT NULL, -- AI response/advice: "Use 5-min standups with clear agendas"

  -- Quality metrics
  confidence_score FLOAT DEFAULT 1.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  usage_count INTEGER DEFAULT 0,
  success_rate FLOAT DEFAULT 0.0 CHECK (success_rate >= 0 AND success_rate <= 1),

  -- Content metadata
  tags TEXT[] DEFAULT '{}', -- For categorization and search
  language TEXT DEFAULT 'en', -- For internationalization
  version INTEGER DEFAULT 1, -- For content versioning

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hugo_kb_context ON hugo_knowledge_base(context);
CREATE INDEX IF NOT EXISTS idx_hugo_kb_category ON hugo_knowledge_base(context, category);
CREATE INDEX IF NOT EXISTS idx_hugo_kb_tags ON hugo_knowledge_base USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_hugo_kb_confidence ON hugo_knowledge_base(context, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_hugo_kb_usage ON hugo_knowledge_base(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_hugo_kb_active ON hugo_knowledge_base(context, is_active);

-- =====================================================
-- CONTEXT SETTINGS TABLE
-- Purpose: Store app-specific configuration and settings
-- =====================================================

CREATE TABLE IF NOT EXISTS context_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context TEXT NOT NULL,
  key TEXT NOT NULL, -- Setting key: 'max_appointments_per_day', 'default_meeting_duration'
  value JSONB NOT NULL, -- Setting value: 5, "30 minutes"
  description TEXT, -- Human-readable description
  data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'number', 'boolean', 'object', 'array')),
  is_user_configurable BOOLEAN DEFAULT false, -- Can users modify this setting?

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique settings per context
  UNIQUE(context, key)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_context_settings_context ON context_settings(context);
CREATE INDEX IF NOT EXISTS idx_context_settings_configurable ON context_settings(context, is_user_configurable);

-- =====================================================
-- CONTEXT SYSTEM FUNCTIONS
-- Purpose: Helper functions for context management
-- =====================================================

-- Function to set the current app context (for RLS)
CREATE OR REPLACE FUNCTION set_app_context(context_name TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.context', context_name, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the current app context
CREATE OR REPLACE FUNCTION get_app_context()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting('app.context', true), 'oriva-core');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a new user context profile
CREATE OR REPLACE FUNCTION create_user_context(
  p_user_id UUID,
  p_context TEXT,
  p_bio TEXT DEFAULT NULL,
  p_traits JSONB DEFAULT '{}',
  p_preferences JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  new_context_id UUID;
BEGIN
  INSERT INTO user_contexts (user_id, context, bio, traits, preferences)
  VALUES (p_user_id, p_context, p_bio, p_traits, p_preferences)
  ON CONFLICT (user_id, context)
  DO UPDATE SET
    bio = EXCLUDED.bio,
    traits = EXCLUDED.traits,
    preferences = EXCLUDED.preferences,
    updated_at = NOW()
  RETURNING id INTO new_context_id;

  RETURN new_context_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log context interactions
CREATE OR REPLACE FUNCTION log_context_interaction(
  p_user_id UUID,
  p_context TEXT,
  p_type TEXT,
  p_data JSONB DEFAULT '{}',
  p_target_user_id UUID DEFAULT NULL,
  p_scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  interaction_id UUID;
BEGIN
  INSERT INTO context_interactions (
    user_id, context, type, data, target_user_id, scheduled_at
  )
  VALUES (
    p_user_id, p_context, p_type, p_data, p_target_user_id, p_scheduled_at
  )
  RETURNING id INTO interaction_id;

  RETURN interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all context tables
ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hugo_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_settings ENABLE ROW LEVEL SECURITY;

-- User Contexts Policies (drop first to make idempotent)
DROP POLICY IF EXISTS "users_can_manage_own_contexts" ON user_contexts;
CREATE POLICY "users_can_manage_own_contexts" ON user_contexts
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "context_isolation_user_contexts" ON user_contexts;
CREATE POLICY "context_isolation_user_contexts" ON user_contexts
  FOR SELECT USING (
    auth.uid() = user_id AND
    context = get_app_context()
  );

-- Context Interactions Policies (drop first to make idempotent)
DROP POLICY IF EXISTS "users_can_manage_own_interactions" ON context_interactions;
CREATE POLICY "users_can_manage_own_interactions" ON context_interactions
  FOR ALL USING (auth.uid() = user_id OR auth.uid() = target_user_id);

DROP POLICY IF EXISTS "context_isolation_interactions" ON context_interactions;
CREATE POLICY "context_isolation_interactions" ON context_interactions
  FOR SELECT USING (
    (auth.uid() = user_id OR auth.uid() = target_user_id) AND
    context = get_app_context()
  );

-- Hugo Knowledge Base Policies (read-only for users) (drop first to make idempotent)
DROP POLICY IF EXISTS "context_kb_read_access" ON hugo_knowledge_base;
CREATE POLICY "context_kb_read_access" ON hugo_knowledge_base
  FOR SELECT USING (
    context = get_app_context() AND is_active = true
  );

-- Only system can modify knowledge base (drop first to make idempotent)
DROP POLICY IF EXISTS "context_kb_system_only" ON hugo_knowledge_base;
CREATE POLICY "context_kb_system_only" ON hugo_knowledge_base
  FOR ALL USING (false); -- This will be managed by system/admin functions

-- Context Settings Policies (drop first to make idempotent)
DROP POLICY IF EXISTS "context_settings_read_access" ON context_settings;
CREATE POLICY "context_settings_read_access" ON context_settings
  FOR SELECT USING (context = get_app_context());

-- Only system can modify settings (drop first to make idempotent)
DROP POLICY IF EXISTS "context_settings_system_only" ON context_settings;
CREATE POLICY "context_settings_system_only" ON context_settings
  FOR ALL USING (false); -- This will be managed by system/admin functions

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
$$ LANGUAGE 'plpgsql';

-- Apply updated_at triggers (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_contexts_updated_at ON user_contexts;
CREATE TRIGGER update_user_contexts_updated_at
  BEFORE UPDATE ON user_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_context_interactions_updated_at ON context_interactions;
CREATE TRIGGER update_context_interactions_updated_at
  BEFORE UPDATE ON context_interactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_hugo_kb_updated_at ON hugo_knowledge_base;
CREATE TRIGGER update_hugo_kb_updated_at
  BEFORE UPDATE ON hugo_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_context_settings_updated_at ON context_settings;
CREATE TRIGGER update_context_settings_updated_at
  BEFORE UPDATE ON context_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update usage statistics
CREATE OR REPLACE FUNCTION update_kb_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update usage count and last used timestamp
  UPDATE hugo_knowledge_base
  SET
    usage_count = usage_count + 1,
    last_used_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- =====================================================
-- INITIAL CONTEXT CONFIGURATION
-- =====================================================

-- Insert default context settings for Oriva Core
INSERT INTO context_settings (context, key, value, description, data_type, is_user_configurable) VALUES
('oriva-core', 'max_entries_per_day', '50', 'Maximum entries a user can create per day', 'number', false),
('oriva-core', 'enable_anonymous_entries', 'true', 'Allow users to create anonymous entries', 'boolean', true),
('oriva-core', 'default_audience_type', '"PUBLIC"', 'Default audience type for new entries', 'string', true),
('oriva-core', 'enable_threading', 'true', 'Enable response threading', 'boolean', false);

-- =====================================================
-- HELPER VIEWS FOR ANALYTICS
-- =====================================================

-- View for context usage analytics
CREATE OR REPLACE VIEW context_usage_stats AS
SELECT
  context,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) as total_interactions,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as interactions_24h,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as interactions_7d,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as interactions_30d
FROM context_interactions
GROUP BY context;

-- View for user context summary
CREATE OR REPLACE VIEW user_context_summary AS
SELECT
  uc.user_id,
  uc.context,
  uc.bio,
  uc.score,
  uc.is_active,
  uc.created_at,
  COUNT(ci.id) as interaction_count,
  MAX(ci.created_at) as last_interaction_at
FROM user_contexts uc
LEFT JOIN context_interactions ci ON uc.user_id = ci.user_id AND uc.context = ci.context
GROUP BY uc.user_id, uc.context, uc.bio, uc.score, uc.is_active, uc.created_at;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

-- Comment: This migration creates the foundation for Oriva's 3rd party app marketplace
-- It allows the Oriva team to act as "3rd party developers" for apps like Work Buddy
-- while maintaining complete data segregation between contexts.

-- Key Features:
-- 1. Context-based data isolation using RLS
-- 2. Flexible user profiles per context
-- 3. Interaction tracking for different app types
-- 4. Hugo AI knowledge base for context-specific coaching
-- 5. Configuration system for app-specific settings

-- Next Steps:
-- 1. Run the Work Buddy specific migration
-- 2. Update API endpoints to support context switching
-- 3. Modify frontend to handle context-aware data
-- 4. Implement Hugo AI integration for coaching features