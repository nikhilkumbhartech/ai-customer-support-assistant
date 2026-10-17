import { Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Login from "../pages/Login.jsx";
import Chat from "../pages/Chat.jsx";
import Admin from "../pages/Admin.jsx";

function ProtectedRoute({ children, role }) {
  const user = useSelector((s) => s.auth.user);
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function PublicRoute({ children }) {
  const user = useSelector((s) => s.auth.user);
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;
  return children;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><Admin /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}