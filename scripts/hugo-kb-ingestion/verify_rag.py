#!/usr/bin/env python3
"""
T050: Verify RAG Vector Search
Test that vector search returns relevant TIC content for each coaching stage
"""

import os
from openai import OpenAI
from supabase import create_client

# Test queries for each stage
TEST_QUERIES = {
    "celebration": "How do I enjoy being single and celebrate my independence?",
    "connection": "What should I look for in a potential partner?",
    "spark": "We just started dating, how do I keep the excitement alive?",
    "payOff": "How do we maintain a strong committed relationship?",
    "spiral": "We've been together for years, how do we keep growing together?"
}

def get_embedding(text: str, client: OpenAI) -> list[float]:
    """Generate embedding for query text."""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

def search_chunks(embedding: list[float], stage: str, supabase, limit: int = 5):
    """Search for top-k similar chunks."""
    # Convert embedding to pgvector format
    embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"
    
    # Execute RPC function (vector search with stage filter)
    result = supabase.rpc(
        'match_document_chunks',
        {
            'query_embedding': embedding_str,
            'match_stage': stage,
            'match_count': limit
        }
    ).execute()
    
    return result.data

def main():
    # Get credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    if not all([supabase_url, supabase_key, openai_key]):
        print("❌ Error: Missing environment variables")
        print("   SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY required")
        return 1
    
    # Initialize clients
    openai_client = OpenAI(api_key=openai_key)
    supabase = create_client(supabase_url, supabase_key)
    
    print("\n🔍 T050: RAG Vector Search Verification")
    print("=" * 60)
    
    # Test each stage
    for stage, query in TEST_QUERIES.items():
        print(f"\n📍 Stage: {stage.upper()}")
        print(f"🔎 Query: {query}")
        print("-" * 60)
        
        # Generate query embedding
        query_embedding = get_embedding(query, openai_client)
        
        # Search for similar chunks
        chunks = search_chunks(query_embedding, stage, supabase)
        
        if not chunks:
            print(f"⚠️  No chunks found for stage: {stage}")
            continue
        
        print(f"✅ Found {len(chunks)} relevant chunks:\n")
        
        # Display top 3 results
        for i, chunk in enumerate(chunks[:3], 1):
            similarity = chunk.get('similarity', 0)
            content = chunk.get('content', '')[:150]
            source = chunk.get('source_pdf', 'Unknown')
            page = chunk.get('metadata', {}).get('pageNumber', '?')
            
            print(f"  {i}. Similarity: {similarity:.3f} ({similarity*100:.1f}%)")
            print(f"     Source: {source} (page {page})")
            print(f"     Preview: {content}...")
            print()
    
    print("=" * 60)
    print("✅ RAG verification complete!\n")
    
    return 0

if __name__ == "__main__":
    exit(main())
