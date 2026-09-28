import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../../data/stock-auto-sessions.json");

/** @type {Map<string, object>} */
const sessions = new Map();
/** @type {Map<string, NodeJS.Timeout>} */
const timers = new Map();

function loadFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    const list = raw?.sessions || [];
    for (const s of list) {
      if (s?.sessionId) {
        s.status = s.status === "RUNNING" ? "STOPPED" : s.status;
        s.stopReason = s.stopReason || "Server restarted";
        sessions.set(s.sessionId, s);
      }
    }
  } catch {
    /* ignore corrupt file */
  }
}

function persistToDisk() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ sessions: Array.from(sessions.values()) }, null, 2)
    );
  } catch (e) {
    console.error("stock-auto session persist failed:", e.message);
  }
}

loadFromDisk();

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function findActiveSessionForSymbol(symbol) {
  const sym = String(symbol || "").toUpperCase();
  for (const s of sessions.values()) {
    if (s.symbol === sym && s.status === "RUNNING") return s;
  }
  return null;
}

export function createSession(input) {
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const existing = findActiveSessionForSymbol(symbol);
  if (existing) {
    const err = new Error(`Auto trading already running for ${symbol}.`);
    err.status = 409;
    throw err;
  }

  const sessionId = randomUUID();
  const session = {
    sessionId,
    symbol,
    status: "RUNNING",
    budgetUsd: Number(input.budgetUsd),
    maxLossUsd: Number(input.maxLossUsd),
    profitMinUsd: Number(input.profitMinUsd),
    intervalMs: Number(input.intervalMs) || 5000,
    usePaperBroker: input.usePaperBroker !== false,
    initialBuyComplete: false,
    sessionEntryQty: 0,
    sessionEntryAvgPrice: null,
    sessionTotalCost: 0,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    stopReason: null,
    tradeCount: 0,
    ticks: 0,
    lastTickAt: null,
    lastError: null,
    currentPrice: null,
    dayChangePct: null,
    availableBudgetUsd: Number(input.budgetUsd),
    positionQty: 0,
    positionSide: "long",
    positionMarketValue: 0,
    positionAvgEntry: null,
    runningPnL: 0,
    realizedPnL: 0,
    unrealizedPnL: 0,
    maxLossUsdConfigured: Number(input.maxLossUsd),
    lastTrade: null,
    lastEvaluation: null,
    tickLog: [],
  };

  sessions.set(sessionId, session);
  persistToDisk();
  return session;
}

export function updateSession(sessionId, patch) {
  const s = sessions.get(sessionId);
  if (!s) return null;
  Object.assign(s, patch);
  persistToDisk();
  return s;
}

export function stopSessionLoop(sessionId) {
  const t = timers.get(sessionId);
  if (t) {
    clearInterval(t);
    timers.delete(sessionId);
  }
}

export function startSessionLoop(sessionId, tickFn) {
  stopSessionLoop(sessionId);
  const session = getSession(sessionId);
  if (!session || session.status !== "RUNNING") return;

  const ms = Math.max(3000, session.intervalMs || 5000);
  tickFn(sessionId).catch(() => {});
  const id = setInterval(() => {
    tickFn(sessionId).catch(() => {});
  }, ms);
  timers.set(sessionId, id);
}

export function appendTickLog(session, entry) {
  session.tickLog = session.tickLog || [];
  session.tickLog.unshift(entry);
  if (session.tickLog.length > 20) session.tickLog.length = 20;
}

export { persistToDisk };
