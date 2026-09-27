import express from "express";
import { getStockAnalysis } from "../services/analysis/index.js";

const router = express.Router();

// GET /api/analysis/AAPL?period=1Y
router.get("/:symbol", async (req, res) => {
  try {
    const payload = await getStockAnalysis(req.params.symbol, req.query.period);
    res.json(payload);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || "Unable to generate stock analysis.",
    });
  }
});

export default router;
