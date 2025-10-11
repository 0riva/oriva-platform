/**
 * Topic Extraction Endpoint
 *
 * POST /api/v1/topics/extract
 *
 * Extracts semantic topics from entry content using OpenAI:
 * - Primary topic identification
 * - Sub-topic categorization
 * - Confidence scoring
 * - Keyword extraction
 *
 * Request Body:
 * - entry_id: UUID of entry to analyze
 * - content?: string - optional direct content (if no entry_id)
 * - max_topics?: number - maximum topics to return (default: 5)
 *
 * Response:
 * - topics: Array of {slug, label, confidence, keywords}
 * - cached: boolean - whether result was from cache
 *
 * Authorization: Required
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

interface ExtractTopicsRequest {
  entry_id?: string;
  content?: string;
  max_topics?: number;
}

interface ExtractedTopic {
  slug: string;
  label: string;
  confidence: number;
  keywords: string[];
}

interface TopicExtractionResponse {
  success: boolean;
  topics: ExtractedTopic[];
  cached: boolean;
  entry_id?: string;
}

/**
 * Fallback keyword-based topic extraction
 */
function extractKeywordTopics(content: string, maxTopics: number = 5): ExtractedTopic[] {
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

  // Group keywords into simple topics
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

    // Parse JSON response
    const topics: ExtractedTopic[] = JSON.parse(responseText);

    // Validate and normalize
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
    // Fallback to keyword-based extraction
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
  // Delete existing cached topics for this entry
  await supabase.from('content_topics').delete().eq('entry_id', entryId);

  // Insert new topics
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TopicExtractionResponse | { error: string }>
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

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Validate request
    const { entry_id, content, max_topics = 5 } = req.body as ExtractTopicsRequest;

    if (!entry_id && !content) {
      return res.status(400).json({ error: 'Either entry_id or content is required' });
    }

    let entryContent = content;
    let cachedTopics: ExtractedTopic[] | null = null;

    // If entry_id provided, fetch content and check cache
    if (entry_id) {
      // Check cache first
      cachedTopics = await checkTopicCache(supabase, entry_id);

      if (cachedTopics && cachedTopics.length > 0) {
        return res.status(200).json({
          success: true,
          topics: cachedTopics.slice(0, max_topics),
          cached: true,
          entry_id,
        });
      }

      // Fetch entry content
      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .select('id, title, sections')
        .eq('id', entry_id)
        .single();

      if (entryError || !entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      // Combine title and section content
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
