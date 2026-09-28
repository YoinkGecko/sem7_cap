import { evaluateTradeProposal, resolvePolicyForAutomationRun } from "../capbac/index.js";
import { getAutomationRun, updateAutomationRun } from "./automationRunStore.js";
import {
  appendExecutionRecord,
  listExecutionRecords,
  patchExecutionRecord,
  getExecutionRecord,
} from "./executionJournal.js";
import {
  cancelBrokerOrder,
  executeMarketOrder,
  fetchBrokerOrder,
} from "./brokerGateway.js";
import { flushAutomationPersistence } from "./automationPersistence.js";

const DEFER = { deferPersist: true };

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
  const run = await getAutomationRun(automationRunId);
  if (!run) {
    const error = new Error(`Automation run not found: ${automationRunId}`);
    error.status = 404;
    throw error;
  }

  const sandbox = isExecutionSandboxed(options);

  try {
    return await executeApprovedForRunInner(run, automationRunId, options, sandbox);
  } catch (error) {
    await updateAutomationRun(automationRunId, {
      status: "failed",
      sandbox,
    }).catch(() => {});
    throw error;
  }
}

async function executeApprovedForRunInner(run, automationRunId, options, sandbox) {
  const policy = resolvePolicyForAutomationRun(run);
  const capbacResults = Array.isArray(run.capbac?.results) ? run.capbac.results : [];
  const approved = capbacResults.filter((r) => r.decision === "APPROVED");

  if (!approved.length) {
    return {
      engine: "execution",
      automationRunId,
      sandbox,
      executedAt: new Date().toISOString(),
      results: [],
      summary: { submitted: 0, skipped: 0, failed: 0 },
      message: "No CapBAC-approved proposals to execute.",
    };
  }

  await updateAutomationRun(automationRunId, { status: "executing" }, DEFER);

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
      const record = await appendExecutionRecord(automationRunId, {
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
      }, DEFER);
      outcomes.push({ proposalId: row.proposalId, decision: "SKIPPED", record });
      continue;
    }

    try {
      const clientOrderId = buildClientOrderId(automationRunId, row.symbol, i);
      const fill = await executeMarketOrder({
        sandbox,
        symbol: row.symbol,
        side: row.side,
        notionalUsd: row.notionalUsd,
        clientOrderId,
      });

      submitted += 1;

      const record = await appendExecutionRecord(automationRunId, {
        recordId: `rec-${Date.now()}-${i}`,
        automationRunId,
        timestamp: new Date().toISOString(),
        action: "place",
        status: fill.status,
        proposalId: row.proposalId,
        symbol: row.symbol,
        side: row.side,
        qty: fill.qty,
        notionalUsd: row.notionalUsd,
        estimatedPrice: fill.price,
        clientOrderId: fill.clientOrderId,
        brokerOrderId: fill.brokerOrderId,
        sandbox,
        mock: fill.mock,
      }, DEFER);

      outcomes.push({ proposalId: row.proposalId, decision: "SUBMITTED", record });
    } catch (error) {
      failed += 1;
      const record = await appendExecutionRecord(automationRunId, {
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
      }, DEFER);
      outcomes.push({ proposalId: row.proposalId, decision: "FAILED", record, error: error.message });
    }
  }

  const summary = { submitted, skipped, failed };
  const executedAt = new Date().toISOString();

  await updateAutomationRun(
    automationRunId,
    {
      status: failed && !submitted ? "failed" : "completed",
      executionSummary: summary,
      executedAt,
      sandbox,
    },
    DEFER
  );

  await flushAutomationPersistence();

  return {
    engine: "execution",
    automationRunId,
    sandbox,
    executedAt,
    results: outcomes,
    summary,
  };
}

export async function cancelExecutionOrder(automationRunId, recordId) {
  const record = await getExecutionRecord(automationRunId, recordId);
  if (!record) {
    const error = new Error("Execution record not found.");
    error.status = 404;
    throw error;
  }

  if (record.action === "cancel" && record.status === "canceled") {
    return { record, alreadyCanceled: true };
  }

  if (
    record.sandbox &&
    (record.status === "dry_run" || record.status === "simulated" || record.mock)
  ) {
    const updated = await patchExecutionRecord(automationRunId, recordId, {
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
  const updated = await patchExecutionRecord(automationRunId, recordId, {
    action: "cancel",
    status: mapBrokerStatus(canceled) || "canceled",
    canceledAt: new Date().toISOString(),
    broker: canceled,
  });

  return { record: updated, sandbox: false };
}

export async function syncExecutionRecordStatus(automationRunId, recordId) {
  const record = await getExecutionRecord(automationRunId, recordId);
  if (!record?.brokerOrderId) {
    const error = new Error("Record has no broker order to sync.");
    error.status = 400;
    throw error;
  }

  const brokerOrder = await fetchBrokerOrder(record.brokerOrderId);
  const updated = await patchExecutionRecord(automationRunId, recordId, {
    status: mapBrokerStatus(brokerOrder),
    broker: brokerOrder,
  });

  return updated;
}

export { listExecutionRecords };
