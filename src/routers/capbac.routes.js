import express from "express";
import {
  evaluateTradeProposal,
  evaluateTradeProposals,
  evaluateTradingPlan,
  getPolicyById,
  listPolicies,
  resolvePolicy,
  saveCapabilityPolicy,
} from "../services/capbac/index.js";

const router = express.Router();

// POST /api/capbac/policies — store capability policy for a strategy
router.post("/policies", (req, res) => {
  try {
    const policy = saveCapabilityPolicy(req.body);
    res.status(201).json({ policy });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Unable to save capability policy.",
    });
  }
});

// GET /api/capbac/policies/:id
router.get("/policies/:id", (req, res) => {
  const policy = getPolicyById(req.params.id);
  if (!policy) {
    return res.status(404).json({ error: "Policy not found." });
  }
  res.json({ policy });
});

// GET /api/capbac/policies
router.get("/policies", (req, res) => {
  res.json({ policies: listPolicies() });
});

// POST /api/capbac/evaluate — evaluate explicit proposals
router.post("/evaluate", (req, res) => {
  try {
    const policy = resolvePolicy(req.body);
    const proposals = req.body?.proposals;
    if (!Array.isArray(proposals) || !proposals.length) {
      return res.status(400).json({ error: "proposals array is required." });
    }
    const payload = evaluateTradeProposals(proposals, policy, req.body?.dailyUsage);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "CapBAC evaluation failed.",
    });
  }
});

// POST /api/capbac/evaluate-one
router.post("/evaluate-one", (req, res) => {
  try {
    const policy = resolvePolicy(req.body);
    if (!req.body?.proposal) {
      return res.status(400).json({ error: "proposal object is required." });
    }
    const payload = evaluateTradeProposal(req.body.proposal, policy, req.body?.dailyUsage);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "CapBAC evaluation failed.",
    });
  }
});

// POST /api/capbac/evaluate-plan — gate planner candidate trades
router.post("/evaluate-plan", (req, res) => {
  try {
    const policy = resolvePolicy(req.body);
    const plan = req.body?.plan;
    if (!plan || !Array.isArray(plan.candidateTrades)) {
      return res.status(400).json({ error: "plan with candidateTrades is required." });
    }
    const payload = evaluateTradingPlan(plan, policy, req.body?.dailyUsage);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "CapBAC plan evaluation failed.",
    });
  }
});

export default router;
