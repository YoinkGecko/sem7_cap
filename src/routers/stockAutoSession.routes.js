import express from "express";
import {
  getActiveStockAutoSession,
  getStockAutoSession,
  startStockAutoSession,
  stopStockAutoSession,
} from "../services/stockAutoSession/sessionEngine.js";
import { STRATEGY_TYPES } from "../services/stockAutoSession/strategyEngine.js";

const router = express.Router();

// GET /api/stock-auto/strategies
router.get("/strategies", (req, res) => {
  res.json({
    strategies: [
      {
        id: "pullback_entry",
        name: "Pullback entry / strength exit",
        description: "Buy on intraday dip (~-0.85%), sell on rebound or profit target.",
      },
      {
        id: "momentum_breakout",
        name: "Momentum breakout",
        description: "Buy when day change ≥ +1%, exit on pullback.",
      },
    ],
    defaultIntervalMs: 5000,
    allowed: STRATEGY_TYPES,
  });
});

// GET /api/stock-auto/active/:symbol
router.get("/active/:symbol", (req, res) => {
  const session = getActiveStockAutoSession(req.params.symbol);
  res.json({ session });
});

// POST /api/stock-auto/:symbol/sessions
router.post("/:symbol/sessions", (req, res) => {
  try {
    const session = startStockAutoSession({
      symbol: req.params.symbol,
      budgetUsd: req.body.budgetUsd,
      maxLossUsd: req.body.maxLossUsd,
      intervalMs: req.body.intervalMs ?? 5000,
      strategyType: req.body.strategyType,
      usePaperBroker: req.body.usePaperBroker !== false,
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
    const session = await stopStockAutoSession(
      req.params.sessionId,
      req.body?.reason || "Stopped by user"
    );
    res.json({ session });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

export default router;
