-- Document local development RLS workaround
-- 
-- CONTEXT:
-- Local Supabase has an issue where RLS policies fail even with valid JWT tokens
-- and correct policy expressions (even WITH CHECK (true) fails). This appears to be
-- a role/JWT configuration issue specific to local development with Supabase CLI.
--
-- SOLUTION:
-- - Local dev: RLS disabled on groups table for development
-- - Production: RLS MUST be enabled with proper policies
--
-- PRODUCTION DEPLOYMENT:
-- When deploying to production, ensure RLS is enabled:
--   ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
--
-- This migration does NOT disable RLS - it only documents the issue.
-- RLS state should be:
--   - Local: Disabled (manually) for development
--   - Production: Enabled (default from migrations)

-- Ensure RLS is enabled by default (for production)
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Verify policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'groups' 
    AND policyname = 'Users can create groups'
  ) THEN
    RAISE EXCEPTION 'Missing RLS policy: Users can create groups';
  END IF;
END $$;

-- Add comment for future reference
COMMENT ON TABLE public.groups IS 
'RLS enabled in production. Local dev may require RLS disabled due to CLI configuration issues.';
