-- =============================================================================
-- ORIVA PLATFORM DATABASE SCHEMA
-- =============================================================================

-- Developer API Keys table for persistent storage
CREATE TABLE IF NOT EXISTS developer_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of the actual key
  key_prefix VARCHAR(50) NOT NULL, -- First 20 chars for identification (oriva_pk_test_...)
  name VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL, -- Reference to the user who owns this key
  permissions TEXT[] DEFAULT ARRAY['read'], -- Array of permissions
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by_ip INET,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookups by key hash
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_hash ON developer_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_user_id ON developer_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_active ON developer_api_keys(is_active);

-- Plugin Marketplace Apps table
CREATE TABLE IF NOT EXISTS plugin_marketplace_apps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  category VARCHAR(100),
  icon_url TEXT,
  screenshots TEXT[], -- Array of screenshot URLs
  version VARCHAR(50) DEFAULT '1.0.0',
  pricing_model VARCHAR(50) DEFAULT 'free', -- free, one_time, subscription
  pricing_config JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) DEFAULT 'draft', -- draft, pending_review, approved, rejected
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  featured_order INTEGER,
  install_count INTEGER DEFAULT 0,
  developer_id UUID NOT NULL, -- Reference to the developer
  developer_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  reviewer_notes TEXT
);

-- Indexes for plugin_marketplace_apps
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_apps_slug ON plugin_marketplace_apps(slug);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_apps_status ON plugin_marketplace_apps(status);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_apps_developer_id ON plugin_marketplace_apps(developer_id);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_apps_category ON plugin_marketplace_apps(category);
CREATE INDEX IF NOT EXISTS idx_plugin_marketplace_apps_featured ON plugin_marketplace_apps(is_featured, featured_order);

-- User App Installs table
CREATE TABLE IF NOT EXISTS user_app_installs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL, -- Reference to the user
  app_id UUID NOT NULL REFERENCES plugin_marketplace_apps(id) ON DELETE CASCADE,
  installed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uninstalled_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  app_settings JSONB DEFAULT '{}'::jsonb
);

-- Indexes for user_app_installs
CREATE INDEX IF NOT EXISTS idx_user_app_installs_user_id ON user_app_installs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_installs_app_id ON user_app_installs(app_id);
CREATE INDEX IF NOT EXISTS idx_user_app_installs_active ON user_app_installs(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_app_installs_unique_active ON user_app_installs(user_id, app_id) WHERE is_active = true;

-- Plugin Versions table (for version history)
CREATE TABLE IF NOT EXISTS plugin_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id UUID NOT NULL REFERENCES plugin_marketplace_apps(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  release_notes TEXT,
  download_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for plugin_versions
CREATE INDEX IF NOT EXISTS idx_plugin_versions_app_id ON plugin_versions(app_id);
CREATE INDEX IF NOT EXISTS idx_plugin_versions_version ON plugin_versions(version);

-- API Key usage logs (optional, for audit trail)
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES developer_api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  response_status INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage(created_at);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to increment install count
CREATE OR REPLACE FUNCTION increment_install_count(app_id_in UUID)
RETURNS void AS $$
BEGIN
  UPDATE plugin_marketplace_apps 
  SET install_count = install_count + 1 
  WHERE id = app_id_in;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement install count
CREATE OR REPLACE FUNCTION decrement_install_count(app_id_in UUID)
RETURNS void AS $$
BEGIN
  UPDATE plugin_marketplace_apps 
  SET install_count = GREATEST(install_count - 1, 0) 
  WHERE id = app_id_in;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plugin_marketplace_apps_updated_at
  BEFORE UPDATE ON plugin_marketplace_apps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE developer_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_marketplace_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Policies to allow all operations for service role (our API server)
CREATE POLICY "Service role can manage developer_api_keys" ON developer_api_keys
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage plugin_marketplace_apps" ON plugin_marketplace_apps
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage user_app_installs" ON user_app_installs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage plugin_versions" ON plugin_versions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage api_key_usage" ON api_key_usage
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- SAMPLE DATA (for testing)
-- =============================================================================

-- Insert a sample app for testing
INSERT INTO plugin_marketplace_apps (
  id,
  name,
  slug,
  tagline,
  description,
  category,
  icon_url,
  version,
  status,
  is_active,
  install_count,
  developer_id,
  developer_name
) VALUES (
  'e06a3dae-0268-4b2f-96d0-71be22a13f64',
  'Video Work Buddy',
  'video-work-buddy',
  'AI-powered video editing assistant',
  'A powerful AI assistant that helps you edit videos faster and more efficiently.',
  'productivity',
  'https://example.com/icon.png',
  '1.0.0',
  'approved',
  true,
  1,
  'd5d7911d-c847-4733-b8b8-d1a1939ff77d',
  'Test Developer'
) ON CONFLICT (id) DO NOTHING;

-- Insert a sample user app install
INSERT INTO user_app_installs (
  id,
  user_id,
  app_id,
  installed_at,
  is_active,
  app_settings
) VALUES (
  gen_random_uuid(),
  'd5d7911d-c847-4733-b8b8-d1a1939ff77d',
  'e06a3dae-0268-4b2f-96d0-71be22a13f64',
  '2025-09-12T12:22:38.968Z',
  true,
  '{}'::jsonb
) ON CONFLICT DO NOTHING;
