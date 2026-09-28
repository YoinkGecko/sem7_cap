/**
 * Exit when session unrealized P/L hits user profit minimum or loss maximum (USD).
 */

/**
 * @param {{ sessionPnL: number, maxLossUsd: number, profitMinUsd: number, hasPosition: boolean }}
 */
export function evaluateProfitLossExit({ sessionPnL, maxLossUsd, profitMinUsd, hasPosition }) {
  if (!hasPosition) return null;

  const pl = Number(sessionPnL);
  if (!Number.isFinite(pl)) return null;

  if (pl <= -Math.abs(maxLossUsd)) {
    return {
      action: "sell",
      reason: `Loss limit: P/L ${pl.toFixed(2)} reached −$${Math.abs(maxLossUsd)}`,
      exitType: "loss",
    };
  }

  if (pl >= Math.abs(profitMinUsd)) {
    return {
      action: "sell",
      reason: `Profit target: P/L ${pl.toFixed(2)} ≥ +$${Math.abs(profitMinUsd)}`,
      exitType: "profit",
    };
  }

  return null;
}

export function computeSessionPnL(session, currentPrice) {
  const qty = session.sessionEntryQty;
  const avg = session.sessionEntryAvgPrice;
  const price = Number(currentPrice);

  if (qty > 0 && avg > 0 && Number.isFinite(price)) {
    return (price - avg) * qty;
  }

  if (session.sessionTotalCost > 0 && session.positionMarketValue > 0) {
    return session.positionMarketValue - session.sessionTotalCost;
  }

  return session.unrealizedPnL ?? 0;
}
