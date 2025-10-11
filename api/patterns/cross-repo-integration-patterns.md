# Cross-Repository Integration Patterns

Patterns for coordinating features between oriva-core (frontend) and oriva-platform (backend API).

## Progressive Enhancement Architecture

### ❌ WRONG: Tight Coupling with Hard Failures

```typescript
// Frontend (oriva-core): ThemecrumbsBar.tsx
async function extractThemes(entry: Entry) {
  // Hardcoded dependency on backend
  const response = await fetch('https://api.oriva.io/api/v1/topics/extract', {
    method: 'POST',
    body: JSON.stringify({ entry_id: entry.id }),
  });

  if (!response.ok) {
    // Hard failure - component breaks
    throw new Error('Topic extraction failed');
  }

  return response.json();
}
```

**Problems:**

- Frontend breaks if backend not deployed
- No graceful degradation
- Tight coupling between repos
- Poor user experience during outages

### ✅ CORRECT: Progressive Enhancement with Fallbacks

```typescript
// Frontend (oriva-core): ThemecrumbsBar.tsx
const extractThemesFromEntry = useCallback(async (entryData: Entry) => {
  try {
    // TIER 1: Try semantic topic extraction (best quality)
    const semanticTopics = await topicExtractionService.getTopicsForEntry(
      entryData.id
    );

    if (semanticTopics && semanticTopics.length > 0) {
      const themes = semanticTopics
        .filter((topic) => topic.confidence >= 0.3)
        .slice(0, 4)
        .map((topic, index) => ({
          slug: topic.slug,
          label: topic.label,
          level: index,
        }));

      logger.info('Using semantic topics for threadcrumbs', {
        entryId: entryData.id,
        topics: themes.map((t) => t.label),
      });

      return themes;
    }
  } catch (error) {
    logger.warn(
      'Semantic topic extraction unavailable, using fallback:',
      error
    );
  }

  try {
    // TIER 2: Try taxonomy-based keyword matching (good quality)
    const topicFacets = await taxonomyService.getTopicFacets();
    const matchedThemes = matchContentToTaxonomy(
      entryData.content,
      topicFacets
    );

    if (matchedThemes.length > 0) {
      return matchedThemes.sort((a, b) => a.level - b.level).slice(0, 4);
    }
  } catch (taxonomyError) {
    logger.warn(
      'Taxonomy service failed, using keyphrase fallback:',
      taxonomyError
    );
  }

  // TIER 3: Extract keyphrase from title (basic quality, always works)
  const keyphrase = extractKeyphraseFromTitle(entryData.title || '');
  return [
    {
      slug: 'content',
      label: keyphrase || 'Content',
      level: 0,
    },
  ];
}, []);
```

**Backend (oriva-platform): api/v1/topics.ts**

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Backend ready to serve when deployed
  // Returns 404 until deployment - frontend handles gracefully
  const topics = await extractTopicsWithAI(content);
  res.json({ success: true, topics, cached: false });
}
```

**Progressive Enhancement Decision Tree:**

```
User views entry with threadcrumbs component
│
├─ Frontend: Try Tier 1 (semantic topics via API)
│  ├─ API available? → Use AI topics (best quality)
│  └─ API 404/timeout? → Log, continue to Tier 2
│
├─ Frontend: Try Tier 2 (taxonomy matching)
│  ├─ Taxonomy match found? → Use matched topics (good quality)
│  └─ No match? → Continue to Tier 3
│
└─ Frontend: Tier 3 (keyphrase extraction)
   └─ Always succeeds → Use keyphrase (basic quality)
```

**Benefits:**

- Frontend works immediately, upgrades when backend ready
- No deployment coordination required
- Graceful degradation during outages
- User experience never breaks
- Each tier provides value

**Reference:**

- Frontend: `oriva-core/src/components/molecules/ThemecrumbsBar.tsx:293-402`
- Backend: `oriva-platform/api/v1/topics.ts`

---

## API Contract Versioning

### ❌ WRONG: Breaking Changes Without Versioning

```typescript
// Backend V1 (initial):
interface TopicResponse {
  topics: { name: string; score: number }[];
}

// Backend V2 (breaking change):
interface TopicResponse {
  topics: { slug: string; label: string; confidence: number }[]; // Different fields!
  cached: boolean;
}
```

**Problems:**

- Frontend breaks on backend update
- No backward compatibility
- Forces coordinated deployment

### ✅ CORRECT: Versioned API with Backward Compatibility

```typescript
// api/v1/topics.ts
interface TopicResponseV1 {
  success: boolean;
  topics: Array<{
    slug: string;
    label: string;
    confidence: number;
    keywords: string[];
  }>;
  cached: boolean;
  entry_id?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiVersion = req.headers['x-api-version'] || 'v1';

  const topics = await extractTopics(content);

  if (apiVersion === 'v1') {
    return res.json({
      success: true,
      topics,
      cached: false,
      entry_id,
    } as TopicResponseV1);
  }

  // Future: v2 with additional fields
  res.status(400).json({ error: 'Unsupported API version' });
}
```

**Versioning Strategies:**

1. **URL-based**: `/api/v1/topics` vs `/api/v2/topics`
2. **Header-based**: `X-API-Version: v1` (preferred for same endpoint)
3. **Accept header**: `Accept: application/vnd.oriva.v1+json`

**Reference:** `oriva-platform/api/v1/topics.ts`

---

## Cache Synchronization Pattern

### ❌ WRONG: Independent Caches with Stale Data

```typescript
// Backend: Caches in database
await supabase.from('content_topics').insert({ entry_id, topics });

// Frontend: Caches in localStorage
localStorage.setItem(`topics:${entryId}`, JSON.stringify(topics));

// Problem: Caches get out of sync, stale data persists
```

**Problems:**

- Double caching complexity
- Cache invalidation nightmare
- Stale data on frontend
- Wasted API calls

### ✅ CORRECT: Single Source of Truth with Cache Headers

```typescript
// Backend: Single cache in database
await supabase.from('content_topics').insert({ entry_id, topics, created_at });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cachedTopics = await checkTopicCache(supabase, entry_id);

  if (cachedTopics) {
    // Tell frontend it's cached and for how long
    res.setHeader('X-Cached', 'true');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    return res.json({ topics: cachedTopics, cached: true });
  }

  const topics = await extractTopics(content);
  await cacheTopics(supabase, entry_id, topics);

  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json({ topics, cached: false });
}

// Frontend: Trust backend cache, use HTTP caching only
const response = await fetch(`/api/v1/topics/extract`, {
  method: 'POST',
  body: JSON.stringify({ entry_id }),
  // Browser automatically handles Cache-Control
});
```

**Benefits:**

- Single source of truth (database)
- Standard HTTP caching
- No frontend cache invalidation logic
- Browser handles caching automatically

**Reference:** `oriva-platform/api/v1/topics.ts:191-206`

---

## Feature Flag Pattern for Gradual Rollout

### ❌ WRONG: Hard Switch to New Feature

```typescript
// Frontend suddenly switches all users to new API
const topics = await topicExtractionService.getTopicsForEntry(entryId);
```

**Problems:**

- No gradual rollout
- Hard to rollback
- All users hit new code simultaneously

### ✅ CORRECT: Feature Flag with Gradual Rollout

```typescript
// Backend: Feature flag in environment or database
const ENABLE_AI_TOPICS = process.env.ENABLE_AI_TOPICS === 'true';
const AI_TOPICS_ROLLOUT_PERCENTAGE = parseInt(
  process.env.AI_TOPICS_ROLLOUT_PERCENTAGE || '0'
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId } = req.authContext;

  // Feature flag check
  if (!ENABLE_AI_TOPICS) {
    return res.status(503).json({ error: 'Feature not available' });
  }

  // Gradual rollout based on user ID
  const userHash = hashUserId(userId);
  const isInRollout = userHash % 100 < AI_TOPICS_ROLLOUT_PERCENTAGE;

  if (!isInRollout) {
    return res.status(503).json({ error: 'Not in rollout group' });
  }

  // Serve AI topics
  const topics = await extractTopicsWithAI(content);
  res.json({ topics });
}

// Frontend: Handle 503 gracefully
try {
  const topics = await topicExtractionService.getTopicsForEntry(entryId);
  // Use AI topics
} catch (error) {
  if (error.status === 503) {
    // Feature not available yet - use fallback
    logger.info('AI topics not available, using fallback');
  }
  // Use Tier 2/3 fallback
}
```

**Rollout Strategy:**

```
Day 1: ENABLE_AI_TOPICS=true, ROLLOUT_PERCENTAGE=1   (1% of users)
Day 3: ROLLOUT_PERCENTAGE=10                           (10% of users)
Day 5: ROLLOUT_PERCENTAGE=50                           (50% of users)
Day 7: ROLLOUT_PERCENTAGE=100                          (100% of users)
```

**Benefits:**

- Gradual rollout reduces risk
- Easy to rollback (set percentage to 0)
- Monitor errors at small scale
- A/B testing capability

---

## Deployment Coordination Strategy

### ❌ WRONG: Coordinated Deployment Required

```
1. Deploy backend with new feature
2. Wait for deployment to complete
3. Update frontend to use new feature
4. Deploy frontend
5. Hope nothing breaks in between
```

**Problems:**

- Tight coordination window
- Deployment failures cascade
- Downtime if timing is off

### ✅ CORRECT: Backward-Compatible Deployments

**Phase 1: Backend First (backward compatible)**

```typescript
// Backend: Add new endpoint, existing APIs unchanged
// POST /api/v1/topics/extract (NEW)
// Returns 404 until deployed - frontend handles gracefully
```

**Phase 2: Frontend with Fallback (works with or without backend)**

```typescript
// Frontend: Uses progressive enhancement
// Try new API → fallback to old behavior
// Works whether backend is deployed or not
```

**Phase 3: Monitor & Stabilize**

```
- Monitor error rates
- Check cache hit rates
- Validate response times
- Fix issues before Phase 4
```

**Phase 4: Remove Old Code (optional)**

```typescript
// After 30 days of stability, optionally remove fallback tiers
// Keep Tier 3 (keyphrase) as permanent fallback
```

**Deployment Decision Tree:**

```
Backend deployment:
├─ Can existing clients still work? → YES
│  ├─ New endpoint returns 404 until ready
│  └─ Frontend handles 404 gracefully
│
Frontend deployment:
├─ Can work without new backend? → YES
│  ├─ Progressive enhancement with fallbacks
│  └─ Degrades gracefully if API unavailable
│
Result: Zero-downtime deployment ✅
```

**Benefits:**

- Independent deployment schedules
- No coordination required
- Zero downtime
- Easy rollback (just redeploy previous version)

**Example Timeline:**

```
Week 1:
- Deploy backend (Tue)
- Monitor for issues (Tue-Thu)
- Deploy frontend (Fri)
- No coordination needed

Week 2:
- Monitor adoption (Mon-Fri)
- Optimize based on metrics

Week 4:
- Feature fully stable
- Consider removing fallback code (optional)
```

**Reference:**

- Backend: `oriva-platform` commit 6803258
- Frontend: `oriva-core` commit 70dc298b
- Deployed independently, no issues
