import { runCommand } from "../../config/command.js";

export async function fetchDailyBars(symbol, startDate) {
  const args = [
    "data",
    "bars",
    "--symbol",
    symbol,
    "--start",
    startDate,
    "--timeframe",
    "1Day",
  ];

  const result = await runCommand(args);
  return normalizeDailyBars(JSON.parse(result));
}

export function normalizeDailyBars(raw) {
  const rows = Array.isArray(raw?.bars)
    ? raw.bars
    : Array.isArray(raw)
      ? raw
      : [];

  const byDate = new Map();

  for (const bar of rows) {
    const date = toDateKey(bar.t ?? bar.timestamp);
    const open = toNumber(bar.o ?? bar.open);
    const high = toNumber(bar.h ?? bar.high);
    const low = toNumber(bar.l ?? bar.low);
    const close = toNumber(bar.c ?? bar.close);
    const volume = toNumber(bar.v ?? bar.volume);

    if (!date || open === null || high === null || low === null || close === null) {
      continue;
    }

    byDate.set(date, {
      date,
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function toDateKey(value) {
  if (value === undefined || value === null) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}
