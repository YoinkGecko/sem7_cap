import express from "express";
import { processContentBatch, processExternalContent } from "../services/intentEngine/intentEngine.js";
import { ingestAndSanitizeNews } from "../services/intentEngine/ingestNews.js";

const router = express.Router();

function validateItems(body) {
  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items || !items.length) {
    const error = new Error("Request body must include a non-empty items array.");
    error.status = 400;
    throw error;
  }
  if (items.length > 50) {
    const error = new Error("Maximum 50 items per request.");
    error.status = 400;
    throw error;
  }
  return items;
}

// POST /api/intent/process — sanitize arbitrary external documents
router.post("/process", (req, res) => {
  try {
    const items = validateItems(req.body);
    res.json(processContentBatch(items));
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Intent processing failed.",
    });
  }
});

// POST /api/intent/process-one
router.post("/process-one", (req, res) => {
  try {
    const { title, body, text, ...rest } = req.body || {};
    if (!title && !body && !text) {
      return res.status(400).json({ error: "Provide title and/or body (or text)." });
    }
    res.json(processExternalContent({ title, body, text, ...rest }));
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Intent processing failed.",
    });
  }
});

// POST /api/intent/ingest-news — fetch news for symbols, then sanitize (post-planner pipeline)
router.post("/ingest-news", async (req, res) => {
  try {
    const symbols = Array.isArray(req.body?.symbols) ? req.body.symbols : [];
    if (!symbols.length) {
      return res.status(400).json({ error: "symbols array is required." });
    }
    if (symbols.length > 20) {
      return res.status(400).json({ error: "Maximum 20 symbols." });
    }
    const payload = await ingestAndSanitizeNews(symbols, {
      limitPerSymbol: req.body?.limitPerSymbol,
    });
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "News ingest and intent scan failed.",
    });
  }
});

export default router;
