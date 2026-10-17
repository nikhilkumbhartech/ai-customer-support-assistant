
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

import {
  sendMessage as streamMessage,
  getConversations,
  getMessages,
} from "../../services/api.js";

// Initial state
const initialState = {
  messages: [],
  conversations: [],
  currentConversationId: null,
  sources: [],
  unansweredQuestions: [],
  loading: false,
  streaming: false,
  historyLoading: false,
  conversationsLoading: false,
  error: null,
};

// -------------------- SEND MESSAGE --------------------

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async (
    { question, conversationId = null },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const cleanQuestion = question.trim();

      if (!cleanQuestion) {
        return rejectWithValue("Please enter a message.");
      }

      // Add user message
      dispatch(
        addMessage({
          role: "user",
          content: cleanQuestion,
        })
      );

      // Add assistant placeholder
      dispatch(
        addMessage({
          role: "assistant",
          content: "",
          sources: [],
          streaming: true,
        })
      );

      let latestConversationId = conversationId;

      // Call the real/mock API selected in services/api.js
      await streamMessage(conversationId, cleanQuestion, {
        onToken: (token) => {
          dispatch(appendToken(token));
        },

        onSources: (sources) => {
          dispatch(setSources(sources));
        },

        onConversationId: (id) => {
          latestConversationId = id;
          dispatch(setCurrentConversationId(id));
        },

        onDone: () => {
          dispatch(finishStreaming());
        },
      });

      return {
        conversationId: latestConversationId,
      };
    } catch (error) {
      return rejectWithValue(
        error.message || "Unable to send message"
      );
    }
  }
);

// -------------------- FETCH CONVERSATIONS --------------------

export const fetchConversations = createAsyncThunk(
  "chat/fetchConversations",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getConversations();

      const conversations =
        response?.conversations ??
        response?.data?.conversations ??
        response?.data ??
        response;

      return Array.isArray(conversations) ? conversations : [];
    } catch (error) {
      return rejectWithValue(
        error.message || "Failed to load conversations"
      );
    }
  }
);

// -------------------- FETCH CONVERSATION MESSAGES --------------------

export const fetchMessages = createAsyncThunk(
  "chat/fetchMessages",
  async (conversationId, { rejectWithValue }) => {
    try {
      const response = await getMessages(conversationId);

      const messages =
        response?.messages ??
        response?.data?.messages ??
        response?.data ??
        response;

      return {
        conversationId,
        messages: Array.isArray(messages) ? messages : [],
      };
    } catch (error) {
      return rejectWithValue(
        error.message || "Failed to load messages"
      );
    }
  }
);

// -------------------- FETCH UNANSWERED QUESTIONS --------------------
// Optional admin feature. Uses the existing backend endpoint directly.

export const fetchUnansweredQuestions = createAsyncThunk(
  "chat/fetchUnansweredQuestions",
  async (_, { rejectWithValue }) => {
    try {
      const baseUrl = (
        import.meta.env.VITE_API_URL || "http://localhost:5000"
      ).replace(/\/$/, "");

      const response = await fetch(`${baseUrl}/api/chat/unanswered`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load unanswered questions (${response.status})`
        );
      }

      const data = await response.json();

      return data?.questions ?? data?.data ?? data ?? [];
    } catch (error) {
      return rejectWithValue(
        error.message || "Failed to load unanswered questions"
      );
    }
  }
);

// -------------------- SLICE --------------------

const chatSlice = createSlice({
  name: "chat",
  initialState,

  reducers: {
    // Add a message to the current conversation
    addMessage: (state, action) => {
      state.messages.push({
        id: `${Date.now()}-${state.messages.length}`,
        role: action.payload.role,
        content: action.payload.content || "",
        sources: action.payload.sources || [],
        streaming: action.payload.streaming || false,
        error: false,
        createdAt: new Date().toISOString(),
      });
    },

    // Append each streamed token
    appendToken: (state, action) => {
      const lastMessage = state.messages[state.messages.length - 1];

      if (lastMessage?.role === "assistant") {
        lastMessage.content += action.payload || "";
        lastMessage.streaming = true;
      }
    },

    // Save source documents
    setSources: (state, action) => {
      state.sources = Array.isArray(action.payload)
        ? action.payload
        : [];

      const lastMessage = state.messages[state.messages.length - 1];

      if (lastMessage?.role === "assistant") {
        lastMessage.sources = state.sources;
      }
    },

    // Stop the streaming indicator
    finishStreaming: (state) => {
      const lastMessage = state.messages[state.messages.length - 1];

      if (lastMessage?.role === "assistant") {
        lastMessage.streaming = false;
      }
    },

    // Select a conversation
    setCurrentConversationId: (state, action) => {
      state.currentConversationId = action.payload;
    },

    // Start a new conversation locally
    clearChat: (state) => {
      state.messages = [];
      state.sources = [];
      state.currentConversationId = null;
      state.error = null;
      state.loading = false;
      state.streaming = false;
      state.historyLoading = false;
    },

    // Clear error
    clearChatError: (state) => {
      state.error = null;
    },

    // Update the latest assistant message
    updateLastAssistantMessage: (state, action) => {
      const lastMessage = state.messages[state.messages.length - 1];

      if (lastMessage?.role === "assistant") {
        lastMessage.content = action.payload;
      }
    },
  },

  extraReducers: (builder) => {
    builder
      // SEND MESSAGE
      .addCase(sendMessage.pending, (state) => {
        state.loading = true;
        state.streaming = true;
        state.error = null;
        state.sources = [];
      })

      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loading = false;
        state.streaming = false;

        if (action.payload?.conversationId) {
          state.currentConversationId =
            action.payload.conversationId;
        }

        const lastMessage = state.messages[state.messages.length - 1];

        if (lastMessage?.role === "assistant") {
          lastMessage.streaming = false;
        }
      })

      .addCase(sendMessage.rejected, (state, action) => {
        state.loading = false;
        state.streaming = false;

        state.error =
          action.payload ||
          action.error.message ||
          "Chat failed";

        const lastMessage = state.messages[state.messages.length - 1];

        if (lastMessage?.role === "assistant") {
          if (!lastMessage.content) {
            state.messages.pop();
          } else {
            lastMessage.streaming = false;
            lastMessage.error = true;
          }
        }
      })

      // FETCH CONVERSATIONS
      .addCase(fetchConversations.pending, (state) => {
        state.conversationsLoading = true;
      })

      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.conversationsLoading = false;
        state.conversations = action.payload;
      })

      .addCase(fetchConversations.rejected, (state, action) => {
        state.conversationsLoading = false;
        state.error =
          action.payload || "Failed to load conversations";
      })

      // FETCH MESSAGES
      .addCase(fetchMessages.pending, (state) => {
        state.historyLoading = true;
        state.error = null;
      })

      .addCase(fetchMessages.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.currentConversationId = action.payload.conversationId;

        state.messages = action.payload.messages.map(
          (message, index) => {
            // Support either one-message-per-row or combined chat records
            if (
              message.userMessage != null &&
              message.aiResponse != null &&
              message.role == null
            ) {
              return [
                {
                  id: `${message.id || index}-user`,
                  role: "user",
                  content: message.userMessage,
                  sources: [],
                  streaming: false,
                },
                {
                  id: `${message.id || index}-assistant`,
                  role: "assistant",
                  content: message.aiResponse,
                  sources: message.sources || [],
                  streaming: false,
                },
              ];
            }

            return [{
              id: message.id || `${index}`,
              role:
                message.role ||
                (message.userMessage != null ? "user" : "assistant"),
              content:
                message.content ??
                message.userMessage ??
                message.aiResponse ??
                message.response ??
                "",
              sources: message.sources || [],
              streaming: false,
              createdAt: message.createdAt || null,
            }];
          }
        ).flat();

        state.sources = [];
      })

      .addCase(fetchMessages.rejected, (state, action) => {
        state.historyLoading = false;
        state.error =
          action.payload || "Failed to load messages";
      })

      // UNANSWERED QUESTIONS
      .addCase(
        fetchUnansweredQuestions.fulfilled,
        (state, action) => {
          state.unansweredQuestions = Array.isArray(action.payload)
            ? action.payload
            : [];
        }
      )

      .addCase(
        fetchUnansweredQuestions.rejected,
        (state, action) => {
          state.error =
            action.payload || "Failed to load unanswered questions";
        }
      );
  },
});

// -------------------- ACTIONS --------------------

export const {
  addMessage,
  appendToken,
  setSources,
  finishStreaming,
  setCurrentConversationId,
  clearChat,
  clearChatError,
  updateLastAssistantMessage,
} = chatSlice.actions;

export default chatSlice.reducer;
