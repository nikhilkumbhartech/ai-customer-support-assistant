import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.db import get_conn
from app.services.embedding_service import embed_texts
from app.services.pdf_service import extract_pages, make_chunks

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/preview")
async def preview(file: UploadFile = File(...)):
    """Sirf test ke liye: PDF ke chunks dikhata hai, DB mein kuch save nahi karta."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    data = await file.read()
    try:
        pages = extract_pages(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read this PDF")

    if not pages:
        raise HTTPException(status_code=422, detail="No text found in PDF (scanned file?)")

    chunks = make_chunks(pages)
    return {
        "filename": file.filename,
        "pages": len(pages),
        "total_chunks": len(chunks),
        "sample": chunks[:3],
    }


@router.post("/document")
def ingest_document(document_id: str = Form(...), file: UploadFile = File(...)):
    """PDF ko chunks + embeddings mein badal ke document_chunks table mein save karta hai."""
    # 1. Input check
    try:
        uuid.UUID(document_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="document_id must be a valid UUID")
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # 2. Document DB mein hai ya nahi
    with get_conn() as conn:
        found = conn.execute("SELECT 1 FROM documents WHERE id = %s", (document_id,)).fetchone()
    if not found:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        # 3. PDF, chunks, embeddings
        pages = extract_pages(file.file.read())
        if not pages:
            raise ValueError("No text found in PDF (scanned file?)")
        chunks = make_chunks(pages)
        vectors = embed_texts([c["content"] for c in chunks])

        # 4. Save (purane chunks hata ke, taaki dobara ingest karne par duplicate na bane)
        rows = [
            (document_id, c["chunk_index"], c["page"], c["content"], v)
            for c, v in zip(chunks, vectors)
        ]
        with get_conn() as conn:
            conn.execute("DELETE FROM document_chunks WHERE document_id = %s", (document_id,))
            with conn.cursor() as cur:
                cur.executemany(
                    """INSERT INTO document_chunks
                       (document_id, chunk_index, page, content, embedding)
                       VALUES (%s, %s, %s, %s, %s)""",
                    rows,
                )
            conn.execute("UPDATE documents SET status = 'ready' WHERE id = %s", (document_id,))
    except Exception as e:
        with get_conn() as conn:
            conn.execute("UPDATE documents SET status = 'failed' WHERE id = %s", (document_id,))
        raise HTTPException(status_code=422, detail=str(e))

    return {"document_id": document_id, "pages": len(pages), "chunks_saved": len(chunks)}
