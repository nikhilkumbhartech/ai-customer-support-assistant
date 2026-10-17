const express = require('express');

const { chatLimiter } = require('../middleware/rateLimit');
const chat = require('../service/chatService');
const ai = require('../service/aiService');   
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/chat/stream   body: { question, conversationId? }
router.post('/stream', chatLimiter, async (req, res) => {
  const { question, conversationId: incomingId } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'question required' });

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    let conversationId = incomingId;
    if (conversationId) {
      if (!(await chat.ownsConversation(req.user.id, conversationId))) {
        return res.status(403).json({ error: 'not your conversation' });
      }
    } else {
      conversationId = await chat.createConversation(req.user.id, question);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    // frontend ko conversation id batao taaki agla sawal usi mein jaye
    res.write(`data: ${JSON.stringify({ type: 'conversation', id: conversationId })}\n\n`);

    await chat.streamAnswer({
      conversationId,
      question,
      signal: controller.signal,
      write: (chunk) => res.write(chunk),
    });
    res.end();
  } catch (err) {
    console.error('chat stream error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'AI service error' });
    else res.end();
  }
});

// GET /api/chat/conversations
router.get('/conversations', async (req, res) => {
  res.json(await chat.listConversations(req.user.id));
});

// GET /api/chat/conversations/:id/messages
router.get('/conversations/:id/messages', async (req, res) => {
  if (!(await chat.ownsConversation(req.user.id, req.params.id))) {
    return res.status(403).json({ error: 'not your conversation' });
  }
  res.json(await chat.getMessages(req.params.id));
});

// GET /api/chat/unanswered   (sirf admin)
router.get('/unanswered', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin only' });
  res.json(await chat.listUnanswered());
});

// debug search (pehle jaisa)
router.post('/search', async (req, res) => {
  try { res.json(await ai.search(req.body.question)); }
  catch (err) { res.status(502).json({ error: err.message }); }
});

module.exports = router;