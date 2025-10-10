-- Migration: Vector Search Function for RAG
-- Date: 2025-10-08
-- Feature: T041-T045 Chat Stream Edge Functions
-- Description: Creates search_tic_chunks RPC function for pgvector similarity search

-- ===========================================================================
-- PART 1: Vector Similarity Search Function
-- ===========================================================================

-- Function: search_tic_chunks
-- Purpose: Perform pgvector cosine similarity search with stage filtering
-- Called by: supabase/functions/chat-stream/rag.ts
CREATE OR REPLACE FUNCTION hugo_love.search_tic_chunks(
  query_embedding vector(1536),
  match_stage text,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  distance float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.content,
    document_chunks.metadata,
    (document_chunks.embedding <=> query_embedding) AS distance
  FROM hugo_love.document_chunks
  WHERE
    -- Filter by stage in metadata JSONB
    document_chunks.metadata->>'stage' = match_stage
  ORDER BY
    document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION hugo_love.search_tic_chunks IS 'Vector similarity search for TIC chunks filtered by coaching stage. Returns top N chunks ordered by cosine similarity.';

-- ===========================================================================
-- PART 2: Permissions
-- ===========================================================================

-- Grant execution to authenticated users (for client-side calls)
GRANT EXECUTE ON FUNCTION hugo_love.search_tic_chunks TO authenticated;

-- Grant execution to service role (for Edge Functions)
GRANT EXECUTE ON FUNCTION hugo_love.search_tic_chunks TO service_role;

-- ===========================================================================
-- PART 3: Performance Verification Query (for testing)
-- ===========================================================================

-- Sample query to verify function works (requires actual embeddings in table)
-- SELECT * FROM hugo_love.search_tic_chunks(
--   '[0.1, 0.2, ...]'::vector(1536),  -- Replace with real embedding
--   'celebration',
--   5
-- );
