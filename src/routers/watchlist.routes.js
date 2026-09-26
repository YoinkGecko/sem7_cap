import express from "express";
import { runCommand } from "../config/command.js";

const router = express.Router();


// GET /api/watchlists
router.get("/", async (req, res) => {
  try {
    const result = await runCommand([
      "watchlist",
      "list"
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// POST /api/watchlists
router.post("/", async (req, res) => {
  try {
    const { name, symbols } = req.body;

    const args = [
      "watchlist",
      "create",
      "--name",
      name
    ];

    if (symbols?.length) {
      args.push(
        "--symbols",
        symbols.join(",")
      );
    }

    const result = await runCommand(args);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// GET /api/watchlists/:id
router.get("/:id", async (req, res) => {
  try {
    const result = await runCommand([
      "watchlist",
      "get",
      "--watchlist-id",
      req.params.id
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// POST /api/watchlists/:id/:symbol
router.post(
  "/:id/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "watchlist",
        "add",
        "--watchlist-id",
        req.params.id,
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


// DELETE /api/watchlists/:id/:symbol
router.delete(
  "/:id/:symbol",
  async (req, res) => {
    try {
      const result = await runCommand([
        "watchlist",
        "remove",
        "--watchlist-id",
        req.params.id,
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


// DELETE /api/watchlists/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await runCommand([
      "watchlist",
      "delete",
      "--watchlist-id",
      req.params.id
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


export default router;