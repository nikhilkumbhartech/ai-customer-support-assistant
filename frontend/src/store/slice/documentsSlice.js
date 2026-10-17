
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../config/axios";

// Fetch all documents
export const fetchDocuments = createAsyncThunk(
  "documents/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get("/api/documents");
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || "Failed to load documents"
      );
    }
  }
);

// Upload PDF document
export const uploadDocument = createAsyncThunk(
  "documents/upload",
  async ({ file, title }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      if (title?.trim()) {
        formData.append("title", title.trim());
      }

      const response = await api.post(
        "/api/documents/upload",
        formData
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || "Document upload failed"
      );
    }
  }
);

// Fetch one document
export const fetchDocumentById = createAsyncThunk(
  "documents/fetchById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `/api/documents/${encodeURIComponent(id)}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || "Failed to load document"
      );
    }
  }
);

// Delete document
export const deleteDocument = createAsyncThunk(
  "documents/delete",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/api/documents/${encodeURIComponent(id)}`);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message || "Document deletion failed"
      );
    }
  }
);

const documentsSlice = createSlice({
  name: "documents",

  initialState: {
    items: [],
    selectedDocument: null,
    status: "idle",
    uploadStatus: "idle",
    deleteStatus: "idle",
    error: null,
    uploadError: null,
  },

  reducers: {
    clearDocumentErrors(state) {
      state.error = null;
      state.uploadError = null;
    },

    clearSelectedDocument(state) {
      state.selectedDocument = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // Fetch documents
      .addCase(fetchDocuments.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.status = "succeeded";

        // Supports either an array or { documents: [...] }
        const data = action.payload;
        state.items = Array.isArray(data)
          ? data
          : data.documents || [];
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || "Failed to load documents";
      })

      // Upload document
      .addCase(uploadDocument.pending, (state) => {
        state.uploadStatus = "loading";
        state.uploadError = null;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.uploadStatus = "succeeded";

        const data = action.payload;
        const doc = data.document || data;

        if (doc?.id) {
          const index = state.items.findIndex(
            (item) => item.id === doc.id
          );

          if (index >= 0) {
            state.items[index] = doc;
          } else {
            state.items.unshift(doc);
          }
        }
      })
      .addCase(uploadDocument.rejected, (state, action) => {
        state.uploadStatus = "failed";
        state.uploadError =
          action.payload || "Document upload failed";
      })

      // Fetch one document
      .addCase(fetchDocumentById.fulfilled, (state, action) => {
        state.selectedDocument =
          action.payload.document || action.payload;
      })

      // Delete document
      .addCase(deleteDocument.pending, (state) => {
        state.deleteStatus = "loading";
        state.error = null;
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        state.deleteStatus = "succeeded";
        state.items = state.items.filter(
          (item) => item.id !== action.payload
        );

        if (state.selectedDocument?.id === action.payload) {
          state.selectedDocument = null;
        }
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.deleteStatus = "failed";
        state.error =
          action.payload || "Document deletion failed";
      });
  },
});

export const {
  clearDocumentErrors,
  clearSelectedDocument,
} = documentsSlice.actions;

export default documentsSlice.reducer;
