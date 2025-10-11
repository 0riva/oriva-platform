"""
T039: Supabase Uploader Implementation
Upload chunks with embeddings to Supabase document_chunks table
"""

from typing import List, Dict
from supabase import create_client, Client
import os


def upload_chunks(chunks: List[Dict], supabase_url: str = None, supabase_key: str = None) -> None:
    """
    Upload chunks with embeddings to Supabase document_chunks table.

    Args:
        chunks: List of chunk dicts with content, metadata, embedding
        supabase_url: Supabase project URL (defaults to env var)
        supabase_key: Supabase service key (defaults to env var)
    """
    # Get credentials from environment if not provided
    if not supabase_url:
        supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_key:
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not supabase_key:
        raise ValueError("Supabase URL and service key required")

    # Create Supabase client
    supabase: Client = create_client(supabase_url, supabase_key)

    total = len(chunks)
    batch_size = 100  # Upload in batches of 100
    success_count = 0
    error_count = 0

    print(f"Uploading {total} chunks to Supabase...")

    for i in range(0, total, batch_size):
        batch = chunks[i:i + batch_size]

        # Prepare batch for insertion
        records = []
        for chunk in batch:
            record = {
                "source_pdf": chunk["source_pdf"],
                "chunk_index": chunk["chunk_index"],
                "content": chunk["content"],
                "embedding": format_embedding_for_pgvector(chunk["embedding"]),
                "metadata": chunk["metadata"],
            }
            records.append(record)

        try:
            # Batch insert (defaults to public schema)
            response = supabase.table("document_chunks").insert(records).execute()

            success_count += len(records)
            print(f"  Uploaded {min(i + batch_size, total)}/{total} chunks")

        except Exception as e:
            error_count += len(records)
            print(f"Error uploading batch {i}-{i+batch_size}: {e}")

            # Retry individual inserts
            for record in records:
                try:
                    supabase.table("document_chunks").insert(record).execute()
                    success_count += 1
                    error_count -= 1
                except Exception as chunk_error:
                    print(f"  Failed to upload chunk: {chunk_error}")

    print(f"✅ Upload complete: {success_count} succeeded, {error_count} failed")

    if error_count > 0:
        raise Exception(f"{error_count} chunks failed to upload")


def format_embedding_for_pgvector(embedding: List[float]) -> str:
    """
    Convert embedding list to pgvector format.

    Args:
        embedding: List of floats (1536-dim)

    Returns:
        pgvector string format: "[0.1, 0.2, ...]"
    """
    # pgvector expects string representation of array
    return str(embedding)


if __name__ == "__main__":
    # Test upload with sample data
    import sys

    test_chunks = [
        {
            "source_pdf": "test.pdf",
            "chunk_index": 0,
            "content": "Test chunk content about celebrating being single.",
            "embedding": [0.1] * 1536,  # Mock embedding
            "metadata": {
                "stage": "celebration",
                "pageNumber": 1,
                "workbookTitle": "TIC Workbook 1 - Celebration"
            }
        }
    ]

    print("Testing Supabase upload...")
    print("Note: Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars")

    if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_KEY"):
        try:
            upload_chunks(test_chunks)
            print("✅ Test upload successful")
        except Exception as e:
            print(f"❌ Test upload failed: {e}")
    else:
        print("⚠️  Skipping upload test (no credentials)")
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY to test")
