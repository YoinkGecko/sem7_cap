import express from "express";
import {
  getActiveStockAutoSession,
  getStockAutoHistory,
  getStockAutoSession,
  listActiveStockAutoSessions,
  startStockAutoSession,
  stopStockAutoSession,
} from "../services/stockAutoSession/sessionEngine.js";
import { buildAutoTradeAdvice } from "../services/stockAutoSession/autoTradeAdvisor.js";

const router = express.Router();

// GET /api/stock-auto/history/:symbol
router.get("/history/:symbol", (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const data = getStockAutoHistory(req.params.symbol);
    data.sessions = data.sessions.slice(0, limit);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stock-auto/active — all running sessions (must be before /active/:symbol)
router.get("/active", (req, res) => {
  try {
    const sessions = listActiveStockAutoSessions();
    res.json({ sessions, count: sessions.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stock-auto/active/:symbol
router.get("/active/:symbol", (req, res) => {
  const session = getActiveStockAutoSession(req.params.symbol);
  res.json({ session });
});

// POST /api/stock-auto/:symbol/advise
router.post("/:symbol/advise", async (req, res) => {
  try {
    const advice = await buildAutoTradeAdvice({
      symbol: req.params.symbol,
      budgetUsd: req.body.budgetUsd,
      maxLossUsd: req.body.maxLossUsd,
      profitMinUsd: req.body.profitMinUsd,
    });
    res.json({ advice });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// POST /api/stock-auto/:symbol/sessions
router.post("/:symbol/sessions", async (req, res) => {
  try {
    const session = await startStockAutoSession({
      symbol: req.params.symbol,
      budgetUsd: req.body.budgetUsd,
      maxLossUsd: req.body.maxLossUsd,
      profitMinUsd: req.body.profitMinUsd,
      intervalMs: req.body.intervalMs ?? 5000,
      usePaperBroker: req.body.usePaperBroker !== false,
      entryQty: req.body.entryQty,
      agentAdvice: req.body.agentAdvice,
    });
    res.status(201).json({ session });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// GET /api/stock-auto/sessions/:sessionId
router.get("/sessions/:sessionId", (req, res) => {
  const session = getStockAutoSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found." });
    return;
  }
  res.json({ session });
});

// POST /api/stock-auto/sessions/:sessionId/stop
router.post("/sessions/:sessionId/stop", async (req, res) => {
  try {
    const session = await stopStockAutoSession(req.params.sessionId, {
      sellPosition: req.body?.sellPosition === true,
      reason: req.body?.reason,
    });
    res.json({ session });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
