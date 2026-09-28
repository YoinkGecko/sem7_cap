import {
  fetchSnapshotPrice,
  submitBrokerOrder,
} from "../execution/brokerGateway.js";
import { computeSessionPnL, evaluateProfitLossExit } from "./strategyEngine.js";
import { fetchPositionForSymbol } from "./positionHelper.js";
import {
  appendTickLog,
  getSession,
  startSessionLoop,
  stopSessionLoop,
  updateSession,
  createSession as storeCreateSession,
  findActiveSessionForSymbol,
  appendTradeHistory,
  listHistoryForSymbol,
} from "./sessionStore.js";

function recordTrade(session, trade) {
  const enriched = {
    ...trade,
    at: trade.at || new Date().toISOString(),
  };
  session.lastTrade = enriched;
  appendTradeHistory(session, enriched);
}

function sealSessionPnL(session) {
  session.finalPnL = session.runningPnL ?? 0;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function publicSessionView(session) {
  if (!session) return null;
  const qty = session.sessionEntryQty ?? session.positionQty ?? 0;
  const totalCost = session.sessionTotalCost ?? 0;
  const currentValue =
    session.currentPrice && qty
      ? session.currentPrice * qty
      : session.positionMarketValue ?? 0;

  return {
    sessionId: session.sessionId,
    symbol: session.symbol,
    status: session.status,
    budgetUsd: session.budgetUsd,
    maxLossUsd: session.maxLossUsd,
    profitMinUsd: session.profitMinUsd,
    intervalMs: session.intervalMs,
    usePaperBroker: session.usePaperBroker,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    stopReason: session.stopReason,
    tradeCount: session.tradeCount,
    ticks: session.ticks,
    lastTickAt: session.lastTickAt,
    lastError: session.lastError,
    currentPrice: session.currentPrice,
    sessionEntryQty: session.sessionEntryQty,
    sessionEntryAvgPrice: session.sessionEntryAvgPrice,
    sessionTotalCost: session.sessionTotalCost,
    sessionMarketValue: currentValue,
    positionQty: session.positionQty,
    positionMarketValue: session.positionMarketValue,
    positionAvgEntry: session.positionAvgEntry,
    runningPnL: session.runningPnL,
    lastTrade: session.lastTrade,
    lastEvaluation: session.lastEvaluation,
    initialBuyComplete: session.initialBuyComplete,
    lossLimitTriggered: session.status === "LOSS_LIMIT_REACHED",
    profitTargetReached: session.status === "PROFIT_TARGET_REACHED",
    finalPnL: session.finalPnL,
    tradeHistory: session.tradeHistory || [],
    tickLog: session.tickLog || [],
  };
}

async function fetchMarketSnapshot(symbol) {
  const ticker = String(symbol).trim().toUpperCase();
  const { price: snapPrice } = await fetchSnapshotPrice(ticker);
  return { price: snapPrice };
}

async function marketBuy(session, qty, priceHint) {
  const clientOrderId = `sa${session.sessionId.replace(/-/g, "").slice(0, 8)}b${Date.now()}`.slice(0, 48);
  const { price: px } = await fetchSnapshotPrice(session.symbol);
  const fillPrice = priceHint ?? px;
  const broker = await submitBrokerOrder({
    symbol: session.symbol,
    side: "buy",
    qty,
    type: "market",
    clientOrderId,
    dryRun: false,
  });
  return {
    side: "buy",
    qty,
    price: fillPrice,
    brokerOrderId: broker?.id || broker?.order_id,
    status: broker?.status || "submitted",
  };
}

async function marketSellAll(session, qty, price) {
  if (!qty || qty <= 0) return null;
  const clientOrderId = `sa${session.sessionId.replace(/-/g, "").slice(0, 8)}s${Date.now()}`.slice(0, 48);
  const broker = await submitBrokerOrder({
    symbol: session.symbol,
    side: "sell",
    qty,
    type: "market",
    clientOrderId,
    dryRun: false,
  });
  return {
    side: "sell",
    qty,
    price: price ?? session.currentPrice,
    brokerOrderId: broker?.id || broker?.order_id,
    status: broker?.status || "submitted",
  };
}

async function performInitialMaxBuy(session) {
  const { price } = await fetchMarketSnapshot(session.symbol);
  if (!price || price <= 0) {
    throw new Error("Unable to get price for initial buy.");
  }

  const qty = Math.floor(session.budgetUsd / price);
  if (qty < 1) {
    throw new Error(
      `Budget $${session.budgetUsd} is too small for 1 share at ${price.toFixed(2)}.`
    );
  }

  const trade = await marketBuy(session, qty, price);
  const totalCost = qty * price;

  session.initialBuyComplete = true;
  session.sessionEntryQty = qty;
  session.sessionEntryAvgPrice = price;
  session.sessionTotalCost = totalCost;
  session.tradeCount = 1;
  recordTrade(session, {
    ...trade,
    reason: `Max budget buy: ${qty} shares @ ${price.toFixed(2)} ≈ $${totalCost.toFixed(2)}`,
  });
  session.currentPrice = price;
  session.positionQty = qty;
  session.positionAvgEntry = price;
  session.positionMarketValue = totalCost;
  session.runningPnL = 0;

  const pos = await fetchPositionForSymbol(session.symbol);
  if (pos?.qty) {
    session.positionQty = pos.qty;
    session.positionMarketValue = pos.market_value ?? totalCost;
    session.positionAvgEntry = pos.avg_entry_price ?? price;
  }

  appendTickLog(session, {
    at: new Date().toISOString(),
    message: `Bought ${qty} @ ${price.toFixed(2)} · total cost $${totalCost.toFixed(2)}`,
  });
  updateSession(session.sessionId, session);
}

async function finalizeStop(session, status, stopReason) {
  stopSessionLoop(session.sessionId);
  sealSessionPnL(session);
  session.status = status;
  session.stopReason = stopReason;
  session.stoppedAt = new Date().toISOString();
  updateSession(session.sessionId, session);
}

export async function processSessionTick(sessionId) {
  const session = getSession(sessionId);
  if (!session || session.status !== "RUNNING") return publicSessionView(session);

  try {
    if (!session.initialBuyComplete) {
      await performInitialMaxBuy(session);
      return publicSessionView(session);
    }

    const { price } = await fetchMarketSnapshot(session.symbol);
    const position = await fetchPositionForSymbol(session.symbol);

    session.ticks = (session.ticks || 0) + 1;
    session.currentPrice = price;
    session.positionQty = position?.qty ?? session.sessionEntryQty ?? 0;
    session.positionMarketValue = position?.market_value ?? (price && session.sessionEntryQty
      ? price * session.sessionEntryQty
      : 0);
    session.positionAvgEntry = position?.avg_entry_price ?? session.sessionEntryAvgPrice;

    session.runningPnL = computeSessionPnL(session, price);
    session.unrealizedPnL = session.runningPnL;

    const sellQty = session.sessionEntryQty || session.positionQty;

    const exit = evaluateProfitLossExit({
      sessionPnL: session.runningPnL,
      maxLossUsd: session.maxLossUsd,
      profitMinUsd: session.profitMinUsd,
      hasPosition: sellQty > 0,
    });

    session.lastEvaluation = exit
      ? { ...exit, evaluatedAt: new Date().toISOString() }
      : {
          action: null,
          reason: `Monitoring · P/L ${session.runningPnL.toFixed(2)} (target +$${session.profitMinUsd}, stop −$${session.maxLossUsd})`,
          evaluatedAt: new Date().toISOString(),
        };

    if (exit?.action === "sell") {
      const closeTrade = await marketSellAll(session, sellQty, price);
      if (closeTrade) {
        session.tradeCount += 1;
        if (session.sessionEntryAvgPrice && closeTrade.price) {
          session.runningPnL =
            (closeTrade.price - session.sessionEntryAvgPrice) * closeTrade.qty;
        }
        recordTrade(session, { ...closeTrade, reason: exit.reason });
      }

      const status =
        exit.exitType === "profit" ? "PROFIT_TARGET_REACHED" : "LOSS_LIMIT_REACHED";
      appendTickLog(session, {
        at: new Date().toISOString(),
        message: exit.reason,
      });
      await finalizeStop(session, status, exit.reason);
      return publicSessionView(session);
    }

    appendTickLog(session, {
      at: new Date().toISOString(),
      message: `Price ${price?.toFixed(2)} · P/L ${session.runningPnL.toFixed(2)}`,
    });

    session.lastTickAt = new Date().toISOString();
    session.lastError = null;
    updateSession(sessionId, session);
  } catch (e) {
    session.lastError = e.message;
    session.lastTickAt = new Date().toISOString();
    updateSession(sessionId, session);
  }

  return publicSessionView(session);
}

export async function startStockAutoSession(input) {
  const budgetUsd = Number(input.budgetUsd);
  const maxLossUsd = Number(input.maxLossUsd);
  const profitMinUsd = Number(input.profitMinUsd);

  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
    const err = new Error("budgetUsd must be a positive number.");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(maxLossUsd) || maxLossUsd <= 0) {
    const err = new Error("maxLossUsd must be a positive number (hard safety limit).");
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(profitMinUsd) || profitMinUsd <= 0) {
    const err = new Error("profitMinUsd must be a positive number (e.g. 10).");
    err.status = 400;
    throw err;
  }

  const session = storeCreateSession(input);

  try {
    await performInitialMaxBuy(session);
  } catch (e) {
    session.status = "STOPPED";
    session.stopReason = e.message;
    updateSession(session.sessionId, session);
    e.status = e.status || 400;
    throw e;
  }

  startSessionLoop(session.sessionId, processSessionTick);
  return publicSessionView(session);
}

export async function stopStockAutoSession(sessionId, options = {}) {
  const sellPosition = options.sellPosition === true;
  const reason =
    options.reason ||
    (sellPosition ? "Stopped by user — sold session position" : "Stopped by user — kept position");

  const session = getSession(sessionId);
  if (!session) {
    const err = new Error("Session not found.");
    err.status = 404;
    throw err;
  }
  if (session.status !== "RUNNING") {
    return publicSessionView(session);
  }

  stopSessionLoop(sessionId);

  const position = await fetchPositionForSymbol(session.symbol);
  const sellQty =
    session.sessionEntryQty ||
    position?.qty ||
    session.positionQty ||
    0;

  if (sellPosition && sellQty > 0) {
    try {
      const { price } = await fetchMarketSnapshot(session.symbol);
      const closeTrade = await marketSellAll(session, sellQty, price);
      if (closeTrade) {
        session.tradeCount = (session.tradeCount || 0) + 1;
        if (session.sessionEntryAvgPrice && closeTrade.price) {
          session.runningPnL =
            (closeTrade.price - session.sessionEntryAvgPrice) * closeTrade.qty;
        }
        recordTrade(session, {
          ...closeTrade,
          reason: "Manual stop — user chose to sell",
        });
        session.sessionEntryQty = 0;
        session.positionQty = 0;
        session.positionMarketValue = 0;
      }
    } catch (e) {
      session.lastError = e.message;
      session.stopReason = `${reason} (sell failed: ${e.message})`;
      session.status = "STOPPED";
      session.stoppedAt = new Date().toISOString();
      updateSession(sessionId, session);
      throw e;
    }
  }

  sealSessionPnL(session);
  session.status = "STOPPED";
  session.stopReason = reason;
  session.stoppedAt = new Date().toISOString();
  updateSession(sessionId, session);
  return publicSessionView(session);
}

export function getStockAutoHistory(symbol) {
  return listHistoryForSymbol(symbol);
}

export function getStockAutoSession(sessionId) {
  return publicSessionView(getSession(sessionId));
}

export function getActiveStockAutoSession(symbol) {
  const s = findActiveSessionForSymbol(symbol);
  return publicSessionView(s);
}
