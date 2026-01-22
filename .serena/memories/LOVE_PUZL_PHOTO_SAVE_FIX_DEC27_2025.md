# Love Puzl Photo Save Fix - December 27, 2025

## Problem

Photo save was failing in Love Puzl Edit Profile screen with "Save failed" error.

## Root Cause

`/Users/cosmic/o-platform/src/express/routes/photos.ts` was using the old `hugo_love` schema:

1. Conditional checked `appId === 'hugo_love'` but Love Puzl sends `'love_puzl'`
2. Used `hugo_love.dating_profiles` table which was renamed to `love_puzl.dating_profiles` in migration `20251223022901`

## Fix (Commit e498a99)

1. Added `appendPhotoToLovePuzlProfile()` function (lines 188-233) that:
   - Queries `love_puzl.dating_profiles` by `oriva_profile_id` (not `user_id`)
   - Updates `profile_photos` JSONB array

2. Updated conditional at line 425 to handle `love_puzl`:
   - Uses `X-Profile-ID` header as `oriva_profile_id`
   - Logs warning if header missing

## Key Difference: hugo_love vs love_puzl

- **hugo_love**: Uses `user_id` (Supabase auth user ID)
- **love_puzl**: Uses `oriva_profile_id` (Oriva profile identity - DID)

This reflects the architectural change where Love Puzl uses profile-based identity (each Oriva profile can have its own dating identity) rather than user-based identity.

## Files Changed

- `/Users/cosmic/o-platform/src/express/routes/photos.ts`

## Related Migrations

- `20251223022901_rename_hugo_love_to_love_puzl.sql` - Schema rename
- `20251226024534_add_oriva_profile_id_to_dating_profiles.sql` - Added oriva_profile_id column
