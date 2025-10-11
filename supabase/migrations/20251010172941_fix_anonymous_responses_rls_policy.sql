-- Fix RLS policy to allow authenticated anonymous responses
--
-- Problem: Current policy expects user_id IS NULL for anonymous responses,
-- but we set user_id to authenticated user (to satisfy NOT NULL constraint).
--
-- Current policy condition for anonymous:
--   (user_id IS NULL) AND (is_anonymous = true)
--
-- Our data for anonymous responses:
--   user_id = auth.uid() (authenticated user)
--   is_anonymous = true
--
-- This mismatch causes RLS to reject/strip response content.

-- Drop the problematic policy
DROP POLICY IF EXISTS "Authenticated users can create responses" ON responses;

-- Create new policy that allows both named and anonymous responses
-- as long as user_id matches the authenticated user
CREATE POLICY "Authenticated users can create responses" ON responses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add comment explaining the policy
COMMENT ON POLICY "Authenticated users can create responses" ON responses IS
  'Allows authenticated users to create both named and anonymous responses.
   Anonymous responses have is_anonymous=true and profile_id set to anonymous profile.
   Named responses have is_anonymous=false and profile_id set to named profile.
   Both types require user_id to match the authenticated user.';
