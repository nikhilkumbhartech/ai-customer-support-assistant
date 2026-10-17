
const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// JSON request helper
async function postJson(path, body, signal) {
  return fetch(`${AI_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
}

// Chat: streaming response
async function streamChat(question, history = [], signal) {
  const res = await postJson(
    "/chat/stream",
    { question, history },
    signal
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI chat failed: ${res.status} ${text}`);
  }

  return res;
}

// Search without Gemini generation
async function search(question) {
  const res = await postJson("/chat/search", { question });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI search failed: ${res.status} ${text}`);
  }

  return res.json();
}

// PDF ingestion: send document ID and PDF to FastAPI
async function ingestDocument(file, documentId) {
  if (!file || !file.buffer) {
    throw new Error("Valid PDF file is required");
  }

  if (!documentId) {
    throw new Error("document_id is required");
  }

  const form = new FormData();

  // FastAPI expects document_id as Form(...)
  form.append("document_id", String(documentId));

  // FastAPI expects file as File(...)
  const pdfBlob = new Blob([file.buffer], {
    type: file.mimetype || "application/pdf",
  });

  form.append("file", pdfBlob, file.originalname);

  const res = await fetch(`${AI_URL}/ingest/document`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ingest failed: ${res.status} ${text}`);
  }

  return res.json();
}

// AI service health check
async function health() {
  try {
    const res = await fetch(`${AI_URL}/health`);
    return res.ok;
  } catch (error) {
    return false;
  }
}

module.exports = {
  streamChat,
  search,
  ingestDocument,
  health,
};
