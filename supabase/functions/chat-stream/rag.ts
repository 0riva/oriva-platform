/**
 * T042: RAG Vector Search Module
 * pgvector similarity search for TIC chunks
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export interface TICChunk {
  id: string;
  content: string;
  metadata: {
    stage: string;
    pageNumber: number;
    workbookTitle: string;
  };
  similarity: number;
}

export async function searchTICChunks(
  query: string,
  stage: string,
  supabaseUrl: string,
  supabaseKey: string,
  limit: number = 5
): Promise<TICChunk[]> {
  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate embedding for query using OpenAI
    const queryEmbedding = await generateQueryEmbedding(query);

    // Vector similarity search with pgvector
    // Using cosine distance operator <=>
    const { data, error } = await supabase.rpc('search_tic_chunks', {
      query_embedding: queryEmbedding,
      match_stage: stage,
      match_count: limit,
    });

    if (error) {
      console.error('Vector search error:', error);
      return []; // Return empty array on error (graceful fallback)
    }

    // Transform results to TICChunk format
    const chunks: TICChunk[] = (data || []).map((row: any) => ({
      id: row.id,
      content: row.content,
      metadata: row.metadata,
      similarity: 1 - row.distance, // Convert distance to similarity
    }));

    return chunks;
  } catch (error) {
    console.error('RAG search failed:', error);
    return []; // Graceful fallback - chat can continue without RAG
  }
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  /**
   * Generate embedding for search query using OpenAI
   */
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not set');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data[0].embedding;
}
