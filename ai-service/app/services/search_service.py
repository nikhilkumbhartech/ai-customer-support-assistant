from app.db import get_conn
from app.services.embedding_service import embed_texts


def search_chunks(query: str, top_k: int = 5, document_id: str | None = None) -> list[dict]:
    """Sawal se milte-julte chunks laata hai.

    Har result: {id, document_id, page, chunk_index, content, doc, score}
    score = cosine similarity (1 = bilkul same, 0 = koi relation nahi)
    """
    qvec = embed_texts([query])[0]

    where = "WHERE d.status = 'ready'"
    params: list = [qvec]  # SELECT wala score
    if document_id:
        where += " AND c.document_id = %s"
        params.append(document_id)
    params += [qvec, top_k]  # ORDER BY aur LIMIT

    sql = f"""
        SELECT c.id, c.document_id, c.page, c.chunk_index, c.content,
               COALESCE(to_jsonb(d)->>'title', to_jsonb(d)->>'name',
                        to_jsonb(d)->>'file_name', 'Document') AS doc,
               1 - (c.embedding <=> %s) AS score
        FROM document_chunks c
        JOIN documents d ON d.id = c.document_id
        {where}
        ORDER BY c.embedding <=> %s
        LIMIT %s
    """
    with get_conn() as conn:
        return conn.execute(sql, params).fetchall()
