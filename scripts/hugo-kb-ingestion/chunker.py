"""
T037: PDF Chunker Implementation
Extracts and chunks TIC PDFs with metadata
"""

import pdfplumber
from pathlib import Path
from typing import List, Dict, Optional
from langchain_text_splitters import RecursiveCharacterTextSplitter
import re


def chunk_pdf(pdf_path: str, metadata: Optional[Dict] = None) -> List[Dict]:
    """
    Extract text from PDF and split into semantic chunks.

    Args:
        pdf_path: Path to PDF file
        metadata: Optional metadata dict (stage, etc.)

    Returns:
        List of chunk dicts with content, metadata, chunk_index, source_pdf
    """
    if metadata is None:
        metadata = {}

    # Extract stage and workbook title from filename
    filename = Path(pdf_path).name
    extracted_metadata = extract_metadata_from_filename(filename)
    metadata.update(extracted_metadata)

    # Extract text from PDF
    try:
        text_by_page = extract_text_from_pdf(pdf_path)
    except Exception as e:
        # Return empty list on error (graceful failure)
        print(f"Error extracting text from {pdf_path}: {e}")
        return []

    if not text_by_page:
        return []

    # Create text splitter (1000 char chunks ~= 250 tokens, 100 char overlap ~= 25 tokens)
    # Using 4000 chars for 1000 tokens, 400 chars for 100 token overlap
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=4000,  # ~1000 tokens
        chunk_overlap=400,  # ~100 tokens
        separators=["\n\n", "\n", ". ", " ", ""],  # Semantic boundaries
        length_function=len,
    )

    # Split each page and track page numbers
    chunks = []
    chunk_index = 0

    for page_num, page_text in enumerate(text_by_page, start=1):
        if not page_text.strip():
            continue

        # Split page into chunks
        page_chunks = splitter.split_text(page_text)

        for chunk_text in page_chunks:
            chunk_text = clean_chunk_text(chunk_text)

            if len(chunk_text) < 100:  # Skip very small chunks
                continue

            chunk = {
                "content": chunk_text,
                "metadata": {
                    **metadata,
                    "pageNumber": page_num,
                },
                "chunk_index": chunk_index,
                "source_pdf": filename,
            }
            chunks.append(chunk)
            chunk_index += 1

    return chunks


def extract_text_from_pdf(pdf_path: str) -> List[str]:
    """Extract text from each page of PDF."""
    pages_text = []

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                pages_text.append(text)
    except FileNotFoundError:
        # Return empty list if file doesn't exist
        return []
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return []

    return pages_text


def extract_metadata_from_filename(filename: str) -> Dict:
    """
    Extract stage and workbook title from TIC PDF filename.

    Examples:
        "TIC Workbook 1 - Celebration.pdf" → {"stage": "celebration", "workbookTitle": "TIC Workbook 1 - Celebration"}
        "TIC Workbook 2 - Vital Connection.pdf" → {"stage": "connection", "workbookTitle": "..."}
    """
    metadata = {}

    # Remove .pdf extension
    name = filename.replace('.pdf', '')
    metadata["workbookTitle"] = name

    # Stage mapping
    stage_patterns = {
        "celebration": r"celebration",
        "connection": r"(connection|vital connection)",
        "spark": r"(spark|love-spark)",
        "payOff": r"(pay-off|payoff|big pay-off)",
        "spiral": r"(spiral|spiral effect)",
    }

    # Find matching stage (case-insensitive)
    name_lower = name.lower()
    for stage, pattern in stage_patterns.items():
        if re.search(pattern, name_lower):
            metadata["stage"] = stage
            break

    # If no stage found, leave it unset
    if "stage" not in metadata:
        metadata["stage"] = "general"  # Default

    return metadata


def clean_chunk_text(text: str) -> str:
    """
    Clean chunk text while preserving structure.

    - Remove excessive whitespace
    - Normalize line breaks
    - Preserve sentence boundaries
    """
    # Replace multiple spaces with single space
    text = re.sub(r' +', ' ', text)

    # Replace multiple newlines with double newline (paragraph break)
    text = re.sub(r'\n\n+', '\n\n', text)

    # Strip leading/trailing whitespace
    text = text.strip()

    return text


if __name__ == "__main__":
    # Test with sample PDF
    import sys

    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        chunks = chunk_pdf(pdf_path)

        print(f"Extracted {len(chunks)} chunks from {pdf_path}")

        if chunks:
            print(f"\nFirst chunk preview:")
            print(f"  Content: {chunks[0]['content'][:200]}...")
            print(f"  Metadata: {chunks[0]['metadata']}")
            print(f"  Index: {chunks[0]['chunk_index']}")
    else:
        print("Usage: python chunker.py <pdf_path>")
