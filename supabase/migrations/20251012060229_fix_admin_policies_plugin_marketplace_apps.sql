-- Migration: Fix admin policies that query auth.users table
-- Created: 2025-10-12
-- Issue: Admin policies causing "permission denied for table users" error for non-admin users
-- Root Cause: Admin policies query auth.users which requires special permissions
--             PostgreSQL evaluates ALL SELECT policies, so the admin policy fails for regular users
-- Solution: Use auth.jwt() to check email claim instead of querying auth.users table

-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can update app status" ON "public"."plugin_marketplace_apps";
DROP POLICY IF EXISTS "Admins can view all apps" ON "public"."plugin_marketplace_apps";

-- Recreate admin policies using JWT claims instead of auth.users table
CREATE POLICY "Admins can update app status"
ON "public"."plugin_marketplace_apps"
FOR UPDATE
USING (
  (auth.jwt() ->> 'email') = 'tools@gavrielshaw.com'
);

CREATE POLICY "Admins can view all apps"
ON "public"."plugin_marketplace_apps"
FOR SELECT
USING (
  (auth.jwt() ->> 'email') = 'tools@gavrielshaw.com'
);
