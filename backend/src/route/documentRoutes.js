const express = require("express");
const multer = require("multer");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const docs = require("../service/documentService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      const err = new Error("Sirf PDF allowed hai");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

// is file ke saare routes sirf admin ke liye
router.use(requireAuth, requireAdmin);

// POST /api/documents/upload   (form-data: file, title)


router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "file required" });
  }

  try {
    console.log("Authenticated user:", req.user);

    const result = await docs.uploadDocument(
      req.file,
      req.body.title,
      req.user.id
    );

    res.json(result);
  } catch (err) {
    console.error("ingest error:", err.message);
    res.status(502).json({ message: err.message });
  }
});



// GET /api/documents
router.get("/", async (req, res, next) => {
  try {
    res.json(await docs.listDocuments());
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id
router.get("/:id", async (req, res, next) => {
  try {
    const doc = await docs.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const removed = await docs.deleteDocument(req.params.id);
    if (!removed) return res.status(404).json({ message: "Document not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;