import express from "express";
import { runCommand } from "../config/command.js";

const router = express.Router();


// GET /api/assets
router.get("/", async (req, res) => {
  try {
    const result = await runCommand([
      "asset",
      "list"
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// GET /api/assets/:symbol
router.get("/:symbol", async (req, res) => {
  try {
    const result = await runCommand([
      "asset",
      "get",
      "--symbol",
      req.params.symbol
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


export default router;