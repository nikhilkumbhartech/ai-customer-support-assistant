
const db = require("../config/db");
const ai = require("./aiService");


async function uploadDocument(file, title, uploadedBy) {
  const docTitle = title?.trim() || file.originalname;

  const { rows } = await db.query(
    `INSERT INTO documents
      (name, file_type, file_path, status, uploaded_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, status, uploaded_by`,
    [
      docTitle,
      "pdf",
      file.originalname,
      "processing",
      uploadedBy,
    ]
  );

  const document = rows[0];

  try {
    const result = await ai.ingestDocument(file, document.id);

    return {
      ...document,
      ...result,
      name: document.name,
      uploaded_by: document.uploaded_by,
      status: "ready",
    };
  } catch (err) {
    await db.query(
      "UPDATE documents SET status = $1 WHERE id = $2",
      ["failed", document.id]
    );
    throw err;
  }
}


async function listDocuments() {
  const { rows } = await db.query(
    `SELECT d.id, d.name, d.status, d.created_at,
            (SELECT count(*) FROM document_chunks c
             WHERE c.document_id = d.id)::int AS chunks
     FROM documents d
     ORDER BY d.created_at DESC`
  );
  return rows;
}

async function getDocument(id) {
  const { rows } = await db.query(
    `SELECT id, name, status, created_at
     FROM documents WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function deleteDocument(id) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM document_chunks WHERE document_id = $1", [id]
    );
    const { rowCount } = await client.query(
      "DELETE FROM documents WHERE id = $1", [id]
    );
    await client.query("COMMIT");
    return rowCount > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
};
