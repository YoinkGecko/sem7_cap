import { buildAutoTradeAdvice } from "../stockAutoSession/autoTradeAdvisor.js";
import {
  getStockAutoSession,
  startStockAutoSession,
} from "../stockAutoSession/sessionEngine.js";
import {
  createRunRecord,
  getRun,
  listRuns,
  persistRunsToDisk,
  updateRun,
} from "./runStore.js";

const MAX_SYMBOLS = 12;

function normalizeSymbols(symbols) {
  const set = new Set();
  for (const s of symbols || []) {
    const sym = String(s || "").trim().toUpperCase();
    if (sym) set.add(sym);
  }
  return Array.from(set);
}

function splitTotalBudget(totalBudgetUsd, symbolCount) {
  const total = Number(totalBudgetUsd);
  const n = Math.max(1, symbolCount);
  const per = total / n;
  return Array.from({ length: n }, () => per);
}

function validateConfig(body, symbolCount) {
  const totalBudgetUsd = Number(body.totalBudgetUsd);
  const maxLossUsd = Number(body.maxLossUsd);
  const profitMinUsd = Number(body.profitMinUsd);
  const intervalMs = Number(body.intervalMs) || 5000;
  const entryMode = body.entryMode === "full" ? "full" : "suggested";

  if (!Number.isFinite(totalBudgetUsd) || totalBudgetUsd <= 0) {
    const err = new Error("totalBudgetUsd must be positive.");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(maxLossUsd) || maxLossUsd <= 0) {
    const err = new Error("maxLossUsd must be positive.");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(profitMinUsd) || profitMinUsd <= 0) {
    const err = new Error("profitMinUsd must be positive.");
    err.status = 400;
    throw err;
  }

  const allocations = splitTotalBudget(totalBudgetUsd, symbolCount);
  const budgetUsdPerSymbol = allocations[0];

  return {
    totalBudgetUsd,
    budgetUsdPerSymbol,
    budgetAllocations: allocations,
    symbolCount,
    maxLossUsd,
    profitMinUsd,
    intervalMs: Math.max(3000, intervalMs),
    entryMode,
    usePaperBroker: body.usePaperBroker !== false,
  };
}

async function adviseLeg(symbol, budgetUsd, config) {
  const advice = await buildAutoTradeAdvice({
    symbol,
    budgetUsd,
    maxLossUsd: config.maxLossUsd,
    profitMinUsd: config.profitMinUsd,
  });
  return advice;
}

function summarizeRun(run) {
  let startedCount = 0;
  let failedCount = 0;
  let runningCount = 0;
  let totalEntryCostUsd = 0;
  let aggregatePnLUsd = 0;

  for (const leg of run.legs) {
    if (leg.error && !leg.sessionId) failedCount += 1;
    else startedCount += 1;
    const session = leg.sessionSnapshot;
    if (session?.status === "RUNNING") runningCount += 1;
    if (session?.sessionTotalCost) totalEntryCostUsd += session.sessionTotalCost;
    if (session?.runningPnL != null) aggregatePnLUsd += session.runningPnL;
    else if (session?.finalPnL != null) aggregatePnLUsd += session.finalPnL;
  }

  let status = run.status;
  if (status !== "PENDING") {
    if (failedCount === run.legs.length) status = "FAILED";
    else if (runningCount > 0) status = "RUNNING";
    else status = "COMPLETED";
  }

  run.summary = {
    legCount: run.legs.length,
    startedCount,
    failedCount,
    runningCount,
    totalEntryCostUsd,
    aggregatePnLUsd,
    totalBudgetUsd: run.config?.totalBudgetUsd ?? null,
  };
  run.status = status;
  return run;
}

function publicRunView(run, { refreshSessions = false } = {}) {
  if (!run) return null;

  if (refreshSessions) {
    for (const leg of run.legs) {
      if (!leg.sessionId) continue;
      leg.sessionSnapshot = getStockAutoSession(leg.sessionId);
      if (leg.sessionSnapshot) {
        leg.liveStatus = leg.sessionSnapshot.status;
        leg.entryQty =
          leg.entryQty ?? leg.sessionSnapshot.sessionEntryQty ?? undefined;
      }
    }
    summarizeRun(run);
    persistRunsToDisk();
  }

  return {
    runId: run.runId,
    status: run.status,
    createdAt: run.createdAt,
    completedAt: run.completedAt,
    config: run.config,
    symbols: run.symbols,
    legs: run.legs.map((leg) => ({
      symbol: leg.symbol,
      sliceBudgetUsd: leg.sliceBudgetUsd,
      sessionId: leg.sessionId,
      status: leg.status,
      liveStatus: leg.liveStatus,
      entryQty: leg.entryQty,
      entryMode: leg.entryMode,
      error: leg.error,
      advice: leg.advice,
      sessionSnapshot: leg.sessionSnapshot,
    })),
    summary: run.summary,
  };
}

export async function previewMultiStockAutoRun(body) {
  const symbols = normalizeSymbols(body.symbols);
  if (symbols.length < 2) {
    const err = new Error("Select at least 2 symbols for multi auto trade.");
    err.status = 400;
    throw err;
  }
  if (symbols.length > MAX_SYMBOLS) {
    const err = new Error(`Maximum ${MAX_SYMBOLS} symbols per run.`);
    err.status = 400;
    throw err;
  }

  const config = validateConfig(body, symbols.length);
  const legs = await Promise.all(
    symbols.map(async (symbol, index) => {
      const sliceBudget = config.budgetAllocations[index];
      try {
        const advice = await adviseLeg(symbol, sliceBudget, config);
        return {
          symbol,
          status: "ready",
          sliceBudgetUsd: sliceBudget,
          advice,
          error: null,
        };
      } catch (e) {
        return {
          symbol,
          status: "error",
          sliceBudgetUsd: sliceBudget,
          advice: null,
          error: e.message,
        };
      }
    })
  );

  const plannedDeploymentUsd = legs.reduce((sum, leg) => {
    if (!leg.advice) return sum;
    const notional =
      config.entryMode === "full"
        ? leg.advice.maxNotionalUsd
        : leg.advice.suggestedNotionalUsd;
    return sum + (Number(notional) || 0);
  }, 0);

  return {
    symbols,
    config,
    legs,
    readyCount: legs.filter((l) => l.advice).length,
    plannedDeploymentUsd,
  };
}

export async function startMultiStockAutoRun(body) {
  const symbols = normalizeSymbols(body.symbols);
  if (symbols.length < 2) {
    const err = new Error("Select at least 2 symbols for multi auto trade.");
    err.status = 400;
    throw err;
  }
  if (symbols.length > MAX_SYMBOLS) {
    const err = new Error(`Maximum ${MAX_SYMBOLS} symbols per run.`);
    err.status = 400;
    throw err;
  }

  const config = validateConfig(body, symbols.length);
  const previewLegs = body.legs;

  const legs = symbols.map((symbol, index) => ({
    symbol,
    sliceBudgetUsd: config.budgetAllocations[index],
    status: "pending",
    sessionId: null,
    advice: null,
    entryQty: null,
    entryMode: config.entryMode,
    error: null,
    sessionSnapshot: null,
    liveStatus: null,
  }));

  const run = createRunRecord({
    symbols,
    config,
    legs,
  });

  run.status = "STARTING";
  updateRun(run.runId, run);

  for (let i = 0; i < legs.length; i += 1) {
    const leg = legs[i];
    const sliceBudget = leg.sliceBudgetUsd ?? config.budgetAllocations[i];
    const preview = previewLegs?.find((p) => p.symbol === leg.symbol);
    try {
      const advice =
        preview?.advice || (await adviseLeg(leg.symbol, sliceBudget, config));
      leg.advice = advice;
      const entryQty =
        config.entryMode === "full" ? advice.maxQty : advice.suggestedQty;

      const session = await startStockAutoSession({
        symbol: leg.symbol,
        budgetUsd: sliceBudget,
        maxLossUsd: config.maxLossUsd,
        profitMinUsd: config.profitMinUsd,
        intervalMs: config.intervalMs,
        usePaperBroker: config.usePaperBroker,
        entryQty,
        agentAdvice: advice,
      });

      leg.sessionId = session.sessionId;
      leg.entryQty = entryQty;
      leg.status = "started";
      leg.sessionSnapshot = session;
      leg.liveStatus = session.status;
    } catch (e) {
      leg.status = "failed";
      leg.error = e.message;
      if (preview?.advice) leg.advice = preview.advice;
    }
  }

  run.legs = legs;
  run.status = "RUNNING";
  run.completedAt =
    legs.every((l) => l.status === "failed") ? new Date().toISOString() : null;
  summarizeRun(run);
  persistRunsToDisk();

  return publicRunView(run, { refreshSessions: true });
}

export function getMultiStockAutoRun(runId, options = {}) {
  const run = getRun(runId);
  if (!run) return null;
  return publicRunView(run, { refreshSessions: options.refreshSessions !== false });
}

export function getMultiStockAutoRunHistory(limit = 40) {
  return listRuns(limit).map((run) =>
    publicRunView(run, { refreshSessions: true })
  );
}
