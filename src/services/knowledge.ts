// @ts-nocheck - TODO: Fix type errors
// Task: T041 - Knowledge retrieval service
// Description: Search knowledge base using PostgreSQL full-text search

import { getSupabaseClient, Database } from '../config/supabase';

type KnowledgeEntry = Database['public']['Tables']['knowledge_entries']['Row'];

export interface SearchKnowledgeParams {
  query: string;
  appId: string;
  maxResults?: number;
  category?: string;
  minRelevance?: number;
}

export interface SearchKnowledgeResult {
  id: string;
  knowledge_base_id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[];
  relevance_score: number;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

export interface SearchKnowledgeResponse {
  results: SearchKnowledgeResult[];
  total_count: number;
  query_time_ms: number;
  suggestions?: string[];
}

/**
 * Search knowledge base using PostgreSQL full-text search
 * Performance requirement: <1s (FR-028)
 */
export async function searchKnowledge(
  params: SearchKnowledgeParams,
): Promise<SearchKnowledgeResponse> {
  const startTime = Date.now();
  const { query, appId, maxResults = 5, category, minRelevance = 0.3 } = params;

  const supabase = getSupabaseClient();

  // Get app's knowledge base IDs
  const { data: appData, error: appError } = await supabase
    .from('hugo_apps')
    .select('knowledge_base_ids')
    .eq('app_id', appId)
    .eq('is_active', true)
    .single();

  if (appError || !appData) {
    throw new Error(`App not found: ${appId}`);
  }

  const kbIds = appData.knowledge_base_ids;
  if (!kbIds || kbIds.length === 0) {
    return {
      results: [],
      total_count: 0,
      query_time_ms: Date.now() - startTime,
    };
  }

  // Execute full-text search using prepared statement approach
  // Note: Supabase JS doesn't support prepared statements directly,
  // so we use RPC with optimized query
  const { data: searchResults, error: searchError } = await supabase.rpc('search_knowledge_base', {
    search_query: query,
    kb_ids: kbIds,
    max_results: maxResults,
    category_filter: category || null,
    min_relevance_score: minRelevance,
  });

  if (searchError) {
    // Fallback to direct query if RPC not available
    return await searchKnowledgeDirect(supabase, {
      query,
      kbIds,
      maxResults,
      category,
      minRelevance,
      startTime,
    });
  }

  const queryTimeMs = Date.now() - startTime;

  // Increment access count for returned entries (fire and forget)
  if (searchResults && searchResults.length > 0) {
    const entryIds = searchResults.map((r: SearchKnowledgeResult) => r.id);
    supabase
      .rpc('increment_knowledge_access', { entry_ids: entryIds })
      .then(() => {})
      .catch((err) => console.warn('Failed to increment access count:', err));
  }

  return {
    results: searchResults || [],
    total_count: searchResults?.length || 0,
    query_time_ms: queryTimeMs,
  };
}

/**
 * Direct fallback search without RPC
 */
async function searchKnowledgeDirect(
  supabase: ReturnType<typeof getSupabaseClient>,
  params: {
    query: string;
    kbIds: string[];
    maxResults: number;
    category?: string;
    minRelevance: number;
    startTime: number;
  },
): Promise<SearchKnowledgeResponse> {
  const { query, kbIds, maxResults, category, minRelevance, startTime } = params;

  // Get knowledge base records
  const { data: kbData } = await supabase
    .from('hugo_knowledge_bases')
    .select('id')
    .in('kb_id', kbIds)
    .eq('is_active', true);

  if (!kbData || kbData.length === 0) {
    return {
      results: [],
      total_count: 0,
      query_time_ms: Date.now() - startTime,
    };
  }

  const kbUuids = kbData.map((kb) => kb.id);

  // Build text search query
  let searchQuery = supabase
    .from('hugo_knowledge_entries')
    .select('*')
    .in('knowledge_base_id', kbUuids)
    .textSearch('search_vector', query, {
      type: 'websearch',
      config: 'english',
    });

  if (category) {
    searchQuery = searchQuery.eq('category', category);
  }

  const { data: entries, error } = await searchQuery
    .limit(maxResults * 2) // Get more to filter by relevance
    .order('access_count', { ascending: false });

  if (error) {
    throw new Error(`Knowledge search failed: ${error.message}`);
  }

  // Calculate relevance scores and filter
  const results: SearchKnowledgeResult[] = (entries || [])
    .map((entry: KnowledgeEntry) => {
      // Simple relevance scoring based on text match
      const titleMatch = entry.title.toLowerCase().includes(query.toLowerCase());
      const contentMatch = entry.content.toLowerCase().includes(query.toLowerCase());
      const tagsMatch = entry.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()));

      let relevance = 0;
      if (titleMatch) relevance += 0.5;
      if (contentMatch) relevance += 0.3;
      if (tagsMatch) relevance += 0.2;

      return {
        id: entry.id,
        knowledge_base_id: entry.knowledge_base_id,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        tags: entry.tags,
        relevance_score: relevance,
        access_count: entry.access_count,
        last_accessed_at: entry.last_accessed_at,
        created_at: entry.created_at,
      };
    })
    .filter((r) => r.relevance_score >= minRelevance)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, maxResults);

  const queryTimeMs = Date.now() - startTime;

  return {
    results,
    total_count: results.length,
    query_time_ms: queryTimeMs,
  };
}

/**
 * Get single knowledge entry by ID
 */
export async function getKnowledgeEntry(entryId: string): Promise<KnowledgeEntry | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('hugo_knowledge_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (error || !data) {
    return null;
  }

  // Increment access count
  await supabase.rpc('increment_ke_access', { entry_id: entryId });

  return data;
}