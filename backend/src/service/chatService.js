const db = require('../config/db');
const ai = require('./aiService');

async function createConversation(userId, firstQuestion) {
  const title = firstQuestion.slice(0, 60);
  const { rows } = await db.query(
    'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
    [userId, title]
  );
  return rows[0].id;
}

// conversation is user ki hai ya nahi, yeh check karna zaroori hai
async function ownsConversation(userId, conversationId) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM conversations WHERE id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  return rowCount > 0;
}

// DB se pichhle 10 messages (client ki bheji history pe bharosa nahi)
async function loadHistory(conversationId, limit = 10) {
  const { rows } = await db.query(
    `SELECT role, content FROM (
       SELECT role, content, created_at FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC LIMIT $2
     ) t ORDER BY created_at ASC`,
    [conversationId, limit]
  );
  return rows;
}

function saveMessage(conversationId, role, content, extra = {}) {
  return db.query(
    `INSERT INTO messages (conversation_id, role, content, sources, answered)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      conversationId,
      role,
      content,
      extra.sources ? JSON.stringify(extra.sources) : null,
      extra.answered ?? null,
    ]
  );
}

// Main kaam: FastAPI se stream lo, client ko aage bhejo, aur saath mein save karo
async function streamAnswer({ conversationId, question, signal, write }) {
  const history = await loadHistory(conversationId); // user ka sawal save hone se pehle
  await saveMessage(conversationId, 'user', question);

  const upstream = await ai.streamChat(question, history, signal);

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let sources = [];
  let answered = null;

  try {
    for await (const chunk of upstream.body) {
      write(chunk); // client ko jaise ka taisa

      buffer += decoder.decode(chunk, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop();

      for (const e of events) {
        if (!e.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(e.slice(6));
          if (evt.type === 'token') fullText += evt.text;
          else if (evt.type === 'sources') sources = evt.sources;
          else if (evt.type === 'done') answered = evt.answered;
        } catch { /* adhoori line, ignore */ }
      }
    }
  } finally {
    // user beech mein tab band kar de to bhi jo mila wo save ho jaye
    if (fullText) {
      await saveMessage(conversationId, 'assistant', fullText, { sources, answered });
    }
  }
}

async function listConversations(userId) {
  const { rows } = await db.query(
    'SELECT id, title, created_at FROM conversations WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

async function getMessages(conversationId) {
  const { rows } = await db.query(
    `SELECT role, content, sources, created_at FROM messages
     WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows;
}

// Admin ke liye: jin sawalon ka jawab nahi mila
async function listUnanswered(limit = 50) {
  const { rows } = await db.query(
    `SELECT u.id, u.content AS question, u.created_at
     FROM messages a
     JOIN messages u ON u.conversation_id = a.conversation_id
       AND u.role = 'user'
       AND u.created_at = (
         SELECT max(created_at) FROM messages
         WHERE conversation_id = a.conversation_id AND role = 'user' AND created_at < a.created_at
       )
     WHERE a.role = 'assistant' AND a.answered = false
     ORDER BY a.created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = {
  createConversation, ownsConversation, streamAnswer,
  listConversations, getMessages, listUnanswered,
};