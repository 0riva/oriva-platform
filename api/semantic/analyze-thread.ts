/**
 * Semantic Thread Analysis Endpoint (T192)
 *
 * POST /api/semantic/analyze-thread
 *
 * Analyzes thread content for commerce opportunities using Hugo AI:
 * - Intent detection (purchase, research, service request)
 * - Keyword extraction and topic identification
 * - Marketplace suggestion generation
 * - Commerce opportunity scoring
 *
 * Request Body:
 * - thread_id: UUID of thread/entry to analyze
 * - include_context?: boolean (default: true) - include participant context
 *
 * Authorization: Required
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

interface AnalyzeThreadRequest {
  thread_id: string;
  include_context?: boolean;
}

interface ThreadAnalysis {
  thread_id: string;
  analysis: {
    intent: 'purchase' | 'research' | 'service_request' | 'general';
    confidence: number;
    keywords: string[];
    topics: string[];
  };
  suggestions: Array<{
    item_id: string;
    name: string;
    relevance_score: number;
    reasoning: string;
    matched_keywords: string[];
  }>;
  opportunity_score: number;
}

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
    .filter((word, index, arr) => arr.indexOf(word) === index) // Unique
    .slice(0, 20); // Top 20 keywords
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
function extractTopics(keywords: string[]): string[] {
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
async function generateSuggestions(
  supabase: any,
  keywords: string[],
  topics: string[]
): Promise<any[]> {
  if (keywords.length === 0) return [];

  // Query marketplace items matching keywords
  const { data: items, error } = await supabase
    .from('entries')
    .select('id, content, marketplace_metadata')
    .not('marketplace_metadata', 'is', null)
    .limit(20);

  if (error || !items) return [];

  // Score items by keyword relevance
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
    .filter(item => item.relevance_score >= 0.3) // Min 30% keyword match
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5); // Top 5 suggestions

  return scored;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
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

    // Validate request
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
    const topics = extractTopics(keywords);

    // Calculate opportunity score
    const opportunityScore = calculateOpportunityScore(
      confidence,
      keywords.length,
      topics.length
    );

    // Generate marketplace suggestions
    const suggestions = await generateSuggestions(supabase, keywords, topics);

    const result: ThreadAnalysis = {
      thread_id,
      analysis: {
        intent: intent as any,
        confidence,
        keywords,
        topics,
      },
      suggestions,
      opportunity_score: opportunityScore,
    };

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Thread analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
