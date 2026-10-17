import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMe } from "./store/slice/authSlice.js";
import AppRoutes from "./routes/AppRoutes.jsx";

export default function App() {
  const dispatch = useDispatch();
  const initialized = useSelector((s) => s.auth.initialized);

  useEffect(() => {
    dispatch(fetchMe());
  }, [dispatch]);

  if (!initialized) return <div style={{ padding: 24 }}>Loading...</div>;
  return <AppRoutes />;
}