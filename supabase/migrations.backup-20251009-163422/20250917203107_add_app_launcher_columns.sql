-- Add app launcher configuration columns to plugin_marketplace_apps table

-- Create plugin_marketplace_apps table if it doesn't exist
CREATE TABLE IF NOT EXISTS plugin_marketplace_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  developer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_url TEXT NOT NULL,
  icon_url TEXT,
  version TEXT DEFAULT '1.0.0',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected', 'suspended')),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on plugin_marketplace_apps if not already enabled
ALTER TABLE plugin_marketplace_apps ENABLE ROW LEVEL SECURITY;

-- Add display_config column for app display preferences
ALTER TABLE plugin_marketplace_apps
ADD COLUMN IF NOT EXISTS display_config JSONB DEFAULT '{
  "preferred_mode": "fullscreen",
  "supports_panel": true,
  "supports_fullscreen": true,
  "min_width": 400,
  "min_height": 300,
  "responsive": true
}'::jsonb;

-- Add iframe_options column for iframe embedding configuration
ALTER TABLE plugin_marketplace_apps
ADD COLUMN IF NOT EXISTS iframe_options JSONB DEFAULT '{
  "allow_frame_ancestors": true,
  "custom_sandbox": [
    "allow-scripts",
    "allow-same-origin",
    "allow-forms",
    "allow-popups",
    "allow-modals",
    "allow-pointer-lock",
    "allow-top-navigation-by-user-activation"
  ],
  "bypass_xframe_protection": false
}'::jsonb;

-- Add sandbox_config column for security and resource limits
ALTER TABLE plugin_marketplace_apps
ADD COLUMN IF NOT EXISTS sandbox_config JSONB DEFAULT '{
  "allowedDomains": [],
  "allowStorage": false,
  "allowNetworking": false,
  "allowLocation": false,
  "maxMemoryMB": 500,
  "maxExecutionTime": 300000
}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN plugin_marketplace_apps.display_config IS 'App display configuration for launcher (preferred_mode, supports_panel, supports_fullscreen, min_width, min_height, responsive)';
COMMENT ON COLUMN plugin_marketplace_apps.iframe_options IS 'Iframe embedding options (allow_frame_ancestors, custom_sandbox, bypass_xframe_protection)';
COMMENT ON COLUMN plugin_marketplace_apps.sandbox_config IS 'Security and resource limit configuration (allowedDomains, allowStorage, allowNetworking, allowLocation, maxMemoryMB, maxExecutionTime)';

-- Update existing apps to have default configurations
UPDATE plugin_marketplace_apps
SET
  display_config = '{
    "preferred_mode": "fullscreen",
    "supports_panel": true,
    "supports_fullscreen": true,
    "min_width": 400,
    "min_height": 300,
    "responsive": true
  }'::jsonb,
  iframe_options = '{
    "allow_frame_ancestors": true,
    "custom_sandbox": [
      "allow-scripts",
      "allow-same-origin",
      "allow-forms",
      "allow-popups",
      "allow-modals",
      "allow-pointer-lock",
      "allow-top-navigation-by-user-activation"
    ],
    "bypass_xframe_protection": false
  }'::jsonb,
  sandbox_config = '{
    "allowedDomains": [],
    "allowStorage": false,
    "allowNetworking": false,
    "allowLocation": false,
    "maxMemoryMB": 500,
    "maxExecutionTime": 300000
  }'::jsonb
WHERE display_config IS NULL OR iframe_options IS NULL OR sandbox_config IS NULL;