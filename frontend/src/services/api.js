import * as mock from "./mock.js";

// .env mein: VITE_API_URL=http://localhost:5000   (yahan /api MAT lagana)
const BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

// -------------------- AUTH --------------------

function authHeader() {
  try {
    const auth = JSON.parse(localStorage.getItem("auth") || "null");
    const token = auth?.token || auth?.accessToken;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
console.log(localStorage.getItem("auth"));
console.log(Object.keys(localStorage));
// -------------------- COMMON REQUEST --------------------

async function request(path, options = {}) {
  const headers = {
    ...authHeader(),
    ...options.headers,
  };

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
     credentials: "include",
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const data = await response.json();
      message = data.message || data.error || message;
    } catch {
      // Keep default error message
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// -------------------- REAL API --------------------

const real = {
  // AUTH

  login(email, password) {
    return request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register(name, email, password) {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },

  // CHAT CONVERSATIONS

  getConversations() {
    return request("/api/chat/conversations");
  },

  getMessages(conversationId) {
    return request(
      `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`
    );
  },

  // STREAM CHAT
  // Expected SSE events:
  // data: {"type":"token","text":"Hello"}
  // data: {"type":"sources","sources":[]}
  // data: {"type":"conversation","conversationId":"..."}
  // data: {"type":"done"}

  async sendMessage(
    conversationId,
    question,
    { onToken, onSources, onDone, onConversationId } = {}
  ) {
const response = await fetch(`${BASE}/api/chat/stream`, {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    ...authHeader(),
  },
  body: JSON.stringify({
    question,
    ...(conversationId ? { conversationId } : {}),
  }),
});

    if (!response.ok) {
      let message = `Request failed (${response.status})`;

      try {
        const data = await response.json();
        message = data.message || data.error || message;
      } catch {
        // Keep default message
      }

      throw new Error(message);
    }

    if (!response.body) {
      throw new Error("Streaming response body is unavailable");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let completed = false;

    const handleEvent = (block) => {
      const dataLines = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart());

      if (!dataLines.length) return;

      const data = dataLines.join("\n");

      if (data === "[DONE]") {
        completed = true;
        onDone?.();
        return;
      }

      let event;

      try {
        event = JSON.parse(data);
      } catch {
        console.error("Invalid SSE event:", data);
        return;
      }

      switch (event.type) {
        case "token":
          onToken?.(event.text || "");
          break;

        case "sources":
          onSources?.(event.sources || []);
          break;

        case "conversation":
        case "conversation_id": {
          const id =
            event.conversationId ||
            event.conversation_id ||
            event.id;

          if (id) onConversationId?.(id);
          break;
        }

        case "done":
          completed = true;
          onDone?.(event);
          break;

        case "error":
          throw new Error(
            event.message || event.error || "Chat streaming failed"
          );

        default:
          // Ignore unknown event types
          break;
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          handleEvent(block);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        handleEvent(buffer);
      }

      if (!completed) {
        onDone?.();
      }
    } finally {
      reader.releaseLock();
    }
  },

  // DOCUMENTS

  listDocuments() {
    return request("/api/documents");
  },

  getDocument(id) {
    return request(`/api/documents/${encodeURIComponent(id)}`);
  },

  uploadDocument(file, title) {
    const formData = new FormData();

    formData.append("file", file);

    if (title) {
      formData.append("title", title);
    }

    return request("/api/documents/upload", {
      method: "POST",
      body: formData,
    });
  },

  deleteDocument(id) {
    return request(`/api/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  // ANALYTICS

  getAnalytics() {
    return request("/api/analytics");
  },
};

// -------------------- MOCK / REAL SWITCH --------------------

const impl = USE_MOCK ? mock : real;

// -------------------- NAMED EXPORTS --------------------

export const login = (...args) => impl.login(...args);

export const register = (...args) => impl.register(...args);

export const getConversations = (...args) =>
  impl.getConversations(...args);

export const getMessages = (...args) =>
  impl.getMessages(...args);

export const sendMessage = (...args) =>
  impl.sendMessage(...args);

export const listDocuments = (...args) =>
  impl.listDocuments(...args);

export const getDocument = (...args) =>
  impl.getDocument(...args);

export const uploadDocument = (...args) =>
  impl.uploadDocument(...args);

export const deleteDocument = (...args) =>
  impl.deleteDocument(...args);

export const getAnalytics = (...args) =>
  impl.getAnalytics(...args);

export const isMock = USE_MOCK;