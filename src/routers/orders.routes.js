import express from "express";
import { runCommand } from "../config/command.js";

const router = express.Router();


// POST /api/orders
router.post("/", async (req, res) => {
  try {
    const {
      symbol,
      side,
      qty,
      type,
      limitPrice,
      dryRun,
      clientOrderId
    } = req.body;

    const args = [
      "order",
      "submit",
      "--symbol",
      symbol,
      "--side",
      side,
      "--qty",
      String(qty),
      "--type",
      type
    ];

    if (limitPrice !== undefined) {
      args.push("--limit-price", String(limitPrice));
    }

    if (dryRun === true) {
      args.push("--dry-run");
    }

    if (clientOrderId) {
      args.push(
        "--client-order-id",
        clientOrderId
      );
    }

    const result = await runCommand(args);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/orders
router.get("/", async (req, res) => {
  try {
    const args = [
      "order",
      "list"
    ];

    if (req.query.status) {
      args.push(
        "--status",
        req.query.status
      );
    }

    const result = await runCommand(args);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/orders/client/:clientOrderId
router.get(
  "/client/:clientOrderId",
  async (req, res) => {
    try {
      const result = await runCommand([
        "order",
        "get-by-client-id",
        "--client-order-id",
        req.params.clientOrderId
      ]);

      res.json(JSON.parse(result));
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);


// GET /api/orders/:id
router.get("/:id", async (req, res) => {
  try {
    const result = await runCommand([
      "order",
      "get",
      "--order-id",
      req.params.id
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// PATCH /api/orders/:id
router.patch("/:id", async (req, res) => {
  try {
    const { qty } = req.body;

    const result = await runCommand([
      "order",
      "replace",
      "--order-id",
      req.params.id,
      "--qty",
      String(qty)
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// DELETE /api/orders/:id
router.delete("/:id", async (req, res) => {
  try {
    const result = await runCommand([
      "order",
      "cancel",
      "--order-id",
      req.params.id
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// DELETE /api/orders
router.delete("/", async (req, res) => {
  try {
    const result = await runCommand([
      "order",
      "cancel-all"
    ]);

    res.json(JSON.parse(result));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;