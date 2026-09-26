import express from "express";
import { runCommand } from "../config/command.js";

const router = express.Router();


// GET /api/options/contracts/underlying/AAPL
router.get(
  "/contracts/underlying/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "option",
        "contracts",
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


// GET /api/options/contracts/:symbolOrId
router.get(
  "/contracts/:symbolOrId",
  async (req, res) => {
    try {
      const result = await runCommand([
        "option",
        "get",
        "--symbol-or-id",
        req.params.symbolOrId
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// POST /api/options/exercise/:symbolOrId
router.post(
  "/exercise/:symbolOrId",
  async (req, res) => {
    try {
      const result = await runCommand([
        "option",
        "exercise",
        "--symbol-or-id",
        req.params.symbolOrId
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// POST /api/options/do-not-exercise/:symbolOrId
router.post(
  "/do-not-exercise/:symbolOrId",
  async (req, res) => {
    try {
      const result = await runCommand([
        "option",
        "do-not-exercise",
        "--symbol-or-id",
        req.params.symbolOrId
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

export default router;