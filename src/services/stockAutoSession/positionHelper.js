import { runCommand } from "../../config/command.js";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizePosition(raw) {
  if (!raw || typeof raw !== "object") return null;
  const symbol = String(raw.symbol || "").toUpperCase();
  if (!symbol) return null;
  const qty = num(raw.qty);
  return {
    symbol,
    qty: qty !== undefined ? Math.abs(qty) : undefined,
    side: raw.side || "long",
    avg_entry_price: num(raw.avg_entry_price ?? raw.avgEntryPrice),
    current_price: num(raw.current_price ?? raw.currentPrice),
    market_value: num(raw.market_value ?? raw.marketValue),
    cost_basis: num(raw.cost_basis ?? raw.costBasis),
    unrealized_pl: num(raw.unrealized_pl ?? raw.unrealizedPl),
  };
}

export async function fetchPositionForSymbol(symbol) {
  const ticker = String(symbol || "").trim().toUpperCase();
  if (!ticker) return null;
  const result = await runCommand(["position", "list"]);
  const parsed = JSON.parse(result);
  const list = Array.isArray(parsed) ? parsed : parsed?.positions || [];
  const raw = list.find((p) => String(p.symbol || "").toUpperCase() === ticker);
  return raw ? normalizePosition(raw) : null;
}
