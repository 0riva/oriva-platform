// Topic Extraction API Handler
// Handles: POST /api/v1/topics/extract
// Pattern: Vercel serverless function with authentication

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../src/middleware/auth';
import { asyncHandler, validationError } from '../../src/middleware/error-handler';
import { rateLimit } from '../../src/middleware/rate-limit';
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
 * Handle topic extraction request
 */
async function handleTopicExtraction(
  req: AuthenticatedRequest,
  res: VercelResponse
): Promise<void> {
  const { entry_id, content, max_topics = 5 } = req.body as ExtractTopicsRequest;

  if (!entry_id && !content) {
    throw validationError('Either entry_id or content is required');
  }

  const { userId } = req.authContext;

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  let entryContent = content;
  let cachedTopics: ExtractedTopic[] | null = null;

  if (entry_id) {
    cachedTopics = await checkTopicCache(supabase, entry_id);

    if (cachedTopics && cachedTopics.length > 0) {
      res.status(200).json({
        success: true,
        topics: cachedTopics.slice(0, max_topics),
        cached: true,
        entry_id,
      });
      return;
    }

    const { data: entry, error: entryError } = await supabase
      .from('entries')
      .select('id, title, sections, user_id')
      .eq('id', entry_id)
      .single();

    if (entryError || !entry) {
      throw validationError('Entry not found');
    }

    if (entry.user_id !== userId) {
      res.status(403).json({ error: 'Access denied', code: 'FORBIDDEN' });
      return;
    }

    const sections = entry.sections || [];
    const sectionContent = sections.map((s: any) => s.content || '').join('\n\n');

    entryContent = `${entry.title || ''}\n\n${sectionContent}`;
  }

  if (!entryContent || entryContent.trim().length === 0) {
    throw validationError('No content to analyze');
  }

  const topics = await extractTopicsWithAI(entryContent, max_topics);

  if (entry_id && topics.length > 0) {
    await cacheTopics(supabase, entry_id, topics);
  }

  res.status(200).json({
    success: true,
    topics,
    cached: false,
    entry_id,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await asyncHandler(async () => {
    await authenticate(req, res, async () => {
      await rateLimit(req, res, async () => {
        const authReq = req as AuthenticatedRequest;
        const { url, method } = req;

        if (method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
          return;
        }

        if (url?.match(/\/extract$/)) {
          return handleTopicExtraction(authReq, res);
        }

        res.status(404).json({ error: 'Endpoint not found', code: 'NOT_FOUND' });
      });
    });
  })(req, res);
}
