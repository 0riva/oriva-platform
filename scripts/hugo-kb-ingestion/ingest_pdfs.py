#!/usr/bin/env python3
"""
T040: Main Ingestion Script
CLI to orchestrate full PDF → chunks → embeddings → Supabase pipeline
"""

import argparse
import os
from pathlib import Path
from typing import List
from tqdm import tqdm
from dotenv import load_dotenv

from chunker import chunk_pdf
from embedder import batch_embed
from uploader import upload_chunks


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Ingest TIC PDFs into Supabase for RAG-based coaching"
    )

    parser.add_argument(
        "--input-dir",
        required=True,
        help="Directory containing TIC PDF files"
    )

    parser.add_argument(
        "--supabase-url",
        help="Supabase project URL (or use SUPABASE_URL env var)"
    )

    parser.add_argument(
        "--supabase-key",
        help="Supabase service key (or use SUPABASE_SERVICE_KEY env var)"
    )

    parser.add_argument(
        "--openai-key",
        help="OpenAI API key (or use OPENAI_API_KEY env var)"
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Batch size for embedding generation (default: 100)"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Process PDFs but don't upload to Supabase"
    )

    args = parser.parse_args()

    # Load environment variables from .env file
    load_dotenv()

    # Set environment variables from CLI args (if provided)
    if args.openai_key:
        os.environ["OPENAI_API_KEY"] = args.openai_key
    if args.supabase_url:
        os.environ["SUPABASE_URL"] = args.supabase_url
    if args.supabase_key:
        os.environ["SUPABASE_SERVICE_KEY"] = args.supabase_key

    # Validate required environment variables
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY not set")
        print("   Set via --openai-key or OPENAI_API_KEY environment variable")
        return 1

    if not args.dry_run:
        if not os.getenv("SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_KEY"):
            print("❌ Error: Supabase credentials not set")
            print("   Set via --supabase-url/--supabase-key or environment variables")
            return 1

    # Find all PDF files
    input_dir = Path(args.input_dir)
    if not input_dir.exists():
        print(f"❌ Error: Input directory not found: {input_dir}")
        return 1

    pdf_files = list(input_dir.glob("**/*.pdf"))

    if not pdf_files:
        print(f"❌ Error: No PDF files found in {input_dir}")
        return 1

    print(f"\n🚀 Hugo Love Knowledge Base Ingestion Pipeline")
    print(f"=" * 60)
    print(f"📂 Input directory: {input_dir}")
    print(f"📄 Found {len(pdf_files)} PDF files")
    print(f"🤖 OpenAI model: text-embedding-3-small")
    print(f"🗄️  Supabase: {os.getenv('SUPABASE_URL', 'Not set')}")

    if args.dry_run:
        print(f"⚠️  DRY RUN MODE - No uploads will be performed")

    print(f"=" * 60)
    print()

    # Process each PDF
    all_chunks = []
    total_chunks_generated = 0

    for pdf_path in tqdm(pdf_files, desc="Processing PDFs"):
        try:
            # Step 1: Chunk PDF
            chunks = chunk_pdf(str(pdf_path))

            if not chunks:
                print(f"⚠️  No chunks extracted from {pdf_path.name}")
                continue

            total_chunks_generated += len(chunks)
            all_chunks.extend(chunks)

            print(f"  ✅ {pdf_path.name}: {len(chunks)} chunks")

        except Exception as e:
            print(f"  ❌ {pdf_path.name}: Error - {e}")
            continue

    print(f"\n📊 Chunking Summary")
    print(f"  Total PDFs processed: {len(pdf_files)}")
    print(f"  Total chunks generated: {total_chunks_generated}")
    print()

    if not all_chunks:
        print("❌ No chunks to process. Exiting.")
        return 1

    # Step 2: Generate embeddings
    print("🧠 Generating embeddings...")
    try:
        all_chunks = batch_embed(all_chunks, batch_size=args.batch_size)
    except Exception as e:
        print(f"❌ Embedding generation failed: {e}")
        return 1

    # Step 3: Upload to Supabase
    if not args.dry_run:
        print("\n📤 Uploading to Supabase...")
        try:
            upload_chunks(all_chunks)
        except Exception as e:
            print(f"❌ Upload failed: {e}")
            return 1
    else:
        print("\n⚠️  Skipping upload (dry run mode)")

    # Final summary
    print(f"\n" + "=" * 60)
    print(f"✅ Pipeline Complete!")
    print(f"=" * 60)
    print(f"📄 PDFs processed: {len(pdf_files)}")
    print(f"🧩 Chunks generated: {total_chunks_generated}")
    print(f"🧠 Embeddings created: {len(all_chunks)}")

    if not args.dry_run:
        print(f"📤 Uploaded to Supabase: {len(all_chunks)} chunks")
        print()
        print("🔍 Verify in Supabase:")
        print(f"   SELECT COUNT(*) FROM hugo_love.document_chunks;")
        print(f"   -- Expected: ~{len(all_chunks)}")

    print()
    print("🎉 Knowledge base ingestion successful!")

    return 0


if __name__ == "__main__":
    exit(main())
