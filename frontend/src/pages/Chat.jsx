
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import {
  Bot,
  User as UserIcon,
  Plus,
  Send,
  LogOut,
  LayoutDashboard,
  MessageSquare,
  FileText,
  Sparkles,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";

import { logoutUser } from "../store/slice/authSlice.js";

import {
  sendMessage,
  fetchConversations,
  fetchMessages,
  clearChat,
  setCurrentConversationId,
  clearChatError,
} from "../store/slice/chatSlice.js";

const SUGGESTIONS = [
  "Can I return my product after 20 days?",
  "What does the warranty cover?",
  "How long does shipping take?",
  "Do you provide lifetime warranty?",
];

function Message({ m }) {
  const isUser = m.role === "user";

  return (
    <motion.div
      className={"msg " + m.role}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className={"avatar " + m.role}>
        {isUser ? <UserIcon size={16} /> : <Bot size={16} />}
      </div>

      <div className={"bubble" + (m.error ? " err" : "")}>
        {isUser ? (
          m.content
        ) : (
          <>
            {m.content ? (
              <div className="md">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ) : (
              (m.streaming || m.isStreaming) && (
                <span className="typing">
                  <i />
                  <i />
                  <i />
                </span>
              )
            )}

            {(m.streaming || m.isStreaming) && m.content && (
              <span className="cursor" />
            )}

   
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function Chat() {
  const dispatch = useDispatch();
  const bottomRef = useRef(null);
  const [input, setInput] = useState("");

  const user = useSelector((state) => state.auth.user);

  const {
    conversations = [],
    messages = [],
    currentConversationId,
    loading,
    streaming,
    historyLoading,
    conversationsLoading,
    error,
  } = useSelector((state) => state.chat);

  const busy = Boolean(loading || streaming);

  // Load conversation list from backend through Redux thunk
  useEffect(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  // Show API errors
  useEffect(() => {
    if (error) {
      toast.error(
        typeof error === "string"
          ? error
          : "Something went wrong. Please try again."
      );
      dispatch(clearChatError());
    }
  }, [error, dispatch]);

  // Auto-scroll when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Open conversation history
  const openConversation = (id) => {
    if (busy || historyLoading) return;

    dispatch(fetchMessages(id));
  };

  // Start a new chat
  const newChat = () => {
    if (busy) return;
    dispatch(clearChat());
  };

  // Send message
  const ask = async (question) => {
    const text = question.trim();

    if (!text || busy) return;

    setInput("");

    try {
      await dispatch(
        sendMessage({
          question: text,
          conversationId: currentConversationId,
        })
      ).unwrap();

      // Refresh sidebar after the response completes
      dispatch(fetchConversations());
    } catch (err) {
      toast.error(
        typeof err === "string"
          ? err
          : "Something went wrong. Please try again."
      );
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    ask(input);
  };

  const initial = (user?.name || "?").charAt(0).toUpperCase();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="logo sm">
            <Bot size={18} />
          </span>
         AI Customer Support Assistance
        </div>

        <button
          className="btn new-chat"
          onClick={newChat}
          disabled={busy}
        >
          <Plus size={16} />
          New chat
        </button>

        <div className="side-label">Recent</div>

        <div className="conv-list">
          {conversationsLoading ? (
            <div className="side-empty">Loading conversations...</div>
          ) : conversations.length ? (
            conversations.map((conversation) => {
              const id =
                conversation.id ||
                conversation._id ||
                conversation.conversationId;

              return (
                <button
                  key={id}
                  className={
                    "conv" +
                    (id === currentConversationId ? " active" : "")
                  }
                  onClick={() => openConversation(id)}
                  disabled={busy || historyLoading}
                >
                  <MessageSquare size={14} />
                  <span>
                    {conversation.title || "Conversation"}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="side-empty">No conversations yet</div>
          )}
        </div>

        <div className="side-foot">
          {user?.role === "admin" && (
            <Link className="side-link" to="/admin">
              <LayoutDashboard size={16} />
              Admin dashboard
            </Link>
          )}

          <div className="profile">
            <div className="profile-avatar">{initial}</div>

            <div className="profile-info">
              <div className="profile-name">{user?.name}</div>
              <div className="profile-role">{user?.role}</div>
            </div>

            <button
              className="icon-btn"
              onClick={() => dispatch(logoutUser())}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="chat">
        <div className="messages">
          {!messages.length ? (
            <motion.div
              className="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="logo lg">
                <Sparkles size={26} />
              </div>

              <h2>How can I help you today?</h2>

              <p className="muted">
                Ask about returns, warranty, shipping and more.
                Every answer comes from company documents, with sources.
              </p>

              <div className="suggest">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="suggest-card"
                    onClick={() => ask(suggestion)}
                    disabled={busy}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="thread">
              {messages.map((message, index) => (
                <Message
                  key={message.id || index}
                  m={message}
                />
              ))}
            </div>
          )}

          {historyLoading && (
            <div className="side-empty">Loading messages...</div>
          )}

          <div ref={bottomRef} />
        </div>

        <form className="composer" onSubmit={onSubmit}>
          <div className="composer-box">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask your question..."
              disabled={busy}
            />

            <button
              className="send"
              disabled={busy || !input.trim()}
              title="Send"
            >
              <Send size={17} />
            </button>
          </div>

        
        </form>
      </main>
    </div>
  );
}