import express from "express";
import {
  createAutomationRun,
  getAutomationRun,
  getAutomationRunDetail,
  listAutomationHistorySummaries,
  listAutomationRuns,
} from "../services/execution/automationRunStore.js";
import { listExecutionRecords } from "../services/execution/executionJournal.js";

const router = express.Router();

// GET /api/automation/history — summaries for UI history panel
router.get("/history", async (req, res) => {
  try {
    const history = await listAutomationHistorySummaries();
    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load history." });
  }
});

// POST /api/automation/runs — register pipeline output for execution tracking
router.post("/runs", async (req, res) => {
  try {
    const { plan, capbac, policyId, plannerSource, strategyName, capabilityPolicy } = req.body || {};
    if (!plan || !capbac || !policyId) {
      return res.status(400).json({ error: "plan, capbac, and policyId are required." });
    }

    const run = await createAutomationRun({
      plan,
      capbac,
      policyId,
      capabilityPolicy,
      plannerSource,
      strategyName,
    });
    res.status(201).json({ run });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Unable to create automation run.",
    });
  }
});

// GET /api/automation/runs
router.get("/runs", async (req, res) => {
  try {
    const runs = await listAutomationRuns();
    res.json({ runs });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to list runs." });
  }
});

// GET /api/automation/runs/:automationRunId/detail
router.get("/runs/:automationRunId/detail", async (req, res) => {
  try {
    const detail = await getAutomationRunDetail(req.params.automationRunId);
    if (!detail) {
      return res.status(404).json({ error: "Automation run not found." });
    }
    res.json(detail);
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load run detail." });
  }
});

// GET /api/automation/runs/:automationRunId
router.get("/runs/:automationRunId", async (req, res) => {
  try {
    const run = await getAutomationRun(req.params.automationRunId);
    if (!run) {
      return res.status(404).json({ error: "Automation run not found." });
    }
    res.json({ run });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load run." });
  }
});

// GET /api/automation/runs/:automationRunId/orders — placed / canceled ledger
router.get("/runs/:automationRunId/orders", async (req, res) => {
  try {
    const run = await getAutomationRun(req.params.automationRunId);
    if (!run) {
      return res.status(404).json({ error: "Automation run not found." });
    }

    const orders = await listExecutionRecords(req.params.automationRunId);
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
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load orders." });
  }
});

export default router;
