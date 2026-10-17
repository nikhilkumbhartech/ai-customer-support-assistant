require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// Middlewares
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", require("./src/route/authRoutes"));
app.use("/api/chat", require("./src/route/chatRoutes"));
app.use("/api/documents", require("./src/route/documentRoutes"));

// Error handler (hamesha sabse last mein)

app.use((err, req, res, next) => {
  console.error("UPLOAD ERROR:", err);
  console.error("FIELD NAME:", err.field);

  res.status(err.status || 500).json({
    message: err.message || "Server error",
    field: err.field || null,
  });
});

module.exports = app;