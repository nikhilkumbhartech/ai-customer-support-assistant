
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Coins,
  HelpCircle,
  UploadCloud,
  Trash2,
  LogOut,
  Loader2,
  Bot,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser } from "../store/slice/authSlice.js";
import {
  fetchDocuments,
  uploadDocument as uploadDocumentThunk,
  deleteDocument as deleteDocumentThunk,
} from "../store/slice/documentsSlice.js";
import * as api from "../services/api.js";

export default function Admin() {
  const dispatch = useDispatch();

  const user = useSelector((s) => s.auth.user);
  const docs = useSelector((s) => s.documents.items);
  const documentStatus = useSelector((s) => s.documents.status);

  const [stats, setStats] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fileRef = useRef(null);

  const logout = () => {
    dispatch(logoutUser());
  };

  const load = async () => {
    try {
      const [, analytics] = await Promise.all([
        dispatch(fetchDocuments()).unwrap(),
        api.getAnalytics(),
      ]);

      setStats(analytics);
    } catch (e) {
      toast.error(
        typeof e === "string"
          ? e
          : e.message || "Could not load data"
      );
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported right now.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("PDF size must be 20 MB or less.");
      return;
    }

    setUploading(true);

    const t = toast.loading("Processing document...");

    try {
      await dispatch(
        uploadDocumentThunk({
          file,
          title: file.name.replace(/\.pdf$/i, ""),
        })
      ).unwrap();

      toast.success("Document added to knowledge base", {
        id: t,
      });

      await load();
    } catch (err) {
      toast.error(
        typeof err === "string"
          ? err
          : err.message || "Upload failed",
        { id: t }
      );
    } finally {
      setUploading(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.name}" and its knowledge?`)) {
      return;
    }

    try {
      await dispatch(deleteDocumentThunk(d.id)).unwrap();

      toast.success("Document deleted");
    } catch (err) {
      toast.error(
        typeof err === "string"
          ? err
          : err.message || "Delete failed"
      );
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files[0]);
  };

  const cards = stats && [
    {
      label: "Documents",
      value: stats.documents,
      icon: FileText,
      tone: "blue",
    },
    {
      label: "Questions today",
      value: stats.questionsToday,
      icon: MessageSquare,
      tone: "green",
    },
    {
      label: "Tokens used",
      value: Number(stats.tokensUsed).toLocaleString(),
      icon: Coins,
      tone: "amber",
    },
    {
      label: "Unanswered",
      value: stats.unanswered,
      icon: HelpCircle,
      tone: "red",
    },
  ];

  return (
    <div className="admin">
      <header className="topbar">
        <div className="side-brand">
          <span className="logo sm">
            <Bot size={18} />
          </span>
         AI Customer Support Assistance <span className="crumb">/ Admin</span>
        </div>

        <div className="row">
          <Link className="btn ghost" to="/">
            <ArrowLeft size={15} /> Back to chat
          </Link>

          <span className="small muted">{user?.name}</span>

          <button
            className="icon-btn"
            onClick={logout}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="content">
        <h1 className="page-title">Dashboard</h1>

        <div className="cards">
          {cards ? (
            cards.map(({ label, value, icon: Icon, tone }, i) => (
              <motion.div
                key={label}
                className="card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className={"card-icon " + tone}>
                  <Icon size={18} />
                </div>

                <div className="stat">{value}</div>
                <div className="muted small">{label}</div>
              </motion.div>
            ))
          ) : (
            <div className="muted">Loading...</div>
          )}
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Knowledge base</h2>
              <div className="muted small">
                Documents the assistant uses to answer questions
              </div>
            </div>
          </div>

          <div
            className={"dropzone" + (dragging ? " drag" : "")}
            onClick={() => {
              if (!uploading) fileRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={(e) => upload(e.target.files[0])}
            />

            {uploading ? (
              <Loader2 size={26} className="spin" />
            ) : (
              <UploadCloud size={26} />
            )}

            <div>
              <b>{uploading ? "Processing..." : "Click to upload"}</b>
              {!uploading && " or drag and drop a PDF"}
            </div>

            <div className="muted small">
              PDF only · text is extracted, chunked and embedded
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="doc-name">
                    <FileText size={16} /> {d.name}
                  </td>

                  <td>v{d.version}</td>

                  <td>
                    <span className={"status " + d.status}>
                      {d.status}
                    </span>
                  </td>

                  <td>{String(d.created_at || "").slice(0, 10)}</td>

                  <td className="right">
                    <button
                      className="icon-btn danger"
                      onClick={() => remove(d)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}

              {!docs.length && (
                <tr>
                  <td colSpan="5" className="muted center-text">
                    {documentStatus === "loading"
                      ? "Loading documents..."
                      : "No documents yet. Upload a PDF to build the knowledge base."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
