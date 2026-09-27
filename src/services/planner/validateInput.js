const HORIZONS = new Set(["hours", "days", "weeks"]);

export function validatePlannerInput(body) {
  const strategy = typeof body?.strategy === "string" ? body.strategy.trim() : "";
  if (strategy.length < 10) {
    const error = new Error("Strategy must be at least 10 characters.");
    error.status = 400;
    throw error;
  }

  const budget = Number(body?.budget);
  if (!Number.isFinite(budget) || budget <= 0) {
    const error = new Error("Budget must be a positive number.");
    error.status = 400;
    throw error;
  }

  const rawSymbols = Array.isArray(body?.symbols)
    ? body.symbols
    : typeof body?.symbols === "string"
      ? body.symbols.split(/[\s,]+/)
      : [];

  const symbols = [...new Set(rawSymbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean))];
  if (!symbols.length) {
    const error = new Error("At least one stock symbol is required.");
    error.status = 400;
    throw error;
  }
  if (symbols.length > 20) {
    const error = new Error("Maximum 20 symbols allowed.");
    error.status = 400;
    throw error;
  }
  for (const sym of symbols) {
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(sym)) {
      const error = new Error(`Invalid symbol: ${sym}`);
      error.status = 400;
      throw error;
    }
  }

  const horizon = String(body?.horizon || "days").toLowerCase();
  if (!HORIZONS.has(horizon)) {
    const error = new Error("Horizon must be hours, days, or weeks.");
    error.status = 400;
    throw error;
  }

  return { strategy, budget, symbols, horizon };
}

export function anchorPlan(plan, input) {
  return {
    ...plan,
    budget: input.budget,
    allowedSymbols: input.symbols,
    horizon: input.horizon,
    userStrategy: input.strategy,
  };
}
