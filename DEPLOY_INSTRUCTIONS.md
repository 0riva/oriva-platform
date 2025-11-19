# Deployment Instructions: RLS Private Entry Visibility Fix

## Migration File

`supabase/migrations/20251111100443_fix_private_entry_visibility_rls.sql`

## Status

✅ **Tested locally** - All 9 unit tests passing
✅ **Ready for production**

## Deployment Methods

### Method 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/[your-project-ref]/sql/new
2. Copy the entire contents of `supabase/migrations/20251111100443_fix_private_entry_visibility_rls.sql`
3. Paste into SQL Editor
4. Click "Run" to execute
5. Verify the policy was created:
   ```sql
   SELECT polname FROM pg_policy
   WHERE polrelid = 'public.entries'::regclass
   AND polname = 'authenticated_users_view_published_entries';
   ```

### Method 2: Supabase CLI (After fixing migration history)

If you need to fix migration history first:

```bash
cd o-platform

# Repair migration history for o-core migrations that exist in production
supabase migration repair --status applied 20251111000000 20251111000001 20251111140444

# Then deploy
supabase db push --linked
```

### Method 3: Direct psql Connection

```bash
# Connect to production database
psql "postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Apply migration
\i supabase/migrations/20251111100443_fix_private_entry_visibility_rls.sql
```

## Verification

After deployment, verify the fix:

```sql
-- Check policy exists
SELECT polname, pg_get_expr(polqual, polrelid)
FROM pg_policy
WHERE polrelid = 'public.entries'::regclass
AND polname = 'authenticated_users_view_published_entries';

-- Test: Try to access a private entry from another user (should fail)
-- This should return 0 rows for a non-owner
SELECT * FROM entries
WHERE id = '57df1518-b146-42c2-af57-2fc4d3418479'
AND audience->>'type' = 'private';
```

## Rollback (If Needed)

If issues occur, rollback by reapplying the original policy:

```sql
DROP POLICY IF EXISTS "authenticated_users_view_published_entries" ON public.entries;

CREATE POLICY "authenticated_users_view_published_entries"
ON public.entries
FOR SELECT
TO authenticated
USING (
  status = 'published'
  OR user_id = auth.uid()
  OR profile_id IN (SELECT id FROM profiles WHERE account_id = auth.uid())
);
```

**Note**: Rollback will reintroduce the security vulnerability. Only use if absolutely necessary.

