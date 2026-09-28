import {
  normalizeDailyUsage,
  normalizeTradeProposal,
  validateCapabilityPolicy,
} from "./validatePolicy.js";
import { createPolicyRecord, getPolicyById } from "./policyStore.js";

const DENIED = "DENIED";
const APPROVED = "APPROVED";

function checkProposalAgainstPolicy(proposal, policy, usage) {
  const violations = [];

  if (!policy.allowedStocks.includes(proposal.symbol)) {
    violations.push({
      code: "SYMBOL_NOT_ALLOWED",
      message: `${proposal.symbol} is not in the allowed stocks list.`,
    });
  }

  if (proposal.notionalUsd > policy.maxOrderValueUsd) {
    violations.push({
      code: "MAX_ORDER_VALUE",
      message: `Order notional $${proposal.notionalUsd} exceeds max order value $${policy.maxOrderValueUsd}.`,
    });
  }

  if (proposal.notionalUsd > policy.maxPositionSizeUsd) {
    violations.push({
      code: "MAX_POSITION_SIZE",
      message: `Proposed size $${proposal.notionalUsd} exceeds max position size $${policy.maxPositionSizeUsd}.`,
    });
  }

  if (proposal.side === "sell" && !policy.allowShortSelling) {
    violations.push({
      code: "SHORT_SELLING_DISABLED",
      message: "Short selling is not permitted by this capability policy.",
    });
  }

  if (usage.tradeCount + 1 > policy.dailyTradeLimit) {
    violations.push({
      code: "DAILY_TRADE_LIMIT",
      message: `Daily trade limit of ${policy.dailyTradeLimit} would be exceeded (current: ${usage.tradeCount}).`,
    });
  }

  const projectedSpend =
    proposal.side === "buy" ? usage.spendingUsd + proposal.notionalUsd : usage.spendingUsd;

  if (proposal.side === "buy" && projectedSpend > policy.dailySpendingLimitUsd) {
    violations.push({
      code: "DAILY_SPENDING_LIMIT",
      message: `Daily spending limit $${policy.dailySpendingLimitUsd} would be exceeded (projected: $${projectedSpend}).`,
    });
  }

  const decision = violations.length ? DENIED : APPROVED;

  return {
    proposalId: proposal.proposalId,
    symbol: proposal.symbol,
    side: proposal.side,
    notionalUsd: proposal.notionalUsd,
    decision,
    violations,
    reason: violations.length
      ? violations.map((v) => v.message).join(" ")
      : "All capability checks passed.",
  };
}

export function evaluateTradeProposal(proposal, policy, dailyUsage = {}) {
  const normalizedProposal = normalizeTradeProposal(proposal);
  const usage = normalizeDailyUsage(dailyUsage);
  return {
    engine: "capbac",
    evaluatedAt: new Date().toISOString(),
    policyId: policy.policyId,
    result: checkProposalAgainstPolicy(normalizedProposal, policy, usage),
  };
}

export function evaluateTradeProposals(proposals, policy, dailyUsage = {}, options = {}) {
  const simulateSequential = options.simulateSequential !== false;
  const usage = normalizeDailyUsage(dailyUsage);
  const list = Array.isArray(proposals) ? proposals : [];

  const results = [];
  let rollingUsage = { ...usage };

  for (let i = 0; i < list.length; i++) {
    const proposal = normalizeTradeProposal(list[i], i);
    const result = checkProposalAgainstPolicy(proposal, policy, rollingUsage);
    results.push(result);

    if (simulateSequential && result.decision === APPROVED) {
      rollingUsage = {
        tradeCount: rollingUsage.tradeCount + 1,
        spendingUsd:
          proposal.side === "buy"
            ? rollingUsage.spendingUsd + proposal.notionalUsd
            : rollingUsage.spendingUsd,
      };
    }
  }

  const approved = results.filter((r) => r.decision === APPROVED).length;
  const denied = results.filter((r) => r.decision === DENIED).length;

  return {
    engine: "capbac",
    evaluatedAt: new Date().toISOString(),
    policyId: policy.policyId,
    dailyUsageStart: usage,
    dailyUsageEnd: rollingUsage,
    results,
    summary: {
      total: results.length,
      approved,
      denied,
    },
  };
}

export function proposalsFromTradingPlan(plan) {
  const trades = Array.isArray(plan?.candidateTrades) ? plan.candidateTrades : [];
  return trades.map((t, index) => ({
    proposalId: `plan-${plan?.planId || "unknown"}-${t.symbol}-${index}`,
    symbol: t.symbol,
    side: t.side,
    notionalUsd: t.suggestedNotionalUsd,
    source: "planner",
    status: t.status,
  }));
}

export function evaluateTradingPlan(plan, policy, dailyUsage = {}) {
  const proposals = proposalsFromTradingPlan(plan);
  return evaluateTradeProposals(proposals, policy, dailyUsage, { simulateSequential: true });
}

export function saveCapabilityPolicy(rawInput) {
  const policy = validateCapabilityPolicy(rawInput);
  return createPolicyRecord(policy);
}

export function loadPolicyOrThrow(policyId) {
  const policy = getPolicyById(policyId);
  if (!policy) {
    const error = new Error(`Capability policy not found: ${policyId}`);
    error.status = 404;
    throw error;
  }
  return policy;
}

/** Use embedded policy on automation runs when in-memory store was cleared (e.g. server restart). */
export function resolvePolicyForAutomationRun(run) {
  if (!run?.policyId && !run?.capabilityPolicy) {
    const error = new Error("Automation run has no capability policy reference.");
    error.status = 400;
    throw error;
  }

  const fromStore = run.policyId ? getPolicyById(run.policyId) : null;
  if (fromStore) return fromStore;

  if (run.capabilityPolicy) {
    const policy = validateCapabilityPolicy({
      ...run.capabilityPolicy,
      policyId: run.policyId || run.capabilityPolicy.policyId,
    });
    createPolicyRecord(policy);
    return policy;
  }

  return loadPolicyOrThrow(run.policyId);
}

export function resolvePolicy({ policyId, policy }) {
  if (policyId) {
    return loadPolicyOrThrow(policyId);
  }
  if (policy) {
    return validateCapabilityPolicy(policy);
  }
  const error = new Error("Provide policyId or policy object.");
  error.status = 400;
  throw error;
}
