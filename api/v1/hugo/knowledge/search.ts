// Task: T042 - Knowledge search endpoint
// Description: HTTP handler for knowledge base search

import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../../middleware/auth';
import { asyncHandler, validationError } from '../../../middleware/error-handler';
import { rateLimit } from '../../../middleware/rate-limit';
import { searchKnowledge } from '../../../services/knowledge';

interface SearchRequest {
  query: string;
  max_results?: number;
  category?: string;
  min_relevance?: number;
}

async function searchHandler(req: AuthenticatedRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
    return;
  }

  // Get app ID from header
  const appId = req.headers['x-app-id'] as string;
  if (!appId) {
    throw validationError('X-App-ID header is required');
  }

  const { query, max_results, category, min_relevance }: SearchRequest = req.body;

  // Validation
  if (!query) {
    throw validationError('Query is required');
  }

  if (query.length === 0) {
    throw validationError('Query cannot be empty');
  }

  if (query.length > 500) {
    throw validationError('Query exceeds maximum length of 500 characters');
  }

  if (max_results !== undefined) {
    if (max_results < 1) {
      throw validationError('max_results must be at least 1');
    }
    if (max_results > 20) {
      throw validationError('max_results cannot exceed 20');
    }
  }

  if (min_relevance !== undefined) {
    if (min_relevance < 0 || min_relevance > 1) {
      throw validationError('min_relevance must be between 0 and 1');
    }
  }

  // Execute search
  const searchResults = await searchKnowledge({
    query,
    appId,
    maxResults: max_results,
    category,
    minRelevance: min_relevance,
  });

  // Add suggestions if no results
  if (searchResults.results.length === 0 && searchResults.total_count === 0) {
    searchResults.suggestions = generateSearchSuggestions(query);
  }

  res.status(200).json(searchResults);
}

/**
 * Generate alternative search suggestions
 */
function generateSearchSuggestions(query: string): string[] {
  const suggestions: string[] = [];

  // Remove special characters
  const cleaned = query.replace(/[^\w\s]/g, ' ').trim();
  if (cleaned !== query) {
    suggestions.push(cleaned);
  }

  // Try simpler version
  const words = cleaned.split(/\s+/);
  if (words.length > 3) {
    suggestions.push(words.slice(0, 3).join(' '));
  }

  return suggestions.slice(0, 3);
}

// Export with middleware chain
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await rateLimit(req, res, async () => {
    await authenticate(req, res, async () => {
      await asyncHandler(searchHandler)(req, res);
    });
  });
}