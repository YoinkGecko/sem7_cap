import { runCommand } from "../../config/command.js";

/**
 * Broker gateway — the ONLY module that may invoke Alpaca order commands.
 * Do not import this from Planner, CapBAC, or Intent services.
 */

const EXECUTION_BROKER_TIMEOUT_MS =
  Number(process.env.EXECUTION_BROKER_TIMEOUT_MS) || 25000;

function parseBrokerJson(stdout, label) {
  if (!stdout) {
    throw new Error(`${label}: empty response from broker.`);
  }
  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`${label}: invalid JSON from broker.`);
  }
}

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

  const stdout = await runCommand(args, { timeoutMs: EXECUTION_BROKER_TIMEOUT_MS });
  return parseBrokerJson(stdout, "submit order");
}

export async function cancelBrokerOrder(orderId) {
  const stdout = await runCommand(["order", "cancel", "--order-id", String(orderId)], {
    timeoutMs: EXECUTION_BROKER_TIMEOUT_MS,
  });
  return parseBrokerJson(stdout, "cancel order");
}

export async function fetchBrokerOrder(orderId) {
  const stdout = await runCommand(["order", "get", "--order-id", String(orderId)], {
    timeoutMs: EXECUTION_BROKER_TIMEOUT_MS,
  });
  return parseBrokerJson(stdout, "get order");
}

export async function fetchSnapshotPrice(symbol) {
  const ticker = String(symbol).trim().toUpperCase();
  const stdout = await runCommand(["data", "snapshot", "--symbol", ticker], {
    timeoutMs: EXECUTION_BROKER_TIMEOUT_MS,
  });
  const data = parseBrokerJson(stdout, `snapshot ${ticker}`);

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

/** Sandbox default: simulate fills locally so Auto Trade does not depend on Alpaca CLI latency. */
export function shouldMockSandboxExecution(sandbox) {
  if (!sandbox) return false;
  return process.env.EXECUTION_MOCK_SANDBOX !== "false";
}

export async function executeMarketOrder({
  sandbox,
  symbol,
  side,
  notionalUsd,
  clientOrderId,
}) {
  if (shouldMockSandboxExecution(sandbox)) {
    const price = 100;
    const qty = Math.max(1, Math.floor(Number(notionalUsd) / price));
    return {
      qty,
      price,
      clientOrderId,
      brokerOrderId: `sim-${Date.now()}`,
      status: "simulated",
      mock: true,
    };
  }

  const { price } = await fetchSnapshotPrice(symbol);
  const qty = Math.max(1, Math.floor(Number(notionalUsd) / price));

  const brokerOrder = await submitBrokerOrder({
    symbol,
    side,
    qty,
    type: "market",
    clientOrderId,
    dryRun: sandbox,
  });

  const brokerOrderId = brokerOrder?.id || brokerOrder?.order_id || null;
  const status = sandbox ? "dry_run" : brokerOrder?.status || brokerOrder?.order_status || "submitted";

  return {
    qty,
    price,
    clientOrderId,
    brokerOrderId,
    status,
    brokerOrder,
    mock: false,
  };
}
