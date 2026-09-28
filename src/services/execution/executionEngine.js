import { evaluateTradeProposal, loadPolicyOrThrow } from "../capbac/index.js";
import { getAutomationRun, updateAutomationRun } from "./automationRunStore.js";
import {
  appendExecutionRecord,
  listExecutionRecords,
  patchExecutionRecord,
  getExecutionRecord,
} from "./executionJournal.js";
import {
  cancelBrokerOrder,
  fetchBrokerOrder,
  fetchSnapshotPrice,
  submitBrokerOrder,
} from "./brokerGateway.js";

const EXECUTION_SANDBOX =
  process.env.EXECUTION_SANDBOX !== "false" && process.env.EXECUTION_LIVE !== "true";

function buildClientOrderId(automationRunId, symbol, index) {
  const slug = automationRunId.replace(/[^a-zA-Z0-9]/g, "").slice(-10);
  return `at${slug}${symbol}${index}`.slice(0, 48);
}

function notionalToQty(notionalUsd, price) {
  const qty = Math.floor(notionalUsd / price);
  return Math.max(qty, 1);
}

function mapBrokerStatus(order) {
  return order?.status || order?.order_status || "submitted";
}

export function isExecutionSandboxed(options = {}) {
  if (typeof options.sandbox === "boolean") {
    return options.sandbox;
  }
  return EXECUTION_SANDBOX;
}

export async function executeApprovedForRun(automationRunId, options = {}) {
  const run = getAutomationRun(automationRunId);
  if (!run) {
    const error = new Error(`Automation run not found: ${automationRunId}`);
    error.status = 404;
    throw error;
  }

  const policy = loadPolicyOrThrow(run.policyId);
  const capbacResults = Array.isArray(run.capbac?.results) ? run.capbac.results : [];
  const approved = capbacResults.filter((r) => r.decision === "APPROVED");

  if (!approved.length) {
    return {
      engine: "execution",
      automationRunId,
      sandbox: isExecutionSandboxed(options),
      executedAt: new Date().toISOString(),
      results: [],
      summary: { submitted: 0, skipped: 0, failed: 0 },
      message: "No CapBAC-approved proposals to execute.",
    };
  }

  updateAutomationRun(automationRunId, { status: "executing" });

  const sandbox = isExecutionSandboxed(options);
  const outcomes = [];
  let submitted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < approved.length; i++) {
    const row = approved[i];
    const proposal = {
      proposalId: row.proposalId,
      symbol: row.symbol,
      side: row.side,
      notionalUsd: row.notionalUsd,
    };

    const capbacCheck = evaluateTradeProposal(proposal, policy, options.dailyUsage || {
      tradeCount: 0,
      spendingUsd: 0,
    });

    if (capbacCheck.result.decision !== "APPROVED") {
      skipped += 1;
      const record = appendExecutionRecord(automationRunId, {
        recordId: `rec-${Date.now()}-${i}`,
        automationRunId,
        timestamp: new Date().toISOString(),
        action: "skipped",
        status: "denied",
        proposalId: row.proposalId,
        symbol: row.symbol,
        side: row.side,
        notionalUsd: row.notionalUsd,
        reason: capbacCheck.result.reason,
        sandbox,
      });
      outcomes.push({ proposalId: row.proposalId, decision: "SKIPPED", record });
      continue;
    }

    try {
      const { price } = await fetchSnapshotPrice(row.symbol);
      const qty = notionalToQty(row.notionalUsd, price);
      const clientOrderId = buildClientOrderId(automationRunId, row.symbol, i);

      const brokerOrder = await submitBrokerOrder({
        symbol: row.symbol,
        side: row.side,
        qty,
        type: "market",
        clientOrderId,
        dryRun: sandbox,
      });

      submitted += 1;
      const brokerOrderId = brokerOrder?.id || brokerOrder?.order_id || null;
      const status = sandbox ? "dry_run" : mapBrokerStatus(brokerOrder);

      const record = appendExecutionRecord(automationRunId, {
        recordId: `rec-${Date.now()}-${i}`,
        automationRunId,
        timestamp: new Date().toISOString(),
        action: "place",
        status,
        proposalId: row.proposalId,
        symbol: row.symbol,
        side: row.side,
        qty,
        notionalUsd: row.notionalUsd,
        estimatedPrice: price,
        clientOrderId,
        brokerOrderId,
        sandbox,
        broker: brokerOrder,
      });

      outcomes.push({ proposalId: row.proposalId, decision: "SUBMITTED", record });
    } catch (error) {
      failed += 1;
      const record = appendExecutionRecord(automationRunId, {
        recordId: `rec-${Date.now()}-${i}`,
        automationRunId,
        timestamp: new Date().toISOString(),
        action: "place",
        status: "failed",
        proposalId: row.proposalId,
        symbol: row.symbol,
        side: row.side,
        notionalUsd: row.notionalUsd,
        sandbox,
        reason: error.message,
      });
      outcomes.push({ proposalId: row.proposalId, decision: "FAILED", record, error: error.message });
    }
  }

  const summary = { submitted, skipped, failed };
  updateAutomationRun(automationRunId, {
    status: failed && !submitted ? "failed" : "completed",
    executionSummary: summary,
  });

  return {
    engine: "execution",
    automationRunId,
    sandbox,
    executedAt: new Date().toISOString(),
    results: outcomes,
    summary,
  };
}

export async function cancelExecutionOrder(automationRunId, recordId) {
  const record = getExecutionRecord(automationRunId, recordId);
  if (!record) {
    const error = new Error("Execution record not found.");
    error.status = 404;
    throw error;
  }

  if (record.action === "cancel" && record.status === "canceled") {
    return { record, alreadyCanceled: true };
  }

  if (record.sandbox && record.status === "dry_run") {
    const updated = patchExecutionRecord(automationRunId, recordId, {
      action: "cancel",
      status: "canceled",
      reason: "Dry-run order marked canceled in automation journal.",
    });
    return { record: updated, sandbox: true };
  }

  if (!record.brokerOrderId) {
    const error = new Error("No broker order id on record.");
    error.status = 400;
    throw error;
  }

  const canceled = await cancelBrokerOrder(record.brokerOrderId);
  const updated = patchExecutionRecord(automationRunId, recordId, {
    action: "cancel",
    status: mapBrokerStatus(canceled) || "canceled",
    canceledAt: new Date().toISOString(),
    broker: canceled,
  });

  return { record: updated, sandbox: false };
}

export async function syncExecutionRecordStatus(automationRunId, recordId) {
  const record = getExecutionRecord(automationRunId, recordId);
  if (!record?.brokerOrderId) {
    const error = new Error("Record has no broker order to sync.");
    error.status = 400;
    throw error;
  }

  const brokerOrder = await fetchBrokerOrder(record.brokerOrderId);
  const updated = patchExecutionRecord(automationRunId, recordId, {
    status: mapBrokerStatus(brokerOrder),
    broker: brokerOrder,
  });

  return updated;
}

export { listExecutionRecords };
