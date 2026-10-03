import express from "express";
import {
  getMultiStockAutoRun,
  getMultiStockAutoRunHistory,
  previewMultiStockAutoRun,
  startMultiStockAutoRun,
} from "../services/multiStockAuto/runEngine.js";

const router = express.Router();

// GET /api/multi-stock-auto/runs
router.get("/runs", (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const runs = getMultiStockAutoRunHistory(limit);
    res.json({ runs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/multi-stock-auto/runs/:runId
router.get("/runs/:runId", (req, res) => {
  const run = getMultiStockAutoRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "Run not found." });
    return;
  }
  res.json({ run });
});

// POST /api/multi-stock-auto/runs/preview
router.post("/runs/preview", async (req, res) => {
  try {
    const preview = await previewMultiStockAutoRun(req.body);
    res.json({ preview });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// POST /api/multi-stock-auto/runs
router.post("/runs", async (req, res) => {
  try {
    const run = await startMultiStockAutoRun(req.body);
    res.status(201).json({ run });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
