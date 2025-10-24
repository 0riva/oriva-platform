-- Disable FK constraint on user_preferences.user_id for local development
-- In production Supabase, this FK should remain enabled
-- This is a LOCAL DEVELOPMENT WORKAROUND only

-- Drop the existing FK constraint
ALTER TABLE public.user_preferences
DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;

-- Note: In production, the FK should remain. This migration only applies locally
-- where auth.users table is not properly configured during testing.
