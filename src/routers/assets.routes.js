import express from "express";
import {
  getActiveUsEquities,
  getAssetBySymbol,
  searchActiveUsEquities,
} from "../services/assetCatalog.js";

const router = express.Router();

// GET /api/assets/search?q=msft
router.get("/search", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const assets = await searchActiveUsEquities(req.query.q, limit);
    res.json({ assets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assets
router.get("/", async (req, res) => {
  try {
    let assets = await getActiveUsEquities();
    const q = String(req.query.q || req.query.search || "")
      .trim()
      .toLowerCase();
    if (q) {
      assets = assets.filter((a) => {
        const sym = a.symbol.toLowerCase();
        const name = (a.name || "").toLowerCase();
        return sym.includes(q) || name.includes(q);
      });
      assets = assets.slice(0, Math.min(Number(req.query.limit) || 100, 200));
    }
    res.json({ assets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assets/:symbol
router.get("/:symbol", async (req, res) => {
  try {
    const asset = await getAssetBySymbol(req.params.symbol);
    if (!asset) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }
    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
