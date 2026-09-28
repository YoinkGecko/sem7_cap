import {
  fetchSnapshotPrice,
  submitBrokerOrder,
} from "../execution/brokerGateway.js";
import { runCommand } from "../../config/command.js";
import { evaluateStrategy } from "./strategyEngine.js";
import { fetchPositionForSymbol } from "./positionHelper.js";
import {
  appendTickLog,
  getSession,
  startSessionLoop,
  stopSessionLoop,
  updateSession,
  createSession as storeCreateSession,
  findActiveSessionForSymbol,
} from "./sessionStore.js";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function publicSessionView(session) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    symbol: session.symbol,
    status: session.status,
    budgetUsd: session.budgetUsd,
    maxLossUsd: session.maxLossUsd,
    intervalMs: session.intervalMs,
    strategyType: session.strategyType,
    usePaperBroker: session.usePaperBroker,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    stopReason: session.stopReason,
    tradeCount: session.tradeCount,
    ticks: session.ticks,
    lastTickAt: session.lastTickAt,
    lastError: session.lastError,
    currentPrice: session.currentPrice,
    dayChangePct: session.dayChangePct,
    availableBudgetUsd: session.availableBudgetUsd,
    positionQty: session.positionQty,
    positionSide: session.positionSide,
    positionMarketValue: session.positionMarketValue,
    positionAvgEntry: session.positionAvgEntry,
    runningPnL: session.runningPnL,
    realizedPnL: session.realizedPnL,
    unrealizedPnL: session.unrealizedPnL,
    lastTrade: session.lastTrade,
    lastProposal: session.lastProposal,
    lossLimitTriggered: session.status === "LOSS_LIMIT_REACHED",
    tickLog: session.tickLog || [],
  };
}

async function fetchMarketSnapshot(symbol) {
  const ticker = String(symbol).trim().toUpperCase();
  const { price: snapPrice } = await fetchSnapshotPrice(ticker);
  const raw = await runCommand(["data", "snapshot", "--symbol", ticker]);
  const data = JSON.parse(raw);
  const daily = data?.dailyBar ?? data?.daily_bar;
  const prev = data?.prevDailyBar ?? data?.prev_daily_bar;
  const trade = data?.latestTrade ?? data?.latest_trade;

  const price =
    snapPrice ??
    num(trade?.p ?? trade?.price) ??
    num(daily?.c ?? daily?.close);

  const prevClose = num(prev?.c ?? prev?.close);
  let dayChangePct = null;
  if (price && prevClose && prevClose > 0) {
    dayChangePct = ((price - prevClose) / prevClose) * 100;
  }

  return { price, dayChangePct };
}

async function closePosition(session, price) {
  const qty = session.positionQty;
  if (!qty || qty <= 0) return null;

  const side = session.positionSide === "short" ? "buy" : "sell";
  const clientOrderId = `sa${session.sessionId.replace(/-/g, "").slice(0, 8)}x${Date.now()}`.slice(
    0,
    48
  );

  const result = await submitBrokerOrder({
    symbol: session.symbol,
    side,
    qty,
    type: "market",
    clientOrderId,
    dryRun: false,
  });
  return {
    side,
    qty,
    price: price ?? session.currentPrice,
    brokerOrderId: result?.id || result?.order_id,
    status: result?.status || "submitted",
  };
}

async function executeProposal(session, proposal, price) {
  const clientOrderId = `sa${session.sessionId.replace(/-/g, "").slice(0, 8)}${session.tradeCount}${Date.now()}`.slice(
    0,
    48
  );

  if (proposal.action === "buy") {
    const deployed = session.positionMarketValue || 0;
    const available = Math.max(0, session.budgetUsd - deployed);
    const notional = Math.min(proposal.notionalUsd, available);
    if (notional < 50) return null;
    const { price: px } = await fetchSnapshotPrice(session.symbol);
    const qty = Math.max(1, Math.floor(notional / px));
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
      price: px,
      brokerOrderId: broker?.id || broker?.order_id,
      status: broker?.status || "submitted",
      reason: proposal.reason,
    };
  }

  if (proposal.action === "sell") {
    const qty = proposal.qty || session.positionQty;
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
      reason: proposal.reason,
    };
  }

  return null;
}

function applyTradeToPnL(session, trade, positionBefore) {
  if (trade.side === "sell" && positionBefore?.avg_entry_price && trade.qty) {
    const pl = (trade.price - positionBefore.avg_entry_price) * trade.qty;
    session.realizedPnL = (session.realizedPnL || 0) + pl;
  }
}

async function finalizeStop(session, status, stopReason) {
  stopSessionLoop(session.sessionId);
  session.status = status;
  session.stopReason = stopReason;
  session.stoppedAt = new Date().toISOString();
  updateSession(session.sessionId, session);
}

export async function processSessionTick(sessionId) {
  const session = getSession(sessionId);
  if (!session || session.status !== "RUNNING") return publicSessionView(session);

  try {
    const { price, dayChangePct } = await fetchMarketSnapshot(session.symbol);
    const position = await fetchPositionForSymbol(session.symbol);

    session.ticks = (session.ticks || 0) + 1;
    session.ticksSinceLastTrade = (session.ticksSinceLastTrade || 0) + 1;
    session.currentPrice = price;
    session.dayChangePct = dayChangePct;

    session.positionQty = position?.qty || 0;
    session.positionSide = position?.side || "long";
    session.positionMarketValue = position?.market_value || 0;
    session.positionAvgEntry = position?.avg_entry_price ?? null;
    session.unrealizedPnL = position?.unrealized_pl ?? 0;
    session.availableBudgetUsd = Math.max(
      0,
      session.budgetUsd - (session.positionMarketValue || 0)
    );

    session.runningPnL = (session.realizedPnL || 0) + (session.unrealizedPnL || 0);

    if (session.runningPnL <= -Math.abs(session.maxLossUsd)) {
      if (session.positionQty > 0) {
        try {
          const closeTrade = await closePosition(session, price);
          if (closeTrade) {
            session.tradeCount += 1;
            session.lastTrade = {
              ...closeTrade,
              at: new Date().toISOString(),
              reason: "Loss limit — closing position",
            };
            applyTradeToPnL(session, closeTrade, position);
          }
        } catch (e) {
          session.lastError = e.message;
        }
      }
      await finalizeStop(session, "LOSS_LIMIT_REACHED", "Maximum loss limit reached");
      appendTickLog(session, {
        at: new Date().toISOString(),
        message: `LOSS LIMIT: P/L ${session.runningPnL.toFixed(2)} ≤ -${session.maxLossUsd}`,
      });
      updateSession(sessionId, session);
      return publicSessionView(session);
    }

    const proposal = evaluateStrategy({
      strategyType: session.strategyType,
      price,
      dayChangePct: dayChangePct ?? 0,
      positionQty: session.positionQty,
      positionSide: session.positionSide,
      budgetUsd: session.budgetUsd,
      positionMarketValue: session.positionMarketValue,
      sessionUnrealizedPl: session.unrealizedPnL,
      lastProposalAction: session.lastProposalAction,
      ticksSinceLastTrade: session.ticksSinceLastTrade,
    });

    session.lastProposal = proposal
      ? { ...proposal, evaluatedAt: new Date().toISOString() }
      : { action: null, reason: "No opportunity this cycle", evaluatedAt: new Date().toISOString() };

    if (proposal) {
      const positionBefore = position ? { ...position } : null;
      const trade = await executeProposal(session, proposal, price);
      if (trade) {
        session.tradeCount += 1;
        session.ticksSinceLastTrade = 0;
        session.lastProposalAction = trade.side;
        session.lastTrade = { ...trade, at: new Date().toISOString() };
        applyTradeToPnL(session, trade, positionBefore);

        const posAfter = await fetchPositionForSymbol(session.symbol);
        session.positionQty = posAfter?.qty || 0;
        session.positionMarketValue = posAfter?.market_value || 0;
        session.unrealizedPnL = posAfter?.unrealized_pl ?? 0;
        session.runningPnL = (session.realizedPnL || 0) + (session.unrealizedPnL || 0);
        session.availableBudgetUsd = Math.max(
          0,
          session.budgetUsd - (session.positionMarketValue || 0)
        );

        appendTickLog(session, {
          at: new Date().toISOString(),
          message: `Trade ${trade.side.toUpperCase()} ${trade.qty} @ ${trade.price}: ${proposal.reason}`,
        });
      }
    } else {
      appendTickLog(session, {
        at: new Date().toISOString(),
        message: `Monitor @ ${price?.toFixed(2)} · P/L ${session.runningPnL.toFixed(2)} · no signal`,
      });
    }

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

export function startStockAutoSession(input) {
  const budgetUsd = Number(input.budgetUsd);
  const maxLossUsd = Number(input.maxLossUsd);
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

  const session = storeCreateSession(input);
  startSessionLoop(session.sessionId, processSessionTick);
  return publicSessionView(session);
}

export async function stopStockAutoSession(sessionId, reason = "Stopped by user") {
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
  session.status = "STOPPED";
  session.stopReason = reason;
  session.stoppedAt = new Date().toISOString();
  updateSession(sessionId, session);
  return publicSessionView(session);
}

export function getStockAutoSession(sessionId) {
  return publicSessionView(getSession(sessionId));
}

export function getActiveStockAutoSession(symbol) {
  const s = findActiveSessionForSymbol(symbol);
  return publicSessionView(s);
}
