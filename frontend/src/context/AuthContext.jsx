import { createContext, useContext, useState } from "react";
import * as api from "../services/api.js";

const AuthContext = createContext(null);

function readStored() {
  try {
    return JSON.parse(localStorage.getItem("auth") || "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStored());

  const save = (data) => {
    setAuth(data);
    try { localStorage.setItem("auth", JSON.stringify(data)); } catch {}
  };

  const login = async (email, password) => save(await api.login(email, password));
  const register = async (name, email, password) => save(await api.register(name, email, password));
  const logout = () => {
    setAuth(null);
    try { localStorage.removeItem("auth"); } catch {}
  };

  return (
    <AuthContext.Provider value={{ user: auth?.user || null, token: auth?.token || null, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
