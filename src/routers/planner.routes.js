import express from "express";
import { createTradingPlan } from "../services/planner/plannerAgent.js";

const router = express.Router();

// POST /api/planner/plan
router.post("/plan", async (req, res) => {
  try {
    const payload = await createTradingPlan(req.body);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Unable to create trading plan.",
    });
  }
});

export default router;
