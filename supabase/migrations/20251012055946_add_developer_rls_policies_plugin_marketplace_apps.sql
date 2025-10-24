-- Migration: Add RLS policies for developers to manage their own apps
-- Created: 2025-10-12
-- Issue: Developers getting 403 errors when trying to access plugin_marketplace_apps
-- Root Cause: Table has RLS enabled but only has admin policies, no developer policies

-- Policy 1: Developers can view their own apps
CREATE POLICY "Developers can view own apps"
ON "public"."plugin_marketplace_apps"
FOR SELECT
USING (
  "auth"."uid"() = "developer_id"
);

-- Policy 2: Developers can insert their own apps
CREATE POLICY "Developers can create apps"
ON "public"."plugin_marketplace_apps"
FOR INSERT
WITH CHECK (
  "auth"."uid"() = "developer_id"
);

-- Policy 3: Developers can update their own apps
CREATE POLICY "Developers can update own apps"
ON "public"."plugin_marketplace_apps"
FOR UPDATE
USING (
  "auth"."uid"() = "developer_id"
)
WITH CHECK (
  "auth"."uid"() = "developer_id"
);

-- Policy 4: Developers can delete their own apps
CREATE POLICY "Developers can delete own apps"
ON "public"."plugin_marketplace_apps"
FOR DELETE
USING (
  "auth"."uid"() = "developer_id"
);

-- Policy 5: Public users can view approved apps (for marketplace browsing)
CREATE POLICY "Public can view approved apps"
ON "public"."plugin_marketplace_apps"
FOR SELECT
USING (
  "status" = 'approved' AND "is_active" = true
);

-- Note: Admin policies already exist from previous migration
-- "Admins can update app status" - allows admins to update any app
-- "Admins can view all apps" - allows admins to view any app
