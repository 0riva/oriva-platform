# Hugo Love BFF Quick Reference

**Purpose**: Quick lookup for Hugo Love endpoints without reading full documentation.

---

## Endpoint Quick Reference

### Swipes (T058 - FotoFlash)

**POST /api/v1/hugo-love/swipe**

```bash
curl -X POST http://localhost:3001/api/v1/hugo-love/swipe \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"targetUserId": "user-bob", "direction": "like"}'

# Response: { success, swipeId, match?: { matchId, conversationId } }
```

---

### Ratings (T059 - RateTheBait)

**POST /api/v1/hugo-love/ratings**

```bash
curl -X POST http://localhost:3001/api/v1/hugo-love/ratings \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "ratedUserId": "user-bob",
    "looks": 4,
    "personality": 5,
    "interests": 3,
    "lifestyle": 4,
    "comment": "Great match!"
  }'

# Response: { success, ratingId, averageScore, totalRatings }
```

---

### Matches (T060 - CatchTheMatch)

**GET /api/v1/hugo-love/matches?limit=50&offset=0**

```bash
curl http://localhost:3001/api/v1/hugo-love/matches?limit=10 \
  -H "Authorization: Bearer $JWT"

# Response: { success, matches: [], count, total }
```

**GET /api/v1/hugo-love/matches/:matchId**

```bash
curl http://localhost:3001/api/v1/hugo-love/matches/match-alice-bob-123 \
  -H "Authorization: Bearer $JWT"

# Response: Single match object with profile
```

**POST /api/v1/hugo-love/block**

```bash
curl -X POST http://localhost:3001/api/v1/hugo-love/block \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"blockedUserId": "user-spam"}'

# Response: { success, message }
```

**DELETE /api/v1/hugo-love/block/:blockedUserId**

```bash
curl -X DELETE http://localhost:3001/api/v1/hugo-love/block/user-spam \
  -H "Authorization: Bearer $JWT"

# Response: { success, message }
```

---

## Validation Rules Summary

| Endpoint    | Field         | Rules                                   |
| ----------- | ------------- | --------------------------------------- |
| **Swipe**   | targetUserId  | Required, UUID                          |
|             | direction     | Required, one of: like, dislike, review |
|             | timestamp     | Optional, ISO 8601                      |
| **Rating**  | ratedUserId   | Required, UUID                          |
|             | looks         | Required, 1-5 integer                   |
|             | personality   | Required, 1-5 integer                   |
|             | interests     | Required, 1-5 integer                   |
|             | lifestyle     | Required, 1-5 integer                   |
|             | comment       | Optional, max 500 chars                 |
| **Matches** | limit         | Optional, max 200 (default 50)          |
|             | offset        | Optional, default 0                     |
| **Block**   | blockedUserId | Required, UUID                          |

---

## Error Codes Quick Reference

| Code                | Status | When                   |
| ------------------- | ------ | ---------------------- |
| VALIDATION_ERROR    | 400    | Invalid input          |
| AUTH_ERROR          | 401    | Missing/invalid token  |
| FORBIDDEN           | 403    | Not authorized         |
| NOT_FOUND           | 404    | Resource doesn't exist |
| RATE_LIMIT_EXCEEDED | 429    | Too many requests      |
| INTERNAL_ERROR      | 500    | Server error           |

---

## Database Tables

All tables in OrivaLocalDB (Supabase):

- `hugo_love_swipes` - User swipe records
- `hugo_love_matches` - Canonical match records
- `hugo_love_ratings` - 4-factor rating records
- `hugo_love_blocks` - User blocking records

---

## Key Files

- Implementation: `/api/v1/hugo-love.ts`
- Tests: `/api/__tests__/v1/hugo-love.test.ts`
- Full Docs: `/docs/hugo-love-bff-integration.md`
- Summary: `/HUGO_LOVE_PHASE_2_6_BFF_SUMMARY.md`

---

## Common Tasks

**Testing locally**:

```bash
npm test -- hugo-love.test
```

**View API docs**:

```bash
cat docs/hugo-love-bff-integration.md
```

**Deploy to Vercel**:

```bash
git push origin main  # Auto-deploys on main
```

**Check Supabase schema**:

```bash
# Tables created via migrations in /Users/cosmic/o-core/supabase/migrations/
psql postgresql://localhost/postgres -c "\dt hugo_love*"
```

---

**Last Updated**: 2025-10-24
**Version**: 1.0
