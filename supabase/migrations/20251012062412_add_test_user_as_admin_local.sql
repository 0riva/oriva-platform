-- Add test@example.com as admin user (local development only)
-- This migration updates RLS policies to recognize test@example.com as an admin

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can update app status" ON "public"."plugin_marketplace_apps";
DROP POLICY IF EXISTS "Admins can view all apps" ON "public"."plugin_marketplace_apps";

-- Recreate admin policies with test@example.com included
-- Note: In production, only tools@gavrielshaw.com should be admin
-- For local development, we also allow test@example.com
CREATE POLICY "Admins can update app status"
ON "public"."plugin_marketplace_apps"
FOR UPDATE
USING (
  (auth.jwt() ->> 'email') = 'tools@gavrielshaw.com'
  OR (auth.jwt() ->> 'email') = 'test@example.com'
);

CREATE POLICY "Admins can view all apps"
ON "public"."plugin_marketplace_apps"
FOR SELECT
USING (
  (auth.jwt() ->> 'email') = 'tools@gavrielshaw.com'
  OR (auth.jwt() ->> 'email') = 'test@example.com'
);

-- Add comment for documentation
COMMENT ON POLICY "Admins can update app status" ON "public"."plugin_marketplace_apps"
IS 'Allows admin users (tools@gavrielshaw.com and test@example.com for local dev) to update any app status';

COMMENT ON POLICY "Admins can view all apps" ON "public"."plugin_marketplace_apps"
IS 'Allows admin users (tools@gavrielshaw.com and test@example.com for local dev) to view all apps';
