/**
 * Deterministic strategy evaluation — returns a trade proposal only when rules match.
 * Does not place orders.
 */

export const STRATEGY_TYPES = ["pullback_entry", "momentum_breakout"];

/**
 * @param {object} ctx
 * @returns {null | { action: 'buy'|'sell', notionalUsd?: number, qty?: number, reason: string }}
 */
export function evaluateStrategy(ctx) {
  const {
    strategyType,
    price,
    dayChangePct,
    positionQty,
    positionSide,
    budgetUsd,
    positionMarketValue,
    lastProposalAction,
    ticksSinceLastTrade,
  } = ctx;

  const flat = !positionQty || positionQty <= 0;
  const longQty = positionSide === "short" ? 0 : positionQty || 0;
  const deployed = positionMarketValue || 0;
  const availableBudget = Math.max(0, budgetUsd - deployed);
  const minNotional = 50;
  const cooldownTicks = 3;

  if (ticksSinceLastTrade != null && ticksSinceLastTrade < cooldownTicks) {
    return null;
  }

  if (strategyType === "momentum_breakout") {
    if (flat && dayChangePct >= 1.0 && availableBudget >= minNotional) {
      const notionalUsd = Math.min(availableBudget, budgetUsd * 0.4, budgetUsd);
      if (notionalUsd < minNotional) return null;
      if (lastProposalAction === "buy") return null;
      return {
        action: "buy",
        notionalUsd,
        reason: `Momentum breakout: day change ${dayChangePct.toFixed(2)}% ≥ +1%`,
      };
    }
    if (longQty > 0 && dayChangePct <= -0.75) {
      if (lastProposalAction === "sell") return null;
      return {
        action: "sell",
        qty: longQty,
        reason: `Momentum exit: day change ${dayChangePct.toFixed(2)}% ≤ -0.75%`,
      };
    }
    return null;
  }

  // Default: pullback_entry — buy dips, sell strength
  if (flat && dayChangePct <= -0.85 && availableBudget >= minNotional) {
    const notionalUsd = Math.min(availableBudget, budgetUsd * 0.45);
    if (notionalUsd < minNotional) return null;
    if (lastProposalAction === "buy") return null;
    return {
      action: "buy",
      notionalUsd,
      reason: `Pullback entry: day change ${dayChangePct.toFixed(2)}% ≤ -0.85%`,
    };
  }

  if (longQty > 0 && (dayChangePct >= 1.25 || (ctx.sessionUnrealizedPl ?? 0) >= budgetUsd * 0.012)) {
    if (lastProposalAction === "sell") return null;
    return {
      action: "sell",
      qty: longQty,
      reason:
        dayChangePct >= 1.25
          ? `Take profit: day change ${dayChangePct.toFixed(2)}% ≥ +1.25%`
          : `Take profit: session unrealized ≥ 1.2% of budget`,
    };
  }

  if (!flat && price > 0) {
    // unused price guard for future rules
  }

  return null;
}
