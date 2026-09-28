function parseSymbols(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\s,]+/)
      : [];
  return [...new Set(list.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
}

function positiveNumber(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    const error = new Error(`${fieldName} must be a positive number.`);
    error.status = 400;
    throw error;
  }
  return n;
}

function nonNegativeInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    const error = new Error(`${fieldName} must be a non-negative integer.`);
    error.status = 400;
    throw error;
  }
  return n;
}

export function validateCapabilityPolicy(input) {
  const allowedStocks = parseSymbols(input?.allowedStocks ?? input?.allowed_stocks ?? input?.symbols);
  if (!allowedStocks.length) {
    const error = new Error("allowedStocks must include at least one symbol.");
    error.status = 400;
    throw error;
  }

  for (const sym of allowedStocks) {
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(sym)) {
      const error = new Error(`Invalid symbol in policy: ${sym}`);
      error.status = 400;
      throw error;
    }
  }

  const maxOrderValueUsd = positiveNumber(
    input?.maxOrderValueUsd ?? input?.max_order_value_usd ?? input?.maxOrderValue,
    "maxOrderValueUsd"
  );
  const maxPositionSizeUsd = positiveNumber(
    input?.maxPositionSizeUsd ?? input?.max_position_size_usd ?? input?.maxPositionSize,
    "maxPositionSizeUsd"
  );
  const dailyTradeLimit = nonNegativeInt(
    input?.dailyTradeLimit ?? input?.daily_trade_limit ?? 0,
    "dailyTradeLimit"
  );
  if (dailyTradeLimit === 0) {
    const error = new Error("dailyTradeLimit must be at least 1.");
    error.status = 400;
    throw error;
  }
  const dailySpendingLimitUsd = positiveNumber(
    input?.dailySpendingLimitUsd ?? input?.daily_spending_limit_usd ?? input?.dailySpendingLimit,
    "dailySpendingLimitUsd"
  );

  const allowShortSelling = Boolean(
    input?.allowShortSelling ?? input?.allow_short_selling ?? false
  );

  const strategyId = input?.strategyId ?? input?.strategy_id ?? null;
  const strategyName = input?.strategyName ?? input?.strategy_name ?? null;

  return {
    policyId: input?.policyId || `capbac-${Date.now()}`,
    createdAt: new Date().toISOString(),
    strategyId,
    strategyName,
    allowedStocks,
    maxOrderValueUsd,
    maxPositionSizeUsd,
    dailyTradeLimit,
    dailySpendingLimitUsd,
    allowShortSelling,
  };
}

export function normalizeDailyUsage(input) {
  const tradeCount = Number(input?.tradeCount ?? input?.trades_today ?? 0);
  const spendingUsd = Number(input?.spendingUsd ?? input?.spending_usd ?? 0);

  return {
    tradeCount: Number.isFinite(tradeCount) && tradeCount >= 0 ? Math.floor(tradeCount) : 0,
    spendingUsd: Number.isFinite(spendingUsd) && spendingUsd >= 0 ? spendingUsd : 0,
  };
}

export function normalizeTradeProposal(input, index = 0) {
  const symbol = String(input?.symbol || "")
    .trim()
    .toUpperCase();
  if (!symbol) {
    const error = new Error(`Proposal ${index + 1} is missing symbol.`);
    error.status = 400;
    throw error;
  }

  const side = String(input?.side || "buy").toLowerCase() === "sell" ? "sell" : "buy";
  const notionalUsd = Number(input?.notionalUsd ?? input?.notional_usd ?? input?.suggestedNotionalUsd);
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) {
    const error = new Error(`Proposal for ${symbol} must have a positive notionalUsd.`);
    error.status = 400;
    throw error;
  }

  return {
    proposalId: input?.proposalId || input?.proposal_id || `proposal-${symbol}-${index}`,
    symbol,
    side,
    notionalUsd: Math.round(notionalUsd * 100) / 100,
    source: input?.source || "planner",
  };
}
