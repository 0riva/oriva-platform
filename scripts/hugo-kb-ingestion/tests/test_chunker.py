"""
T013: PDF Chunking Tests
These tests MUST FAIL before implementing chunker.py
"""

import pytest
from pathlib import Path


def test_chunker_module_exists():
    """Test: chunker module can be imported"""
    try:
        import chunker
        assert hasattr(chunker, 'chunk_pdf')
    except ImportError:
        pytest.fail("chunker module does not exist yet")


def test_chunk_pdf_returns_list():
    """Test: chunk_pdf() returns list of chunks"""
    from chunker import chunk_pdf

    # Mock PDF path and metadata
    pdf_path = "test.pdf"
    metadata = {"stage": "celebration"}

    result = chunk_pdf(pdf_path, metadata)

    assert isinstance(result, list)
    assert len(result) > 0


def test_chunk_has_required_fields():
    """Test: Each chunk has content, metadata, chunk_index, source_pdf"""
    from chunker import chunk_pdf

    pdf_path = "TIC Workbook 1 - Celebration.pdf"
    metadata = {"stage": "celebration"}

    chunks = chunk_pdf(pdf_path, metadata)

    # First chunk should have all required fields
    chunk = chunks[0]
    assert "content" in chunk
    assert "metadata" in chunk
    assert "chunk_index" in chunk
    assert "source_pdf" in chunk


def test_chunk_size_within_limits():
    """Test: Chunks are 500-1000 tokens each"""
    from chunker import chunk_pdf

    pdf_path = "TIC Workbook 1 - Celebration.pdf"
    metadata = {"stage": "celebration"}

    chunks = chunk_pdf(pdf_path, metadata)

    for chunk in chunks:
        content = chunk["content"]
        # Approximate token count (1 token ≈ 4 chars)
        token_count = len(content) / 4

        # Should be between 500-1000 tokens (2000-4000 chars)
        assert 500 <= token_count <= 1000, f"Chunk has {token_count} tokens"


def test_chunk_overlap():
    """Test: Chunks have 100 token overlap"""
    from chunker import chunk_pdf

    pdf_path = "TIC Workbook 1 - Celebration.pdf"
    metadata = {"stage": "celebration"}

    chunks = chunk_pdf(pdf_path, metadata)

    # If there are multiple chunks, check overlap
    if len(chunks) > 1:
        # Last ~100 tokens of chunk 0 should appear in start of chunk 1
        chunk0_end = chunks[0]["content"][-400:]  # ~100 tokens
        chunk1_start = chunks[1]["content"][:400]

        # Should have some overlap
        assert any(word in chunk1_start for word in chunk0_end.split()[:10])


def test_metadata_extraction_from_filename():
    """Test: Metadata extraction from filename (e.g., stage from 'Celebration.pdf')"""
    from chunker import chunk_pdf

    test_cases = [
        ("TIC Workbook 1 - Celebration.pdf", "celebration"),
        ("TIC Workbook 2 - Vital Connection.pdf", "connection"),
        ("TIC Workbook 3 - Love-Spark.pdf", "spark"),
        ("TIC Workbook 4 - Big Pay-Off.pdf", "payOff"),
        ("TIC Workbook 5 - Spiral Effect.pdf", "spiral"),
    ]

    for filename, expected_stage in test_cases:
        metadata = {}
        chunks = chunk_pdf(filename, metadata)

        # Check first chunk has correct stage
        assert chunks[0]["metadata"]["stage"] == expected_stage


def test_semantic_chunking_preserves_structure():
    """Test: Semantic chunking preserves section structure"""
    from chunker import chunk_pdf

    pdf_path = "TIC Workbook 1 - Celebration.pdf"
    metadata = {"stage": "celebration"}

    chunks = chunk_pdf(pdf_path, metadata)

    # Chunks should not break mid-sentence
    for chunk in chunks:
        content = chunk["content"]

        # Should start with capital letter (start of sentence)
        assert content[0].isupper() or content[0].isdigit()

        # Should end with punctuation
        assert content[-1] in ['.', '!', '?', '"', ')']


def test_page_number_in_metadata():
    """Test: Metadata includes page numbers"""
    from chunker import chunk_pdf

    pdf_path = "TIC Workbook 1 - Celebration.pdf"
    metadata = {"stage": "celebration"}

    chunks = chunk_pdf(pdf_path, metadata)

    # Each chunk should have page number
    for chunk in chunks:
        assert "pageNumber" in chunk["metadata"]
        assert isinstance(chunk["metadata"]["pageNumber"], int)
        assert chunk["metadata"]["pageNumber"] > 0


def test_workbook_title_in_metadata():
    """Test: Metadata includes workbook title"""
    from chunker import chunk_pdf

    pdf_path = "TIC Workbook 1 - Celebration.pdf"
    metadata = {"stage": "celebration"}

    chunks = chunk_pdf(pdf_path, metadata)

    # Should extract workbook title from filename
    assert chunks[0]["metadata"]["workbookTitle"] == "TIC Workbook 1 - Celebration"


def test_chunk_index_sequential():
    """Test: Chunk indices are sequential starting from 0"""
    from chunker import chunk_pdf

    pdf_path = "TIC Workbook 1 - Celebration.pdf"
    metadata = {"stage": "celebration"}

    chunks = chunk_pdf(pdf_path, metadata)

    for i, chunk in enumerate(chunks):
        assert chunk["chunk_index"] == i


def test_empty_pdf_returns_empty_list():
    """Test: Empty or invalid PDF returns empty list (not error)"""
    from chunker import chunk_pdf

    pdf_path = "empty.pdf"
    metadata = {}

    result = chunk_pdf(pdf_path, metadata)

    assert isinstance(result, list)
    assert len(result) == 0
