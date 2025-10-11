-- Fix storage RLS policies for entry-media bucket
-- Migration: 20251011033651_fix_storage_rls_policies.sql
--
-- Problem: Multiple conflicting RLS policies causing upload failures
-- Solution: Drop all existing policies and create clean, simple policies

-- Drop ALL existing policies on storage.objects for entry-media
DROP POLICY IF EXISTS "Allow all operations on entry-media" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can upload to entry-media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view entry media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to entry-media" ON storage.objects;
DROP POLICY IF EXISTS "Hybrid delete policy for entry media" ON storage.objects;
DROP POLICY IF EXISTS "Hybrid update policy for entry media" ON storage.objects;
DROP POLICY IF EXISTS "Hybrid upload policy for entry media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete entry media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update entry media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;

-- Create clean, simple policies for entry-media bucket
-- Policy 1: Public can read all files (bucket is public)
CREATE POLICY "entry_media_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'entry-media');

-- Policy 2: Authenticated users can upload files to their own folder
CREATE POLICY "entry_media_authenticated_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'entry-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Users can update their own files
CREATE POLICY "entry_media_authenticated_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'entry-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own files
CREATE POLICY "entry_media_authenticated_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'entry-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 5: Allow anonymous uploads for profile creation (TEMPORARY - remove after auth flow is complete)
-- This allows unauthenticated users to upload avatars during profile creation
CREATE POLICY "entry_media_anon_insert"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'entry-media');

-- Note: The anon policy above should be removed once the auth flow is complete
-- and all profile creation happens after authentication.
