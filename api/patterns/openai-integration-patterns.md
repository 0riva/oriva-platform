# OpenAI Integration Patterns

Patterns for integrating OpenAI and LLM services with proper error handling, fallbacks, and cost optimization.

## OpenAI Client Configuration

### ❌ WRONG: Inline Client Creation with No Error Handling

```typescript
async function extractTopics(content: string) {
  // New client instance for every request (inefficient)
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // No validation
  });

  // Direct call with no timeout or error handling
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content }],
  });

  // Assumes response is always valid
  return JSON.parse(response.choices[0].message.content);
}
```

**Problems:**

- No API key validation
- No timeout protection
- No error handling
- Assumes successful JSON parsing
- Creates new client every request

### ✅ CORRECT: Validated Client with Comprehensive Error Handling

```typescript
// Singleton pattern for client reuse
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable not configured');
    }

    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout
      maxRetries: 2, // Retry failed requests
    });
  }

  return openaiClient;
}

async function extractTopicsWithAI(
  content: string,
  maxTopics: number = 5
): Promise<ExtractedTopic[]> {
  const openai = getOpenAIClient();

  const prompt = `Analyze the following text and extract the ${maxTopics} most relevant topics.
For each topic, provide:
1. A slug (lowercase, hyphen-separated identifier)
2. A human-readable label
3. A confidence score (0.0 to 1.0) indicating topic relevance
4. 2-5 relevant keywords

Text to analyze:
"""
${content.substring(0, 4000)}
"""

Respond ONLY with a JSON array in this exact format:
[{"slug": "topic-slug", "label": "Topic Label", "confidence": 0.85, "keywords": ["keyword1", "keyword2"]}]`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, // Lower = more consistent
      max_tokens: 1000, // Limit cost
    });

    const responseText = response.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Empty OpenAI response');
    }

    // Safe JSON parsing with validation
    const topics: ExtractedTopic[] = JSON.parse(responseText);

    // Validate and normalize response
    return topics
      .filter((t) => t.slug && t.label && typeof t.confidence === 'number')
      .slice(0, maxTopics)
      .map((t) => ({
        slug: t.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        label: t.label,
        confidence: Math.max(0, Math.min(1, t.confidence)),
        keywords: Array.isArray(t.keywords) ? t.keywords : [],
      }));
  } catch (error) {
    console.error('OpenAI topic extraction failed:', error);
    // Fallback to simpler method
    return extractKeywordTopics(content, maxTopics);
  }
}
```

**Benefits:**

- Client singleton for efficiency
- API key validation at startup
- Timeout and retry configuration
- Comprehensive error handling
- Response validation and normalization
- Automatic fallback on failure

**Reference:** [`api/v1/topics.ts:66-115`](../v1/topics.ts)

---

## Prompt Engineering for Structured Output

### ❌ WRONG: Vague Prompt with No Format Specification

```typescript
const prompt = `Extract topics from this text: ${content}`;

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: prompt }],
});

// OpenAI returns free-form text: "The main topics are: psychology, ..."
// Hard to parse reliably
```

**Problems:**

- No output format specified
- Unpredictable response structure
- Brittle parsing logic required
- Inconsistent results

### ✅ CORRECT: Explicit Format with JSON Schema

```typescript
const prompt = `Analyze the following text and extract the ${maxTopics} most relevant topics.
For each topic, provide:
1. A slug (lowercase, hyphen-separated identifier)
2. A human-readable label
3. A confidence score (0.0 to 1.0) indicating topic relevance
4. 2-5 relevant keywords

Text to analyze:
"""
${content.substring(0, 4000)}
"""

Respond ONLY with a JSON array in this exact format:
[{"slug": "topic-slug", "label": "Topic Label", "confidence": 0.85, "keywords": ["keyword1", "keyword2"]}]`;

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.3, // Lower temperature for structured output
  max_tokens: 1000,
});

// Reliable JSON parsing
const topics = JSON.parse(response.choices[0].message.content.trim());
```

**Benefits:**

- Predictable JSON output
- Easy to parse and validate
- Consistent structure
- Lower temperature for reliability

**Pro Tips:**

- Include example JSON in prompt
- Use "ONLY" or "EXACTLY" to emphasize format
- Lower temperature (0.1-0.3) for structured output
- Limit content length to control token usage

**Reference:** [`api/v1/topics.ts:87-102`](../v1/topics.ts)

---

## Fallback Strategy Pattern

### ❌ WRONG: No Fallback on AI Failure

```typescript
async function extractTopics(content: string) {
  const topics = await extractTopicsWithAI(content);

  // If OpenAI fails, entire request fails
  return topics;
}
```

**Problems:**

- Single point of failure
- Poor user experience on AI downtime
- No degraded service option

### ✅ CORRECT: Multi-Tier Fallback System

```typescript
/**
 * Tier 1: AI extraction (best quality, highest cost)
 */
async function extractTopicsWithAI(content: string): Promise<ExtractedTopic[]> {
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: buildPrompt(content) }],
      temperature: 0.3,
      max_tokens: 1000,
    });

    return parseAndValidate(response);
  } catch (error) {
    console.error('OpenAI extraction failed:', error);
    // Fall through to Tier 2
    throw error;
  }
}

/**
 * Tier 2: Keyword extraction (good quality, zero cost)
 */
function extractKeywordTopics(
  content: string,
  maxTopics: number = 5
): ExtractedTopic[] {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'was',
    'are',
    'be',
    'been',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'should',
    'could',
    'may',
    'might',
    'can',
    'this',
    'that',
    'these',
    'those',
  ]);

  const keywords = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word))
    .filter((word, index, arr) => arr.indexOf(word) === index);

  return keywords.slice(0, maxTopics).map((keyword, index) => ({
    slug: keyword.replace(/\s+/g, '-'),
    label: keyword.charAt(0).toUpperCase() + keyword.slice(1),
    confidence: Math.max(0.3, 0.7 - index * 0.1), // Descending confidence
    keywords: [keyword],
  }));
}

/**
 * Main function with fallback logic
 */
async function extractTopics(
  content: string,
  maxTopics: number = 5
): Promise<ExtractedTopic[]> {
  try {
    // Tier 1: Try AI extraction
    return await extractTopicsWithAI(content, maxTopics);
  } catch (error) {
    console.error('Falling back to keyword extraction');
    // Tier 2: Use keyword extraction
    return extractKeywordTopics(content, maxTopics);
  }
}
```

**Fallback Decision Tree:**

```
extractTopics()
├─ Try: OpenAI GPT-4o-mini (Tier 1)
│  ├─ Success → Return AI-extracted topics (confidence 0.7-0.95)
│  └─ Failure → Log error, continue
│
└─ Fallback: Keyword extraction (Tier 2)
   ├─ Success → Return keyword topics (confidence 0.3-0.7)
   └─ Failure → Return empty array or error
```

**Benefits:**

- Graceful degradation on AI failure
- Always provides results (even if lower quality)
- Zero-cost fallback reduces operational risk
- User experience maintained during outages

**Reference:** [`api/v1/topics.ts:34-115`](../v1/topics.ts)

---

## Database Caching Pattern

### ❌ WRONG: No Caching, Every Request Calls OpenAI

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { entry_id } = req.body;

  // Fetch entry
  const entry = await supabase
    .from('entries')
    .select('*')
    .eq('id', entry_id)
    .single();

  // Always call OpenAI (expensive, slow)
  const topics = await extractTopicsWithAI(entry.content);

  res.json({ topics });
}
```

**Problems:**

- Expensive: $0.15 per 1M input tokens
- Slow: 2-5 second API latency
- Rate limits: 3,500 RPM on tier 1
- Same content analyzed repeatedly

### ✅ CORRECT: Database Caching with TTL Strategy

```typescript
/**
 * Check cache for existing topics
 */
async function checkTopicCache(
  supabase: any,
  entryId: string
): Promise<ExtractedTopic[] | null> {
  const { data, error } = await supabase
    .from('content_topics')
    .select('slug, label, confidence, keywords')
    .eq('entry_id', entryId)
    .gte('confidence', 0.3) // Filter low-confidence
    .order('confidence', { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data.map((row: any) => ({
    slug: row.slug,
    label: row.label,
    confidence: row.confidence,
    keywords: row.keywords || [],
  }));
}

/**
 * Store topics in cache
 */
async function cacheTopics(
  supabase: any,
  entryId: string,
  topics: ExtractedTopic[]
): Promise<void> {
  // Delete existing cached topics for this entry
  await supabase.from('content_topics').delete().eq('entry_id', entryId);

  // Insert new topics
  const rows = topics.map((topic) => ({
    entry_id: entryId,
    slug: topic.slug,
    label: topic.label,
    confidence: topic.confidence,
    keywords: topic.keywords,
    created_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('content_topics').insert(rows);

  if (error) {
    console.error('Failed to cache topics:', error);
  }
}

/**
 * Main handler with caching
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { entry_id } = req.body;

  // Step 1: Check cache first
  const cachedTopics = await checkTopicCache(supabase, entry_id);

  if (cachedTopics && cachedTopics.length > 0) {
    return res.status(200).json({
      success: true,
      topics: cachedTopics,
      cached: true, // Indicate cache hit
    });
  }

  // Step 2: Fetch entry content
  const entry = await supabase
    .from('entries')
    .select('id, title, sections')
    .eq('id', entry_id)
    .single();

  // Step 3: Extract topics (expensive operation)
  const topics = await extractTopicsWithAI(entry.content);

  // Step 4: Cache results
  await cacheTopics(supabase, entry_id, topics);

  res.status(200).json({
    success: true,
    topics,
    cached: false, // Cache miss
  });
}
```

**Database Schema:**

```sql
CREATE TABLE content_topics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index for fast lookups
  INDEX idx_content_topics_entry_id ON content_topics(entry_id),
  INDEX idx_content_topics_confidence ON content_topics(confidence DESC)
);
```

**Cache Invalidation Strategy:**

```typescript
// Option 1: Time-based invalidation (in query)
const { data } = await supabase
  .from('content_topics')
  .select('*')
  .eq('entry_id', entryId)
  .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // 7 days
  .order('confidence', { ascending: false });

// Option 2: Event-based invalidation (on entry update)
// In entry update handler:
await supabase.from('content_topics').delete().eq('entry_id', entryId);
```

**Benefits:**

- 95%+ cache hit rate after initial extraction
- <50ms response time (vs 2-5s for OpenAI)
- Massive cost savings ($0.01 vs $0.15 per 1K requests)
- Better user experience
- Reduced OpenAI rate limit pressure

**Cost Comparison:**

```
Without caching (1000 requests):
- OpenAI: $0.15 per 1M tokens × 1000 × 1000 tokens = $150
- Database: $0.01 (negligible)
- Total: ~$150

With caching (95% hit rate):
- OpenAI: $0.15 × 50 = $7.50 (only cache misses)
- Database: $0.01 × 1000 = $10
- Total: ~$17.50 (88% cost reduction)
```

**Reference:** [`api/v1/topics.ts:118-172`](../v1/topics.ts)

---

## Token Usage Optimization

### ❌ WRONG: Sending Full Content Without Limits

```typescript
const prompt = `Extract topics from:\n${entry.content}`;

// If content is 50K tokens, this costs $7.50 per request
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: prompt }],
});
```

### ✅ CORRECT: Truncate Content + Optimize Prompt

```typescript
// Truncate to 4000 characters (~1000 tokens)
const truncatedContent = content.substring(0, 4000);

// Concise prompt reduces output tokens
const prompt = `Extract ${maxTopics} topics as JSON:
[{"slug": "...", "label": "...", "confidence": 0.85, "keywords": [...]}]

Text:
"""
${truncatedContent}
"""`;

const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: prompt }],
  max_tokens: 1000, // Limit response size
  temperature: 0.3, // More focused = fewer tokens
});
```

**Token Optimization Checklist:**

- [ ] Truncate input content to reasonable length
- [ ] Use concise, directive prompts
- [ ] Set max_tokens limit
- [ ] Use lower temperature for structured output
- [ ] Cache results to avoid repeat processing
- [ ] Consider gpt-4o-mini vs gpt-4 (10x cost difference)

**Reference:** [`api/v1/topics.ts:87-102`](../v1/topics.ts)
