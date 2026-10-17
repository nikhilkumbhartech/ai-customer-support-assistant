CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  file_type   VARCHAR(10) NOT NULL,
  file_path   TEXT NOT NULL,
  version     INT DEFAULT 1,
  status      VARCHAR(20) DEFAULT 'processing'
              CHECK (status IN ('processing', 'ready', 'failed')),
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE document_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text  TEXT NOT NULL,
  embedding   VECTOR(768),
  page_number INT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);

CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) DEFAULT 'New chat',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  sources         JSONB,
  token_count     INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);