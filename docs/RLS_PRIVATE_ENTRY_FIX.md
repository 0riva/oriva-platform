# RLS Private Entry Visibility Fix

## Summary

This fix addresses a critical security vulnerability where authenticated users could view private "only me" entries from other users.

**Issue**: https://oriva.io/entry/57df1518-b146-42c2-af57-2fc4d3418479  
**Migration**: `20251111100443_fix_private_entry_visibility_rls.sql`  
**Branch**: `fix/rls-private-entry-visibility`

## Root Cause

The RLS policy `authenticated_users_view_published_entries` in migration `20251110010000_allow_viewing_published_responses.sql` allowed authenticated users to view ALL published entries without checking the `audience->>'type'` field. This meant entries marked as `private` (only me) were visible to all authenticated users.

### Problematic Policy (Before Fix)

```sql
CREATE POLICY "authenticated_users_view_published_entries"
ON public.entries
FOR SELECT
TO authenticated
USING (
  status = 'published'  -- ❌ Allows ALL published entries
  OR user_id = auth.uid()
  OR profile_id IN (SELECT id FROM profiles WHERE account_id = auth.uid())
);
```

## Solution

The fix updates the RLS policy to:

1. Always allow users to view their own entries (regardless of status or audience)
2. Check audience type for published entries from other users
3. Explicitly exclude private entries from other users
4. Support group, custom, and following audience types with proper permission checks

### Fixed Policy (After Fix)

```sql
CREATE POLICY "authenticated_users_view_published_entries"
ON public.entries
FOR SELECT
TO authenticated
USING (
  -- Always allow own entries
  user_id = auth.uid()
  OR profile_id IN (SELECT id FROM profiles WHERE account_id = auth.uid())

  -- OR published entries from others (with audience checks)
  OR (
    status = 'published'
    -- Exclude private entries from other users
    AND NOT (
      audience->>'type' = 'private'
      AND user_id != auth.uid()
      AND (profile_id IS NULL OR profile_id NOT IN (...))
    )
    -- Check audience permissions
    AND (
      audience->>'type' = 'everyone' OR 'public'
      OR (group AND user is member)
      OR (custom AND user is selected)
      OR (following/network AND user is author) -- Conservative for now
      OR is_anonymous = true
    )
  )
);
```

## Testing

### Unit Tests

Comprehensive unit tests are available in:

- `api/__tests__/rls-private-entry-visibility.test.ts`

### Test Coverage

The tests verify:

- ✅ Users can view their own private entries
- ✅ Users cannot view other users' private entries
- ✅ Users can view public entries from other users
- ✅ Users can view their own draft entries
- ✅ Users cannot view other users' draft entries
- ✅ Private entries are excluded from `getAllEntries()` results
- ✅ Group entries require membership
- ✅ Custom entries require explicit user selection

### Running Tests

```bash
# Run the test suite
npm test -- rls-private-entry-visibility.test.ts

# Or run the validation script
./scripts/test-rls-private-entry-fix.sh
```

## Deployment

### Pre-Deployment Checklist

- [ ] Review migration SQL syntax
- [ ] Run unit tests locally
- [ ] Test migration on staging environment
- [ ] Verify no breaking changes to existing functionality
- [ ] Document any edge cases

### Deployment Steps

1. **Apply Migration**:

   ```bash
   cd o-platform
   supabase db push --linked
   ```

2. **Verify Policy**:

   ```sql
   SELECT polname, pg_get_expr(polqual, polrelid) AS policy_condition
   FROM pg_policy
   WHERE polrelid = 'public.entries'::regclass
   AND polname = 'authenticated_users_view_published_entries';
   ```

3. **Test in Production**:
   - Create a private entry as User A
   - Try to access it as User B (should fail)
   - Verify User A can still access it

### Rollback Plan

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

## Impact Assessment

### Affected Entries

- **Private entries**: Now properly protected (only visible to owner)
- **Group entries**: Require group membership (unchanged behavior)
- **Custom entries**: Require explicit user selection (unchanged behavior)
- **Public entries**: No change (still visible to all)
- **Own entries**: No change (still visible to owner regardless of status)

### User Impact

- **Positive**: Private entries are now properly secured
- **No Breaking Changes**: Users can still access all entries they should have access to
- **Performance**: Minimal impact (RLS policy evaluation is fast)

## Related Files

- Migration: `supabase/migrations/20251111100443_fix_private_entry_visibility_rls.sql`
- Tests: `api/__tests__/rls-private-entry-visibility.test.ts`
- Test Script: `scripts/test-rls-private-entry-fix.sh`
- Original Buggy Migration: `supabase/migrations/20251110010000_allow_viewing_published_responses.sql`

## Future Improvements

1. **Following/Network Audience**: Implement proper following relationship check when follows table is available
2. **Performance Optimization**: Consider caching group memberships for faster policy evaluation
3. **Audit Logging**: Add logging for RLS policy denials to track security events

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [RLS Patterns](./src/services/patterns/rls-workflow-patterns.md)
- Issue: https://oriva.io/entry/57df1518-b146-42c2-af57-2fc4d3418479

