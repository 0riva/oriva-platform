# Hugo Love Knowledge Base Ingestion Pipeline

Python pipeline for ingesting The Intimacy Code (TIC) PDFs into Supabase for RAG-based coaching.

## Overview

This pipeline processes TIC curriculum PDFs through three stages:

1. **Chunking**: Extract text and split into semantic chunks (500-1000 tokens)
2. **Embedding**: Generate OpenAI embeddings (1536-dim vectors)
3. **Upload**: Store chunks with embeddings in Supabase `hugo_love.document_chunks` table

## Prerequisites

- Python 3.11+
- Supabase project with `hugo_love.document_chunks` table (see migration: `../../supabase/migrations/20250108_hugo_love_schema_v1.sql`)
- OpenAI API key
- TIC PDF files

## Installation

```bash
cd scripts/hugo-kb-ingestion
pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Service role key (NOT anon key)
- `OPENAI_API_KEY`: OpenAI API key for embeddings

## Usage

### Basic Usage

```bash
python ingest_pdfs.py \
  --input-dir /path/to/TIC/PDFs \
  --supabase-url https://your-project.supabase.co \
  --supabase-key your-service-key \
  --openai-key sk-your-key
```

### Using Environment Variables

```bash
# Set in .env, then run:
python ingest_pdfs.py --input-dir /path/to/TIC/PDFs
```

### Recommended: Hugo Love Production Ingestion

```bash
python ingest_pdfs.py \
  --input-dir /Users/cosmic/Documents/MySecondBrain/Hugo/HugoLoveKB/PDFs
```

## Expected Input Structure

Place TIC PDFs in the input directory with this naming convention:

- `TIC Workbook 1 - Celebration.pdf`
- `TIC Workbook 2 - Vital Connection.pdf`
- `TIC Workbook 3 - Love-Spark.pdf`
- `TIC Workbook 4 - Big Pay-Off.pdf`
- `TIC Workbook 5 - Spiral Effect.pdf`
- `TIC - 7 Conversations To Love.pdf`
- `TIC - 15 Things Report.pdf`
- ... (other TIC materials)

The pipeline extracts stage metadata from filenames:

- "Celebration" → stage: `celebration`
- "Connection" → stage: `connection`
- "Spark" → stage: `spark`
- "Pay-Off" → stage: `payOff`
- "Spiral" → stage: `spiral`

## Output

Each PDF produces ~50-100 chunks in Supabase:

```sql
SELECT COUNT(*) FROM hugo_love.document_chunks;
-- Expected: ~750 chunks (15 PDFs × ~50 pages)

SELECT stage, COUNT(*)
FROM hugo_love.document_chunks
GROUP BY (metadata->>'stage');
-- Shows chunk distribution across 5 stages
```

## Pipeline Architecture

```
PDF Files → Chunker → Embedder → Uploader → Supabase
              ↓          ↓           ↓
          LangChain   OpenAI     pgvector
          splitter   text-emb   HNSW index
```

### Chunker (`chunker.py`)

- Extracts text with pdfplumber
- Splits with RecursiveCharacterTextSplitter (1000 tokens, 100 overlap)
- Extracts metadata from filename (stage, workbook title, page numbers)

### Embedder (`embedder.py`)

- Generates embeddings with `text-embedding-3-small` (1536-dim)
- Batch processing for efficiency
- Retry logic with exponential backoff

### Uploader (`uploader.py`)

- Batch inserts (100 chunks at a time)
- pgvector format conversion
- Error handling and retry

## Testing

Run tests with pytest:

```bash
pytest tests/
```

Run specific test:

```bash
pytest tests/test_chunker.py -v
```

## Performance

- Processing speed: ~2-5 PDFs/minute
- Cost: ~$0.002 per PDF (OpenAI embeddings)
- Expected total: 15 PDFs = ~5 minutes, ~$0.03

## Troubleshooting

### "No chunks generated"

- Check PDF is text-based (not scanned images)
- Verify filename matches expected pattern
- Check PDF has readable content with `pdfplumber`

### "OpenAI rate limit"

- Embedder includes retry logic with exponential backoff
- Default batch size: 100 chunks (adjustable in .env)

### "Supabase upload failed"

- Verify service key (not anon key) has insert permissions
- Check `document_chunks` table exists with pgvector extension
- Verify HNSW index created on `embedding` column

## Development

Add new features:

1. Write failing tests in `tests/`
2. Implement in module files
3. Run `pytest` to verify
4. Update this README

## License

Internal Oriva Originals tool - not for public distribution.
