import express from "express";
import { runCommand } from "../config/command.js";

const router = express.Router();

// GET /api/account
router.get("/", async (req, res) => {
  try {
    const result = await runCommand([
      "account",
      "get"
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/account/activity
router.get("/activity", async (req, res) => {
  try {
    const result = await runCommand([
      "account",
      "activity",
      "list"
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/account/portfolio
router.get("/portfolio", async (req, res) => {
  try {
    const result = await runCommand([
      "account",
      "portfolio"
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/account/positions
router.get("/positions", async (req, res) => {
  try {
    const result = await runCommand(["position", "list"]);
    const parsed = JSON.parse(result);
    const list = Array.isArray(parsed) ? parsed : parsed?.positions || [];
    res.json({ positions: list.map(normalizePosition) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function normalizePosition(raw) {
  return {
    symbol: String(raw.symbol || "").toUpperCase(),
    qty: num(raw.qty),
    side: raw.side || "long",
    avg_entry_price: num(raw.avg_entry_price ?? raw.avgEntryPrice),
    current_price: num(raw.current_price ?? raw.currentPrice),
    market_value: num(raw.market_value ?? raw.marketValue),
    cost_basis: num(raw.cost_basis ?? raw.costBasis),
    unrealized_pl: num(raw.unrealized_pl ?? raw.unrealizedPl),
    unrealized_plpc: num(raw.unrealized_plpc ?? raw.unrealizedPlpc),
    change_today: num(raw.change_today ?? raw.changeToday),
    unrealized_intraday_pl: num(raw.unrealized_intraday_pl ?? raw.unrealizedIntradayPl),
  };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default router;