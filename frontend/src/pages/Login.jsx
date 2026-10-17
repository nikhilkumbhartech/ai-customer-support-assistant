import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bot, Mail, Lock, User, ShieldCheck, FileSearch, Zap, Loader2 } from "lucide-react";
import { isMock } from "../services/api.js";
import { useDispatch, useSelector } from "react-redux";
import { loginUser, registerUser } from "../store/slice/authSlice.js";

const features = [
  { icon: FileSearch, text: "Answers grounded in your company documents" },
  { icon: ShieldCheck, text: "Source citations with document and page" },
  { icon: Zap, text: "Real-time streaming responses" },
];

export default function Login() {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        await dispatch(loginUser({ email: form.email, password: form.password })).unwrap();
      } else {
        await dispatch(registerUser({ name: form.name, email: form.email, password: form.password })).unwrap();
      }
      navigate("/");
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="logo"><Bot size={26} /></div>
        <h1>AI Customer Support</h1>
        <p>Instant, accurate answers from your company knowledge base.</p>
        <ul>
          {features.map(({ icon: Icon, text }) => (
            <li key={text}><Icon size={18} /> {text}</li>
          ))}
        </ul>
      </div>

      <div className="auth-side">
        <motion.form
          className="auth-card"
          onSubmit={submit}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="muted">{mode === "login" ? "Sign in to continue" : "Start getting instant answers"}</p>

          {mode === "register" && (
            <label className="field">
              <User size={16} />
              <input placeholder="Full name" value={form.name} onChange={set("name")} required />
            </label>
          )}
          <label className="field">
            <Mail size={16} />
            <input type="email" placeholder="Email address" value={form.email} onChange={set("email")} required />
          </label>
          <label className="field">
            <Lock size={16} />
            <input type="password" placeholder="Password" value={form.password} onChange={set("password")} required minLength={6} />
          </label>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn primary full lg" disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" /> : mode === "login" ? "Sign in" : "Register"}
          </button>

          <button type="button" className="link center" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "No account? Register" : "Already have an account? Sign in"}
          </button>

          {isMock && (
            <div className="hint">
              Demo mode: any email works. Use an email containing <b>admin</b> (e.g. admin@test.com) for the admin role.
            </div>
          )}
        </motion.form>
      </div>
    </div>
  );
}