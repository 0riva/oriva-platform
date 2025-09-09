-- API Keys table for persistent storage
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of the actual key
  key_prefix VARCHAR(50) NOT NULL, -- First 20 chars for identification (oriva_pk_test_...)
  app_name VARCHAR(255) NOT NULL,
  key_type VARCHAR(20) NOT NULL CHECK (key_type IN ('test', 'live')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_by_ip INET,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookups by key hash
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- API Key usage logs (optional, for audit trail)
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  response_status INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key_id ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage(created_at);

-- Row Level Security (RLS) - only allow operations with service role
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations for service role (our API server)
CREATE POLICY "Service role can manage api_keys" ON api_keys
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage api_key_usage" ON api_key_usage
  FOR ALL USING (auth.role() = 'service_role');
