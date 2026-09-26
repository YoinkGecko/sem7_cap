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

export default router;