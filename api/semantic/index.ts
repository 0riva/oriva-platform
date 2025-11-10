/**
 * Consolidated Semantic AI Analysis API (T192, T194, Topic Extraction)
 *
 * AI-powered content analysis and marketplace intelligence:
 * - Thread analysis for commerce opportunities
 * - Topic extraction with OpenAI
 * - Contextual marketplace suggestions
 * - Intent detection and keyword extraction
 *
 * Routes:
 * - POST /api/semantic/analyze-thread    - Analyze thread for commerce opportunities
 * - POST /api/semantic/topics            - Extract topics from content
 * - GET  /api/semantic/suggestions       - Get personalized marketplace suggestions
 *
 * Authorization: Required
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================================================
// Types
// ============================================================================

interface AnalyzeThreadRequest {
  thread_id: string;
  include_context?: boolean;
}

interface ExtractTopicsRequest {
  entry_id?: string;
  content?: string;
  max_topics?: number;
}

interface SuggestionsQuery {
  user_id?: string;
  thread_id?: string;
  limit?: number;
  page?: number;
}

interface ExtractedTopic {
  slug: string;
  label: string;
  confidence: number;
  keywords: string[];
}

interface FraudEvidence {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  count?: number;
  details?: string;
}

interface Suggestion {
  item_id: string;
  name: string;
  relevance_score: number;
  reasoning: string;
  category: string;
  price_cents: number;
  seller_id: string;
}

// ============================================================================
// Thread Analysis
// ============================================================================

/**
 * Extract keywords from content
 */
function extractKeywords(content: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
  ]);

  return content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .filter((word, index, arr) => arr.indexOf(word) === index)
    .slice(0, 20);
}

/**
 * Detect intent from content
 */
function detectIntent(content: string): { intent: string; confidence: number } {
  const lowerContent = content.toLowerCase();

  const buyingSignals = [
    'looking for', 'need a', 'want to buy', 'searching for',
    'recommendations for', 'where can i buy', 'purchase',
  ];

  const researchSignals = [
    'what are', 'how does', 'best way to', 'comparison', 'review',
    'difference between', 'pros and cons',
  ];

  const serviceSignals = [
    'need help with', 'looking for expert', 'hire someone',
    'consultant for', 'freelancer for', 'developer for',
  ];

  const buyingScore = buyingSignals.filter(s => lowerContent.includes(s)).length;
  const researchScore = researchSignals.filter(s => lowerContent.includes(s)).length;
  const serviceScore = serviceSignals.filter(s => lowerContent.includes(s)).length;

  if (buyingScore >= researchScore && buyingScore >= serviceScore && buyingScore > 0) {
    return { intent: 'purchase', confidence: Math.min(0.6 + (buyingScore * 0.1), 0.95) };
  }

  if (serviceScore > buyingScore && serviceScore > researchScore) {
    return { intent: 'service_request', confidence: Math.min(0.6 + (serviceScore * 0.1), 0.9) };
  }

  if (researchScore > 0) {
    return { intent: 'research', confidence: Math.min(0.5 + (researchScore * 0.1), 0.8) };
  }

  return { intent: 'general', confidence: 0.3 };
}

/**
 * Extract topics/categories from keywords
 */
function extractTopicsFromKeywords(keywords: string[]): string[] {
  const categoryMap: Record<string, string[]> = {
    'software': ['tool', 'app', 'software', 'platform', 'saas', 'system'],
    'development': ['developer', 'code', 'programming', 'api', 'framework'],
    'design': ['design', 'ui', 'ux', 'interface', 'visual'],
    'marketing': ['marketing', 'seo', 'analytics', 'campaign', 'advertising'],
    'productivity': ['project', 'management', 'collaboration', 'workflow', 'task'],
    'services': ['consultant', 'expert', 'freelancer', 'service', 'help'],
  };

  const topics: string[] = [];

  Object.entries(categoryMap).forEach(([topic, words]) => {
    if (keywords.some(keyword => words.includes(keyword))) {
      topics.push(topic);
    }
  });

  return topics;
}

/**
 * Calculate opportunity score
 */
function calculateOpportunityScore(
  intentConfidence: number,
  keywordCount: number,
  topicCount: number
): number {
  const intentWeight = 0.5;
  const keywordWeight = 0.3;
  const topicWeight = 0.2;

  const keywordScore = Math.min(keywordCount / 10, 1.0);
  const topicScore = Math.min(topicCount / 3, 1.0);

  return (
    intentConfidence * intentWeight +
    keywordScore * keywordWeight +
    topicScore * topicWeight
  );
}

/**
 * Generate marketplace suggestions
 */
async function generateMarketplaceSuggestions(
  supabase: any,
  keywords: string[],
  topics: string[]
): Promise<any[]> {
  if (keywords.length === 0) return [];

  const { data: items, error } = await supabase
    .from('entries')
    .select('id, content, marketplace_metadata')
    .not('marketplace_metadata', 'is', null)
    .limit(20);

  if (error || !items) return [];

  const scored = items
    .map((item: any) => {
      const itemText = `${item.content} ${JSON.stringify(item.marketplace_metadata)}`.toLowerCase();

      const matchedKeywords = keywords.filter(keyword =>
        itemText.includes(keyword)
      );

      const relevanceScore = matchedKeywords.length / keywords.length;

      return {
        item_id: item.id,
        name: item.marketplace_metadata?.name || item.content.substring(0, 50),
        relevance_score: relevanceScore,
        reasoning: `Matches keywords: ${matchedKeywords.join(', ')}`,
        matched_keywords: matchedKeywords,
      };
    })
    .filter(item => item.relevance_score >= 0.3)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5);

  return scored;
}

/**
 * Analyze thread for commerce opportunities
 * POST /api/semantic/analyze-thread
 */
async function analyzeThread(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { thread_id, include_context = true } = req.body as AnalyzeThreadRequest;

    if (!thread_id) {
      return res.status(400).json({ error: 'thread_id is required' });
    }

    // Get thread/entry
    const { data: thread, error: threadError } = await supabase
      .from('entries')
      .select('id, content, user_id')
      .eq('id', thread_id)
      .single();

    if (threadError || !thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Extract keywords
    const keywords = extractKeywords(thread.content);

    // Detect intent
    const { intent, confidence } = detectIntent(thread.content);

    // Extract topics
    const topics = extractTopicsFromKeywords(keywords);

    // Calculate opportunity score
    const opportunityScore = calculateOpportunityScore(
      confidence,
      keywords.length,
      topics.length
    );

    // Generate marketplace suggestions
    const suggestions = await generateMarketplaceSuggestions(supabase, keywords, topics);

    return res.status(200).json({
      success: true,
      thread_id,
      analysis: {
        intent,
        confidence,
        keywords,
        topics,
      },
      suggestions,
      opportunity_score: opportunityScore,
    });
  } catch (error) {
    console.error('Thread analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Topic Extraction
// ============================================================================

/**
 * Fallback keyword-based topic extraction
 */
function extractKeywordTopics(content: string, maxTopics: number = 5): ExtractedTopic[] {
  const keywords = extractKeywords(content);

  const topics: ExtractedTopic[] = keywords.slice(0, maxTopics).map((keyword, index) => ({
    slug: keyword.replace(/\s+/g, '-'),
    label: keyword.charAt(0).toUpperCase() + keyword.slice(1),
    confidence: Math.max(0.3, 0.7 - index * 0.1),
    keywords: [keyword],
  }));

  return topics;
}

/**
 * Extract topics using OpenAI
 */
async function extractTopicsWithAI(
  content: string,
  maxTopics: number = 5
): Promise<ExtractedTopic[]> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

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
      temperature: 0.3,
      max_tokens: 1000,
    });

    const responseText = response.choices[0]?.message?.content?.trim();
    if (!responseText) {
      throw new Error('Empty OpenAI response');
    }

    const topics: ExtractedTopic[] = JSON.parse(responseText);

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
    return extractKeywordTopics(content, maxTopics);
  }
}

/**
 * Check cache for existing topics
 */
async function checkTopicCache(supabase: any, entryId: string): Promise<ExtractedTopic[] | null> {
  const { data, error } = await supabase
    .from('content_topics')
    .select('slug, label, confidence, keywords')
    .eq('entry_id', entryId)
    .gte('confidence', 0.3)
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
  await supabase.from('content_topics').delete().eq('entry_id', entryId);

  const rows = topics.map((topic) => ({
    entry_id: entryId,
    slug: topic.slug,
    label: topic.label,
    confidence: topic.confidence,
    keywords: topic.keywords,
  }));

  const { error } = await supabase.from('content_topics').insert(rows);

  if (error) {
    console.error('Failed to cache topics:', error);
  }
}

/**
 * Extract topics from content
 * POST /api/semantic/topics
 */
async function extractTopics(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { entry_id, content, max_topics = 5 } = req.body as ExtractTopicsRequest;

    if (!entry_id && !content) {
      return res.status(400).json({ error: 'Either entry_id or content is required' });
    }

    let entryContent = content;
    let cachedTopics: ExtractedTopic[] | null = null;

    // If entry_id provided, fetch content and check cache
    if (entry_id) {
      cachedTopics = await checkTopicCache(supabase, entry_id);

      if (cachedTopics && cachedTopics.length > 0) {
        return res.status(200).json({
          success: true,
          topics: cachedTopics.slice(0, max_topics),
          cached: true,
          entry_id,
        });
      }

      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .select('id, title, sections')
        .eq('id', entry_id)
        .single();

      if (entryError || !entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const sections = entry.sections || [];
      const sectionContent = sections.map((s: any) => s.content || '').join('\n\n');

      entryContent = `${entry.title || ''}\n\n${sectionContent}`;
    }

    if (!entryContent || entryContent.trim().length === 0) {
      return res.status(400).json({ error: 'No content to analyze' });
    }

    // Extract topics using AI
    const topics = await extractTopicsWithAI(entryContent, max_topics);

    // Cache topics if entry_id provided
    if (entry_id && topics.length > 0) {
      await cacheTopics(supabase, entry_id, topics);
    }

    return res.status(200).json({
      success: true,
      topics,
      cached: false,
      entry_id,
    });
  } catch (error) {
    console.error('Topic extraction error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Marketplace Suggestions
// ============================================================================

/**
 * Analyze user interests from history
 */
async function analyzeUserInterests(
  supabase: any,
  userId: string
): Promise<Record<string, number>> {
  const { data: userEntries } = await supabase
    .from('entries')
    .select('content, marketplace_metadata')
    .eq('user_id', userId)
    .limit(50);

  if (!userEntries || userEntries.length === 0) return {};

  const categoryMap: Record<string, string[]> = {
    'software': ['tool', 'app', 'software', 'platform', 'saas'],
    'development': ['developer', 'code', 'programming', 'api'],
    'design': ['design', 'ui', 'ux', 'interface'],
    'productivity': ['project', 'management', 'workflow', 'task'],
  };

  const interests: Record<string, number> = {};

  userEntries.forEach((entry: any) => {
    const content = entry.content.toLowerCase();

    Object.entries(categoryMap).forEach(([category, keywords]) => {
      if (keywords.some(kw => content.includes(kw))) {
        interests[category] = (interests[category] || 0) + 1;
      }
    });
  });

  return interests;
}

/**
 * Get thread context if provided
 */
async function getThreadContext(
  supabase: any,
  threadId?: string
): Promise<{ keywords: string[]; intent: string } | null> {
  if (!threadId) return null;

  const { data: thread } = await supabase
    .from('entries')
    .select('content')
    .eq('id', threadId)
    .single();

  if (!thread) return null;

  const keywords = thread.content
    .toLowerCase()
    .split(/\s+/)
    .filter((w: string) => w.length > 3)
    .slice(0, 10);

  const intent = thread.content.toLowerCase().includes('looking for') ||
                 thread.content.toLowerCase().includes('need a')
    ? 'purchase'
    : 'general';

  return { keywords, intent };
}

/**
 * Calculate relevance score
 */
function calculateRelevanceScore(
  item: any,
  userInterests: Record<string, number>,
  threadContext: { keywords: string[]; intent: string } | null
): number {
  let score = 0.5;

  const itemCategory = item.marketplace_metadata?.category || '';
  if (userInterests[itemCategory]) {
    const interestStrength = userInterests[itemCategory] / 10;
    score += Math.min(interestStrength, 0.4);
  }

  if (threadContext) {
    const itemText = `${item.content} ${JSON.stringify(item.marketplace_metadata)}`.toLowerCase();
    const matchedKeywords = threadContext.keywords.filter(kw =>
      itemText.includes(kw)
    );

    const keywordScore = (matchedKeywords.length / threadContext.keywords.length) * 0.4;
    score += keywordScore;
  }

  const qualityScore = (item.marketplace_metadata?.rating || 0) / 5 * 0.2;
  score += qualityScore;

  return Math.min(score, 1.0);
}

/**
 * Apply freshness decay
 */
function applyFreshnessDecay(item: any): number {
  const createdAt = new Date(item.created_at).getTime();
  const now = Date.now();
  const daysOld = (now - createdAt) / (1000 * 60 * 60 * 24);

  return Math.max(0.7, 1 - (daysOld * 0.01));
}

/**
 * Ensure category diversity
 */
function ensureDiversity(suggestions: any[]): any[] {
  const diverse: any[] = [];
  const seenCategories = new Set<string>();

  suggestions.forEach(item => {
    const category = item.marketplace_metadata?.category || 'other';
    if (!seenCategories.has(category)) {
      diverse.push(item);
      seenCategories.add(category);
    }
  });

  suggestions.forEach(item => {
    if (diverse.length >= 10) return;
    if (!diverse.includes(item)) {
      diverse.push(item);
    }
  });

  return diverse.slice(0, 10);
}

/**
 * Get personalized marketplace suggestions
 * GET /api/semantic/suggestions
 */
async function getSuggestions(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const {
      user_id = user.id,
      thread_id,
      limit = 10,
      page = 0,
    } = req.query as Partial<SuggestionsQuery>;

    const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
    const pageNum = Math.max(0, Number(page) || 0);

    const userInterests = await analyzeUserInterests(supabase, user_id);
    const threadContext = await getThreadContext(supabase, thread_id as string | undefined);

    const { data: purchases } = await supabase
      .from('orivapay_transactions')
      .select('metadata')
      .eq('buyer_id', user_id)
      .eq('status', 'succeeded');

    const purchasedItems = new Set(
      (purchases || [])
        .map((p: any) => p.metadata?.item_id)
        .filter(Boolean)
    );

    const { data: items, error: itemsError } = await supabase
      .from('entries')
      .select('id, content, marketplace_metadata, created_at, user_id')
      .not('marketplace_metadata', 'is', null)
      .neq('user_id', user_id)
      .limit(100);

    if (itemsError) {
      console.error('Items query error:', itemsError);
      return res.status(500).json({ error: 'Failed to fetch suggestions' });
    }

    if (!items || items.length === 0) {
      return res.status(200).json({
        success: true,
        suggestions: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          has_more: false,
        },
      });
    }

    const scored = items
      .filter(item => !purchasedItems.has(item.id))
      .filter(item => item.marketplace_metadata?.status === 'active')
      .map(item => {
        const relevanceScore = calculateRelevanceScore(item, userInterests, threadContext);
        const freshnessDecay = applyFreshnessDecay(item);
        const finalScore = relevanceScore * freshnessDecay;

        const suggestion: Suggestion = {
          item_id: item.id,
          name: item.marketplace_metadata?.name || item.content.substring(0, 50),
          relevance_score: finalScore,
          reasoning: threadContext
            ? `Relevant to your discussion about ${threadContext.keywords.slice(0, 3).join(', ')}`
            : `Matches your interest in ${Object.keys(userInterests)[0] || 'marketplace items'}`,
          category: item.marketplace_metadata?.category || 'other',
          price_cents: item.marketplace_metadata?.price_cents || 0,
          seller_id: item.user_id,
        };

        return suggestion;
      })
      .filter(s => s.relevance_score >= 0.3)
      .sort((a, b) => b.relevance_score - a.relevance_score);

    const diverse = ensureDiversity(scored);
    const offset = pageNum * limitNum;
    const paginatedSuggestions = diverse.slice(offset, offset + limitNum);

    return res.status(200).json({
      success: true,
      suggestions: paginatedSuggestions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: diverse.length,
        has_more: offset + limitNum < diverse.length,
      },
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================================================
// Main Handler
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { pathname } = new URL(req.url || '', `http://${req.headers.host}`);

  // Route: /api/semantic/analyze-thread
  if (pathname.includes('/analyze-thread')) {
    if (req.method === 'POST') {
      return analyzeThread(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Route: /api/semantic/topics
  if (pathname.includes('/topics')) {
    if (req.method === 'POST') {
      return extractTopics(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Route: /api/semantic/suggestions
  if (pathname.includes('/suggestions')) {
    if (req.method === 'GET') {
      return getSuggestions(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(404).json({ error: 'Not found' });
}
