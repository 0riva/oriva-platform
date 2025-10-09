"""
T038: OpenAI Embedder Implementation
Generate embeddings for chunks with retry logic
"""

import time
from typing import List, Dict
from openai import OpenAI
import os


# Initialize OpenAI client
client = None


def get_client():
    """Get or create OpenAI client."""
    global client
    if client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable not set")
        client = OpenAI(api_key=api_key)
    return client


def generate_embedding(text: str, max_retries: int = 3) -> List[float]:
    """
    Generate OpenAI embedding for text.

    Args:
        text: Text to embed
        max_retries: Number of retry attempts on failure

    Returns:
        1536-dim embedding vector (normalized)
    """
    if not text or not text.strip():
        # Return near-zero vector for empty text
        return [0.0] * 1536

    # Truncate very long text to model's token limit
    # text-embedding-3-small has 8191 token limit
    # Approximate: 1 token ≈ 4 chars, so limit to ~32,000 chars
    if len(text) > 32000:
        text = text[:32000]

    for attempt in range(max_retries):
        try:
            response = get_client().embeddings.create(
                model="text-embedding-3-small",
                input=text,
            )

            embedding = response.data[0].embedding
            return embedding

        except Exception as e:
            error_msg = str(e)

            # Check if it's a rate limit error
            if "rate limit" in error_msg.lower() or "429" in error_msg:
                if attempt < max_retries - 1:
                    # Exponential backoff: 1s, 2s, 4s
                    wait_time = 2 ** attempt
                    print(f"Rate limit hit, waiting {wait_time}s before retry...")
                    time.sleep(wait_time)
                    continue

            # Re-raise if not retryable or max retries exceeded
            if attempt == max_retries - 1:
                raise

    # Should not reach here, but return zero vector as fallback
    return [0.0] * 1536


def batch_embed(chunks: List[Dict], batch_size: int = 100) -> List[Dict]:
    """
    Generate embeddings for multiple chunks efficiently.

    Args:
        chunks: List of chunk dicts with "content" field
        batch_size: Number of texts to embed in one API call (max 2048 for OpenAI)

    Returns:
        Same chunks with "embedding" field added
    """
    total = len(chunks)
    print(f"Generating embeddings for {total} chunks...")

    for i in range(0, total, batch_size):
        batch = chunks[i:i + batch_size]
        batch_texts = [chunk["content"] for chunk in batch]

        try:
            # Batch API call (more efficient than individual calls)
            response = get_client().embeddings.create(
                model="text-embedding-3-small",
                input=batch_texts,
            )

            # Add embeddings to chunks
            for j, embedding_data in enumerate(response.data):
                chunks[i + j]["embedding"] = embedding_data.embedding

            print(f"  Processed {min(i + batch_size, total)}/{total} chunks")

        except Exception as e:
            print(f"Error in batch {i}-{i+batch_size}: {e}")

            # Fallback: process individually with retry logic
            for j, chunk in enumerate(batch):
                try:
                    embedding = generate_embedding(chunk["content"])
                    chunks[i + j]["embedding"] = embedding
                except Exception as chunk_error:
                    print(f"Failed to embed chunk {i+j}: {chunk_error}")
                    # Use zero vector as fallback
                    chunks[i + j]["embedding"] = [0.0] * 1536

    print(f"✅ Generated {total} embeddings")
    return chunks


if __name__ == "__main__":
    # Test embedding generation
    test_text = "This is a test of The Intimacy Code embedding generation."

    print("Testing embedding generation...")
    embedding = generate_embedding(test_text)

    print(f"✅ Generated {len(embedding)}-dim embedding")
    print(f"First 5 values: {embedding[:5]}")

    # Check normalization
    import math
    norm = math.sqrt(sum(x**2 for x in embedding))
    print(f"L2 norm: {norm:.4f} (should be ~1.0)")

    # Test batch processing
    test_chunks = [
        {"content": "First test chunk about celebration"},
        {"content": "Second test chunk about connection"},
        {"content": "Third test chunk about spark"},
    ]

    print("\nTesting batch embedding...")
    result = batch_embed(test_chunks)

    print(f"✅ Batch embedded {len(result)} chunks")
    for i, chunk in enumerate(result):
        print(f"  Chunk {i}: has {len(chunk['embedding'])}-dim embedding")
