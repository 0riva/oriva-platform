-- Fix users table INSERT policy to allow profile creation
-- This allows authenticated users to create their own profile in the users table
-- when they don't have one yet (e.g., during avatar upload)

-- Add INSERT policy for users table
CREATE POLICY "users_insert_own" ON "public"."users" 
FOR INSERT 
TO "authenticated" 
WITH CHECK (("id" = "auth"."uid"()));

-- Add comment explaining the policy
COMMENT ON POLICY "users_insert_own" ON "public"."users" IS 'Authenticated users can create their own profile in the users table';
