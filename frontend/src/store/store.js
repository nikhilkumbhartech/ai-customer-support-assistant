
import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slice/authSlice";
import documentsReducer from "./slice/documentsSlice";
import chatReducer from "./slice/chatSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    documents: documentsReducer,
    chat: chatReducer,
  },
});

export default store;
