import express from "express";
import { runCommand } from "../config/command.js";
import { fetchStockNews } from "../services/stockNews.js";
import { normalizeMarketClockPayload } from "../utils/marketClock.js";

const router = express.Router();


// ==================== STOCK DATA ====================

// GET /api/market/bars/AAPL
router.get("/bars/:symbol", async (req, res) => {
  try {
    const args = [
      "data",
      "bars",
      "--symbol",
      req.params.symbol
    ];

    if (req.query.start) {
      args.push("--start", req.query.start);
    }

    if (req.query.timeframe) {
      args.push(
        "--timeframe",
        req.query.timeframe
      );
    }

    const result = await runCommand(args);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/market/quotes/AAPL
router.get("/quotes/:symbol", async (req, res) => {
  try {
    const args = [
      "data",
      "quotes",
      "--symbol",
      req.params.symbol
    ];

    if (req.query.start) {
      args.push("--start", req.query.start);
    }

    const result = await runCommand(args);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/market/trades/AAPL
router.get("/trades/:symbol", async (req, res) => {
  try {
    const args = [
      "data",
      "trades",
      "--symbol",
      req.params.symbol
    ];

    if (req.query.start) {
      args.push("--start", req.query.start);
    }

    const result = await runCommand(args);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/market/latest-bar/AAPL
router.get(
  "/latest-bar/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "latest-bar",
        "--symbol",
        req.params.symbol
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// GET /api/market/latest-quote/AAPL
router.get(
  "/latest-quote/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "latest-quote",
        "--symbol",
        req.params.symbol
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// GET /api/market/latest-trade/AAPL
router.get(
  "/latest-trade/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "latest-trade",
        "--symbol",
        req.params.symbol
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// GET /api/market/snapshot/AAPL
router.get(
  "/snapshot/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "snapshot",
        "--symbol",
        req.params.symbol
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// ==================== SCREENER ====================

// GET /api/market/screener/most-actives
router.get(
  "/screener/most-actives",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "screener",
        "most-actives"
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// GET /api/market/screener/movers
router.get(
  "/screener/movers",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "screener",
        "movers"
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// ==================== OPTIONS ====================

// GET /api/market/options/chain/AAPL
router.get(
  "/options/chain/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "option",
        "chain",
        "--underlying-symbol",
        req.params.symbol
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// GET /api/market/options/snapshot/:symbol
router.get(
  "/options/snapshot/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "option",
        "snapshot",
        "--symbol",
        req.params.symbol
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// GET /api/market/options/latest-quotes/:symbol
router.get(
  "/options/latest-quotes/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "option",
        "latest-quotes",
        "--symbol",
        req.params.symbol
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// ==================== OTHER ====================

// GET /api/market/news/AAPL
router.get("/news/:symbol", async (req, res) => {
  try {
    const payload = await fetchStockNews(req.params.symbol);
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      error: error.message,
      hint:
        "Reduce Gemini usage (NEWS_PROVIDER=alpaca) or wait for quota reset. See .env.example.",
    });
  }
});


// GET /api/market/corporate-actions/AAPL
router.get(
  "/corporate-actions/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "data",
        "corporate-actions",
        "--symbols",
        req.params.symbol,
        "--types",
        req.query.types || "dividend"
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// GET /api/market/forex
router.get("/forex", async (req, res) => {
  try {
    const result = await runCommand([
      "data",
      "forex",
      "rates",
      "--currency-pairs",
      req.query.pair || "USD/EUR"
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// GET /api/market/clock
router.get("/clock", async (req, res) => {
  try {
    const result = await runCommand([
      "clock"
    ]);

    res.json(normalizeMarketClockPayload(JSON.parse(result)));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// GET /api/market/calendar
router.get("/calendar", async (req, res) => {
  try {
    const result = await runCommand([
      "calendar"
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


export default router;