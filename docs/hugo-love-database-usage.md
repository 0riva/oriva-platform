# Hugo Love Database Usage Guide

Hugo Love is a dating app built on the Oriva platform. Instead of using BFF API endpoints, Hugo Love interacts **directly with its database tables** via the Supabase client.

## Architecture

```
Hugo Love Frontend → Supabase Client → OrivaDB hugo_love.* tables
```

**Benefits:**
- ✅ Zero BFF function count impact (no Vercel limit issues)
- ✅ Real-time subscriptions for instant updates
- ✅ Automatic authentication via Supabase
- ✅ RLS policies protect user data
- ✅ Scales infinitely

## Database Tables

### 1. `hugo_love.swipes`
Records user swipe actions (like/dislike/review).

**Frontend Usage:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Record a swipe
await supabase.from('hugo_love.swipes').insert({
  user_id: currentUserId,
  target_user_id: targetProfileId,
  direction: 'like' // or 'dislike' or 'review'
});

// Get my swipes
const { data: mySwipes } = await supabase
  .from('hugo_love.swipes')
  .select('*')
  .eq('user_id', currentUserId)
  .order('timestamp', { ascending: false });
```

**Security:** RLS ensures users can only insert/view their own swipes.

---

### 2. `hugo_love.ratings`
User ratings on 4 factors (looks, personality, interests, lifestyle).

**Frontend Usage:**
```typescript
// Submit a rating
await supabase.from('hugo_love.ratings').insert({
  rater_id: currentUserId,
  rated_user_id: profileToRate,
  looks: 4,
  personality: 5,
  interests: 4,
  lifestyle: 3,
  average_score: 4.0, // calculated: (4+5+4+3)/4
  comment: 'Great conversation starter!'
});

// Get my average ratings (using helper function)
const { data: stats } = await supabase
  .rpc('hugo_love.get_user_rating_stats', {
    p_user_id: currentUserId
  });
// Returns: { total_ratings, avg_looks, avg_personality, ... }
```

**Security:** Users can rate others, but can only update/delete their own ratings.

---

### 3. `hugo_love.matches`
Mutual likes between users (auto-created by database trigger).

**Frontend Usage:**
```typescript
// Get my matches
const { data: matches } = await supabase
  .from('hugo_love.matches')
  .select('*, user_id_1, user_id_2, conversation_id, status')
  .or(`user_id_1.eq.${currentUserId},user_id_2.eq.${currentUserId}`)
  .eq('status', 'active')
  .order('created_at', { ascending: false });

// Real-time match notifications
const subscription = supabase
  .channel('my-matches')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'hugo_love',
    table: 'matches',
    filter: `user_id_1=eq.${currentUserId},user_id_2=eq.${currentUserId}`
  }, (payload) => {
    console.log('New match!', payload.new);
    showMatchNotification(payload.new);
  })
  .subscribe();
```

**Auto-Match Logic:**
When User A likes User B, and User B has already liked User A, a match is **automatically created** by the database trigger `create_match_on_mutual_like()`.

**Security:** Users can only view matches they're part of.

---

### 4. `hugo_love.blocks`
User blocking for privacy and safety.

**Frontend Usage:**
```typescript
// Block a user
await supabase.from('hugo_love.blocks').insert({
  blocker_id: currentUserId,
  blocked_id: userToBlock,
  reason: 'Inappropriate behavior' // optional
});

// Unblock a user
await supabase
  .from('hugo_love.blocks')
  .delete()
  .eq('blocker_id', currentUserId)
  .eq('blocked_id', userToUnblock);

// Get my blocked users
const { data: blocked } = await supabase
  .from('hugo_love.blocks')
  .select('blocked_id, created_at')
  .eq('blocker_id', currentUserId);
```

**Security:** Users can only manage their own blocks.

---

## Helper Functions

### `hugo_love.get_user_match_stats(user_id)`
Get match and swipe statistics for a user.

```typescript
const { data } = await supabase.rpc('hugo_love.get_user_match_stats', {
  p_user_id: currentUserId
});
// Returns: {
//   total_matches: 5,
//   active_matches: 4,
//   total_likes_sent: 20,
//   total_likes_received: 15
// }
```

### `hugo_love.get_user_rating_stats(user_id)`
Get average ratings for a user.

```typescript
const { data } = await supabase.rpc('hugo_love.get_user_rating_stats', {
  p_user_id: profileUserId
});
// Returns: {
//   total_ratings: 8,
//   avg_looks: 4.2,
//   avg_personality: 4.8,
//   avg_interests: 4.1,
//   avg_lifestyle: 4.5,
//   avg_overall: 4.4
// }
```

---

## Security: Row Level Security (RLS)

All tables have RLS policies that ensure:
- ✅ Users can only insert their own swipes/ratings/blocks
- ✅ Users can view swipes they gave or received (for match detection)
- ✅ Users can only view matches they're part of
- ✅ Users can only manage their own blocks
- ✅ Auto-match trigger runs with elevated privileges (SECURITY DEFINER)

---

## Best Practices

### 1. Filter Blocked Users
Before showing profiles, filter out blocked users:

```typescript
const { data: myBlocks } = await supabase
  .from('hugo_love.blocks')
  .select('blocked_id')
  .eq('blocker_id', currentUserId);

const blockedIds = myBlocks.map(b => b.blocked_id);

// Filter profiles
const profiles = allProfiles.filter(p =>
  !blockedIds.includes(p.user_id)
);
```

### 2. Check for Existing Swipe
Prevent duplicate swipes:

```typescript
const { data: existingSwipe } = await supabase
  .from('hugo_love.swipes')
  .select('direction')
  .eq('user_id', currentUserId)
  .eq('target_user_id', targetUserId)
  .single();

if (existingSwipe) {
  // Already swiped, maybe allow update?
} else {
  // Record new swipe
}
```

### 3. Real-time Match Notifications
Subscribe to new matches:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('matches')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'hugo_love',
      table: 'matches',
      filter: `user_id_1=eq.${currentUserId},user_id_2=eq.${currentUserId}`
    }, handleNewMatch)
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [currentUserId]);
```

### 4. Error Handling
Check constraints will prevent invalid data:

```typescript
try {
  await supabase.from('hugo_love.ratings').insert({
    rater_id: currentUserId,
    rated_user_id: targetUserId,
    looks: 6, // ❌ Invalid: must be 1-5
    // ...
  });
} catch (error) {
  if (error.code === '23514') { // Check constraint violation
    toast.error('Ratings must be between 1 and 5');
  }
}
```

---

## Migration

The database schema is managed via Supabase migrations:
- **File:** `supabase/migrations/20251110000000_create_hugo_love_dating_tables.sql`
- **Apply:** Run `supabase db push` to apply to production
- **Test locally:** Run `supabase start` to test with local Supabase

---

## No BFF API Needed! 🎉

Hugo Love does **NOT** need BFF API endpoints because:
1. ✅ Direct database access via Supabase client
2. ✅ RLS policies handle authorization
3. ✅ Database triggers handle business logic (auto-match)
4. ✅ Frontend validates input (with DB constraints as backup)
5. ✅ Zero impact on Vercel function limit

This is the recommended pattern for **all Oriva tenant apps** with app-specific features.
