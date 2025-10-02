/**
 * Contextual Marketplace Suggestions Endpoint (T194)
 *
 * GET /api/semantic/suggestions
 *
 * Generates personalized marketplace suggestions based on:
 * - User context (interests, history, preferences)
 * - Thread context (if provided)
 * - Relevance scoring and ranking
 * - Quality filtering and diversity
 *
 * Query Parameters:
 * - user_id?: string (if not provided, uses authenticated user)
 * - thread_id?: string (optional thread context)
 * - limit?: number (default: 10, max: 50)
 * - page?: number (default: 0)
 *
 * Authorization: Required
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface SuggestionsQuery {
  user_id?: string;
  thread_id?: string;
  limit?: number;
  page?: number;
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

  // Extract keywords (simplified version)
  const keywords = thread.content
    .toLowerCase()
    .split(/\s+/)
    .filter((w: string) => w.length > 3)
    .slice(0, 10);

  // Detect intent (simplified)
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
  let score = 0.5; // Base score

  // User interest match (40% weight)
  const itemCategory = item.marketplace_metadata?.category || '';
  if (userInterests[itemCategory]) {
    const interestStrength = userInterests[itemCategory] / 10; // Normalize
    score += Math.min(interestStrength, 0.4);
  }

  // Thread context match (40% weight)
  if (threadContext) {
    const itemText = `${item.content} ${JSON.stringify(item.marketplace_metadata)}`.toLowerCase();
    const matchedKeywords = threadContext.keywords.filter(kw =>
      itemText.includes(kw)
    );

    const keywordScore = (matchedKeywords.length / threadContext.keywords.length) * 0.4;
    score += keywordScore;
  }

  // Quality boost (20% weight)
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

  // 1% decay per day, minimum 0.7
  return Math.max(0.7, 1 - (daysOld * 0.01));
}

/**
 * Ensure category diversity
 */
function ensureDiversity(suggestions: any[]): any[] {
  const diverse: any[] = [];
  const seenCategories = new Set<string>();

  // First pass: one from each category
  suggestions.forEach(item => {
    const category = item.marketplace_metadata?.category || 'other';
    if (!seenCategories.has(category)) {
      diverse.push(item);
      seenCategories.add(category);
    }
  });

  // Second pass: fill remaining slots
  suggestions.forEach(item => {
    if (diverse.length >= 10) return;
    if (!diverse.includes(item)) {
      diverse.push(item);
    }
  });

  return diverse.slice(0, 10);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client
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

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    // Parse query parameters
    const {
      user_id = user.id,
      thread_id,
      limit = 10,
      page = 0,
    } = req.query as Partial<SuggestionsQuery>;

    const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
    const pageNum = Math.max(0, Number(page) || 0);

    // Analyze user interests
    const userInterests = await analyzeUserInterests(supabase, user_id);

    // Get thread context if provided
    const threadContext = await getThreadContext(supabase, thread_id as string | undefined);

    // Get purchased items to exclude
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

    // Query marketplace items
    const { data: items, error: itemsError } = await supabase
      .from('entries')
      .select('id, content, marketplace_metadata, created_at, user_id')
      .not('marketplace_metadata', 'is', null)
      .neq('user_id', user_id) // Don't suggest own items
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

    // Filter and score items
    const scored = items
      .filter(item => !purchasedItems.has(item.id)) // Exclude purchased
      .filter(item => item.marketplace_metadata?.status === 'active') // Only active
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
      .filter(s => s.relevance_score >= 0.3) // Min threshold
      .sort((a, b) => b.relevance_score - a.relevance_score);

    // Apply diversity
    const diverse = ensureDiversity(scored);

    // Paginate
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
