from io import BytesIO

from pypdf import PdfReader
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)


def extract_pages(data: bytes) -> list[dict]:
    """PDF ke har page ka text nikalta hai: [{"page": 1, "text": "..."}]"""
    reader = PdfReader(BytesIO(data))
    pages = []
    for number, page in enumerate(reader.pages, start=1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append({"page": number, "text": text})
    return pages


def make_chunks(pages: list[dict]) -> list[dict]:
    """Har page ko chhote tukdon mein todta hai, page number saath rakhta hai."""
    chunks = []
    index = 0
    for p in pages:
        for piece in splitter.split_text(p["text"]):
            chunks.append({"chunk_index": index, "page": p["page"], "content": piece})
            index += 1
    return chunks
