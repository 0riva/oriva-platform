-- T042: Add match_document_chunks RPC function for RAG vector search
-- Returns top-k most similar document chunks for a given query embedding and optional stage filter

CREATE OR REPLACE FUNCTION public.match_document_chunks(
    query_embedding VECTOR(1536),
    match_stage TEXT DEFAULT NULL,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    source_pdf TEXT,
    chunk_index INT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE SQL
STABLE
AS $$
    SELECT
        document_chunks.id,
        document_chunks.source_pdf,
        document_chunks.chunk_index,
        document_chunks.content,
        document_chunks.metadata,
        1 - (document_chunks.embedding <=> query_embedding) AS similarity
    FROM public.document_chunks
    WHERE
        -- Optional stage filter
        (match_stage IS NULL OR document_chunks.metadata->>'stage' = match_stage)
    ORDER BY document_chunks.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.match_document_chunks(VECTOR(1536), TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(VECTOR(1536), TEXT, INT) TO anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(VECTOR(1536), TEXT, INT) TO service_role;

-- Add function comment
COMMENT ON FUNCTION public.match_document_chunks IS 'RAG vector similarity search for Hugo Love coaching knowledge base. Returns top-k similar chunks with cosine similarity scores.';
