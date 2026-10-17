// Fake backend so the UI works without Node.js / FastAPI.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let docs = [
  { id: "1", name: "Return Policy.pdf", version: 1, status: "ready", created_at: "2026-10-01" },
  { id: "2", name: "Warranty Policy.pdf", version: 1, status: "ready", created_at: "2026-10-02" },
  { id: "3", name: "Shipping Policy.pdf", version: 1, status: "ready", created_at: "2026-10-03" },
];
let conversations = [];
let messages = {};
let stats = { questionsToday: 0, tokensUsed: 0, unanswered: 0 };

export async function login(email) {
  await wait(300);
  return {
    token: "mock-token",
    user: { id: "u1", name: email.split("@")[0], email, role: email.includes("admin") ? "admin" : "customer" },
  };
}
export const register = (name, email) => login(email);

export async function getConversations() { await wait(100); return [...conversations]; }
export async function getMessages(id) { await wait(100); return [...(messages[id] || [])]; }
export async function createConversation(title) {
  const c = { id: String(Date.now()), title: title.slice(0, 40) };
  conversations = [c, ...conversations];
  messages[c.id] = [];
  return c;
}

function fakeAnswer(q) {
  const t = q.toLowerCase();
  if (t.includes("return") || t.includes("refund"))
    return { text: "Yes. Products can be returned within 30 days of purchase, so a return after 20 days is allowed.", sources: [{ doc: "Return Policy.pdf", page: 4 }] };
  if (t.includes("warranty") && !t.includes("lifetime"))
    return { text: "All products are covered by a 12-month warranty from the date of purchase. Physical damage is not covered.", sources: [{ doc: "Warranty Policy.pdf", page: 2 }] };
  if (t.includes("ship") || t.includes("delivery"))
    return { text: "Standard delivery takes 3-5 business days.", sources: [{ doc: "Shipping Policy.pdf", page: 1 }] };
  return { text: "I couldn't find this information in the available company documents.", sources: [] };
}

export async function sendMessage(convId, question, { onToken, onSources, onDone }) {
  const { text, sources } = fakeAnswer(question);
  const list = messages[convId] || (messages[convId] = []);
  list.push({ role: "user", content: question });
  stats.questionsToday++;
  if (!sources.length) stats.unanswered++;
  await wait(500);
  for (const w of text.split(" ")) { onToken(w + " "); await wait(50); }
  onSources(sources);
  stats.tokensUsed += 8 + 350 + text.split(" ").length;
  list.push({ role: "assistant", content: text, sources });
  onDone();
}

export async function listDocuments() { await wait(150); return [...docs]; }
export async function uploadDocument(file) {
  await wait(1200);
  const d = { id: String(Date.now()), name: file.name, version: 1, status: "ready", created_at: new Date().toISOString().slice(0, 10) };
  docs = [d, ...docs];
  return d;
}
export async function deleteDocument(id) { await wait(150); docs = docs.filter((d) => d.id !== id); }
export async function getAnalytics() {
  await wait(150);
  return { documents: docs.length, ...stats };
}
