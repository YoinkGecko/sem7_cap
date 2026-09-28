import express from "express";
import {
  cancelExecutionOrder,
  executeApprovedForRun,
  isExecutionSandboxed,
  syncExecutionRecordStatus,
} from "../services/execution/index.js";
import { getAutomationRun } from "../services/execution/automationRunStore.js";

const router = express.Router();

// POST /api/execution/runs/:automationRunId/execute — sandboxed broker gateway only
router.post("/runs/:automationRunId/execute", async (req, res) => {
  try {
    const run = getAutomationRun(req.params.automationRunId);
    if (!run) {
      return res.status(404).json({ error: "Automation run not found." });
    }

    const sandbox =
      typeof req.body?.sandbox === "boolean" ? req.body.sandbox : isExecutionSandboxed();

    const payload = await executeApprovedForRun(req.params.automationRunId, {
      sandbox,
      dailyUsage: req.body?.dailyUsage,
    });

    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Execution failed.",
    });
  }
});

// POST /api/execution/runs/:automationRunId/orders/:recordId/cancel
router.post("/runs/:automationRunId/orders/:recordId/cancel", async (req, res) => {
  try {
    const payload = await cancelExecutionOrder(
      req.params.automationRunId,
      req.params.recordId
    );
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Cancel failed.",
    });
  }
});

// POST /api/execution/runs/:automationRunId/orders/:recordId/sync
router.post("/runs/:automationRunId/orders/:recordId/sync", async (req, res) => {
  try {
    const record = await syncExecutionRecordStatus(
      req.params.automationRunId,
      req.params.recordId
    );
    res.json({ record });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Sync failed.",
    });
  }
});

// GET /api/execution/config
router.get("/config", (req, res) => {
  res.json({
    sandboxDefault: isExecutionSandboxed(),
    note: "Only the Execution Engine calls the broker. Set EXECUTION_LIVE=true for paper submits.",
  });
});

export default router;
