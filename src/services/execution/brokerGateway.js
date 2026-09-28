import { runCommand } from "../../config/command.js";

/**
 * Broker gateway — the ONLY module that may invoke Alpaca order commands.
 * Do not import this from Planner, CapBAC, or Intent services.
 */

export async function submitBrokerOrder({
  symbol,
  side,
  qty,
  type = "market",
  limitPrice,
  clientOrderId,
  dryRun = false,
}) {
  const args = [
    "order",
    "submit",
    "--symbol",
    String(symbol).toUpperCase(),
    "--side",
    side,
    "--qty",
    String(qty),
    "--type",
    type,
  ];

  if (limitPrice !== undefined) {
    args.push("--limit-price", String(limitPrice));
  }
  if (dryRun) {
    args.push("--dry-run");
  }
  if (clientOrderId) {
    args.push("--client-order-id", String(clientOrderId));
  }

  const stdout = await runCommand(args);
  return JSON.parse(stdout);
}

export async function cancelBrokerOrder(orderId) {
  const stdout = await runCommand(["order", "cancel", "--order-id", String(orderId)]);
  return JSON.parse(stdout);
}

export async function fetchBrokerOrder(orderId) {
  const stdout = await runCommand(["order", "get", "--order-id", String(orderId)]);
  return JSON.parse(stdout);
}

export async function fetchSnapshotPrice(symbol) {
  const ticker = String(symbol).trim().toUpperCase();
  const stdout = await runCommand(["data", "snapshot", "--symbol", ticker]);
  const data = JSON.parse(stdout);

  const trade = data?.latestTrade ?? data?.latest_trade;
  const bar = data?.dailyBar ?? data?.daily_bar;
  const quote = data?.latestQuote ?? data?.latest_quote;

  const price =
    num(trade?.p ?? trade?.price) ??
    num(bar?.c ?? bar?.close) ??
    num(quote?.ap ?? quote?.ask_price) ??
    num(quote?.bp ?? quote?.bid_price);

  if (!price || price <= 0) {
    throw new Error(`Unable to price ${ticker} for order sizing.`);
  }

  return { symbol: ticker, price };
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
