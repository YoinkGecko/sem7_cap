import express from "express";
import {
  createAutomationRun,
  getAutomationRun,
  listAutomationRuns,
} from "../services/execution/automationRunStore.js";
import { listExecutionRecords } from "../services/execution/executionJournal.js";

const router = express.Router();

// POST /api/automation/runs — register pipeline output for execution tracking
router.post("/runs", (req, res) => {
  try {
    const { plan, capbac, policyId } = req.body || {};
    if (!plan || !capbac || !policyId) {
      return res.status(400).json({ error: "plan, capbac, and policyId are required." });
    }

    const run = createAutomationRun({ plan, capbac, policyId });
    res.status(201).json({ run });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Unable to create automation run.",
    });
  }
});

// GET /api/automation/runs
router.get("/runs", (req, res) => {
  res.json({ runs: listAutomationRuns() });
});

// GET /api/automation/runs/:automationRunId
router.get("/runs/:automationRunId", (req, res) => {
  const run = getAutomationRun(req.params.automationRunId);
  if (!run) {
    return res.status(404).json({ error: "Automation run not found." });
  }
  res.json({ run });
});

// GET /api/automation/runs/:automationRunId/orders — placed / canceled ledger
router.get("/runs/:automationRunId/orders", (req, res) => {
  const run = getAutomationRun(req.params.automationRunId);
  if (!run) {
    return res.status(404).json({ error: "Automation run not found." });
  }

  const orders = listExecutionRecords(req.params.automationRunId);
  res.json({
    automationRunId: req.params.automationRunId,
    orders,
    summary: {
      total: orders.length,
      placed: orders.filter((o) => o.action === "place").length,
      canceled: orders.filter((o) => o.status === "canceled" || o.action === "cancel").length,
      failed: orders.filter((o) => o.status === "failed").length,
    },
  });
});

export default router;
