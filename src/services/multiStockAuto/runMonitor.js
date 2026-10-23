import { evaluateProfitLossExit } from "../stockAutoSession/strategyEngine.js";
import {
  exitRunningSession,
  getStockAutoSession,
  refreshSessionMarketState,
} from "../stockAutoSession/sessionEngine.js";
import {
  getRun,
  listRuns,
  persistRunsToDisk,
  startRunMonitorLoop,
  stopRunMonitorLoop,
  updateRun,
} from "./runStore.js";
import { summarizeRun } from "./runEngine.js";

function aggregateRunPnL(run) {
  let total = 0;
  let hasPosition = false;

  for (const leg of run.legs) {
    if (!leg.sessionId) continue;
    const session = leg.sessionSnapshot || getStockAutoSession(leg.sessionId);
    if (!session) continue;
    leg.sessionSnapshot = session;
    leg.liveStatus = session.status;
    if (session.status === "RUNNING") {
      if (session.runningPnL != null) total += session.runningPnL;
      const qty = session.sessionEntryQty ?? session.positionQty ?? 0;
      if (qty > 0) hasPosition = true;
    } else if (session.finalPnL != null) {
      total += session.finalPnL;
    } else if (session.runningPnL != null) {
      total += session.runningPnL;
    }
  }

  return { aggregatePnL: total, hasPosition };
}

async function executeCombinedExit(run, exit) {
  stopRunMonitorLoop(run.runId);

  const reason =
    exit.reason ||
    (exit.exitType === "profit"
      ? `Combined profit target on basket`
      : `Combined loss limit on basket`);

  for (const leg of run.legs) {
    if (!leg.sessionId) continue;
    const session = getStockAutoSession(leg.sessionId);
    if (!session || session.status !== "RUNNING") continue;
    const closed = await exitRunningSession(leg.sessionId, {
      reason,
      exitType: exit.exitType,
    });
    leg.sessionSnapshot = closed;
    leg.liveStatus = closed?.status;
  }

  run.status = exit.exitType === "profit" ? "PROFIT_TARGET_REACHED" : "LOSS_LIMIT_REACHED";
  run.completedAt = new Date().toISOString();
  run.stopReason = reason;
  run.lastCombinedEvaluation = {
    ...exit,
    aggregatePnL: run.summary?.aggregatePnLUsd,
    evaluatedAt: new Date().toISOString(),
  };
  summarizeRun(run);
  updateRun(run.runId, run);
}

export async function processMultiRunTick(runId) {
  const run = getRun(runId);
  if (!run || run.status !== "RUNNING") {
    stopRunMonitorLoop(runId);
    return;
  }

  try {
    for (const leg of run.legs) {
      if (!leg.sessionId) continue;
      const session = getStockAutoSession(leg.sessionId);
      if (session?.status === "RUNNING") {
        leg.sessionSnapshot = await refreshSessionMarketState(leg.sessionId);
        leg.liveStatus = leg.sessionSnapshot?.status;
      } else if (session) {
        leg.sessionSnapshot = session;
        leg.liveStatus = session.status;
      }
    }

    const { aggregatePnL, hasPosition } = aggregateRunPnL(run);
    const { maxLossUsd, profitMinUsd } = run.config;

    const exit = evaluateProfitLossExit({
      sessionPnL: aggregatePnL,
      maxLossUsd,
      profitMinUsd,
      hasPosition,
    });

    run.lastCombinedEvaluation = exit
      ? { ...exit, aggregatePnL, evaluatedAt: new Date().toISOString() }
      : {
          action: null,
          reason: `Combined basket P/L ${aggregatePnL.toFixed(2)} (target +$${profitMinUsd}, stop −$${maxLossUsd})`,
          aggregatePnL,
          evaluatedAt: new Date().toISOString(),
        };

    for (const leg of run.legs) {
      if (!leg.sessionId || leg.sessionSnapshot?.status !== "RUNNING") continue;
      const s = leg.sessionSnapshot;
      if (s) {
        s.lastEvaluation = {
          action: null,
          reason: `Basket P/L ${aggregatePnL.toFixed(2)} · leg ${(s.runningPnL ?? 0).toFixed(2)}`,
          evaluatedAt: run.lastCombinedEvaluation.evaluatedAt,
        };
      }
    }

    summarizeRun(run);

    if (exit?.action === "sell") {
      run.summary.aggregatePnLUsd = aggregatePnL;
      await executeCombinedExit(run, exit);
      return;
    }

    updateRun(run.runId, run);
    persistRunsToDisk();
  } catch (e) {
    run.lastError = e.message;
    updateRun(run.runId, run);
  }
}

export function startMultiRunMonitoring(runId) {
  const run = getRun(runId);
  if (!run || run.status !== "RUNNING") return;
  startRunMonitorLoop(runId, processMultiRunTick);
}

export function stopMultiRunMonitoring(runId) {
  stopRunMonitorLoop(runId);
}

function resumeRunningMonitors() {
  for (const run of listRuns(100)) {
    if (run.status === "RUNNING") {
      startMultiRunMonitoring(run.runId);
    }
  }
}

resumeRunningMonitors();
