import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../config/axios";

const getError = (err) =>
  err.response?.data?.message || err.message || "Something went wrong";

/* ---------- THUNKS ---------- */

// Register ke baad user set NAHI hota, taaki user login page par jaye
export const registerUser = createAsyncThunk(
  "auth/register",
  async ({ name, email, password }, { rejectWithValue }) => {
    try {
      await api.post("/api/auth/register", { name, email, password });
    } catch (err) {
      return rejectWithValue(getError(err));
    }
  }
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const res = await api.post("/api/auth/login", { email, password });
      return res.data.user;
    } catch (err) {
      return rejectWithValue(getError(err));
    }
  }
);

export const fetchMe = createAsyncThunk(
  "auth/me",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/api/auth/me");
      return res.data.user;
    } catch (err) {
      return rejectWithValue(getError(err));
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  await api.post("/api/auth/logout");
});

/* ---------- STATE ---------- */

const initialState = {
  user: null,
  status: "idle",
  error: null,
  initialized: false,
};

/* ---------- SLICE ---------- */

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // LOGIN
      .addCase(loginUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      // REGISTER (user set nahi karna)
      .addCase(registerUser.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.status = "succeeded";
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })

      // FETCH ME (app start par session check)
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.initialized = true;
      })
      .addCase(fetchMe.rejected, (state) => {
        state.user = null;
        state.initialized = true;
      })

      // LOGOUT
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.status = "idle";
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;