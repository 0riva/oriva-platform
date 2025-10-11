-- T037: Create document_chunks table for RAG-based Hugo Love coaching knowledge base
-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document_chunks table
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_pdf TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL, -- OpenAI text-embedding-3-small dimension
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique chunks per document
    UNIQUE(source_pdf, chunk_index)
);

-- Create HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
ON public.document_chunks
USING hnsw (embedding vector_cosine_ops);

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS document_chunks_source_pdf_idx ON public.document_chunks(source_pdf);
CREATE INDEX IF NOT EXISTS document_chunks_metadata_stage_idx ON public.document_chunks USING gin ((metadata -> 'stage'));

-- Enable Row Level Security
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Allow service_role to manage all chunks (for ingestion)
CREATE POLICY "service_role_all_document_chunks"
ON public.document_chunks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow authenticated users to read all chunks (for RAG queries)
CREATE POLICY "authenticated_read_document_chunks"
ON public.document_chunks
FOR SELECT
TO authenticated
USING (true);

-- Allow anon users to read all chunks (for public coaching content)
CREATE POLICY "anon_read_document_chunks"
ON public.document_chunks
FOR SELECT
TO anon
USING (true);

-- Add comment explaining table purpose
COMMENT ON TABLE public.document_chunks IS 'Hugo Love coaching knowledge base chunks with OpenAI embeddings for RAG-based semantic search';
COMMENT ON COLUMN public.document_chunks.embedding IS 'OpenAI text-embedding-3-small (1536 dimensions) for cosine similarity search';
COMMENT ON COLUMN public.document_chunks.metadata IS 'JSONB metadata: stage, pageNumber, workbookTitle, etc.';
