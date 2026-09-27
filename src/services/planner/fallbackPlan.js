export function buildFallbackTradingPlan(input) {
  const perSymbol = input.budget / Math.max(input.symbols.length, 1);
  const maxPosition = Math.min(perSymbol * 0.6, input.budget * 0.35);

  return {
    planId: `plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    userStrategy: input.strategy,
    strategySummary: summarizeStrategy(input),
    budget: input.budget,
    currency: "USD",
    allowedSymbols: input.symbols,
    horizon: input.horizon,
    monitoring: buildMonitoring(input),
    entryConditions: buildEntryConditions(input),
    exitConditions: buildExitConditions(input),
    budgetGuidance: {
      totalBudget: input.budget,
      maxPerPositionUsd: round2(maxPosition),
      suggestedConcurrentPositions: Math.min(input.symbols.length, 3),
      reserveCashPct: 15,
      notes:
        "Keep dry powder for volatility. Size positions so a single stop-loss does not consume more than 2–3% of total budget.",
    },
    candidateTrades: input.symbols.map((symbol) => ({
      symbol,
      side: "buy",
      status: "conditional",
      rationale: `Consider ${symbol} only if momentum and news align with the stated strategy within the ${input.horizon} window.`,
      suggestedNotionalUsd: round2(Math.min(maxPosition, input.budget * 0.25)),
      entryTriggers: ["Momentum confirmation", "Supportive news flow", "Volume above recent average"],
      exitTriggers: ["Stop-loss hit", "Target reached", "Horizon end without progress"],
    })),
    noTradeDecision: {
      shouldTrade: false,
      conditions: [
        "No symbol shows clear momentum alignment",
        "News flow is mixed or negative across the watchlist",
        "Spread/volatility makes risk-reward unfavorable for the horizon",
      ],
      action: "Remain in cash and re-evaluate on the next planner cycle.",
    },
    riskNotes: [
      "Paper-trading plan only; not personalized investment advice.",
      "Past momentum does not guarantee future returns.",
    ],
    assumptions: [
      "Orders will be executed by a separate execution agent, not by the Planner.",
      "Budget is notional buying power for allocation planning.",
    ],
  };
}

function summarizeStrategy(input) {
  return `Momentum and event-driven monitoring on ${input.symbols.join(", ")} with $${input.budget.toLocaleString()} over ${input.horizon}.`;
}

function buildMonitoring(input) {
  return [
    "Intraday/daily price change and relative volume for allowed symbols",
    "Recent headlines and sentiment shifts tied to watchlist names",
    "Market regime (broad index direction) vs individual symbol momentum",
    `Time-decay checkpoint before horizon end (${input.horizon})`,
  ];
}

function buildEntryConditions(input) {
  const base = [
    "Symbol is on the allowed list and passes liquidity checks",
    "Momentum aligns with user strategy description",
    "Position size fits budget guidance",
  ];
  if (/news/i.test(input.strategy)) {
    base.push("Material news supports the directional bias (not rumor-only spikes)");
  }
  if (/momentum/i.test(input.strategy)) {
    base.push("Short-term trend and RSI/MACD not diverging sharply against the trade");
  }
  return base;
}

function buildExitConditions(input) {
  return [
    "Predefined stop-loss or max adverse move for the horizon",
    "Take-profit or trailing stop when momentum fades",
    "Exit all positions when the trading horizon expires",
    "Exit if strategy thesis is invalidated by news or trend reversal",
  ];
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
