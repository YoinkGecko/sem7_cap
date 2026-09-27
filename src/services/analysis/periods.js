export const ANALYSIS_PERIODS = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "3Y": 1095,
  "5Y": 1825,
};

export function normalizePeriod(period) {
  const value = (period || "1Y").toUpperCase();
  if (!ANALYSIS_PERIODS[value]) {
    return null;
  }
  return value;
}

export function periodStartDate(period) {
  const days = ANALYSIS_PERIODS[period];
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function validateSymbol(symbol) {
  if (!symbol || typeof symbol !== "string") return null;
  const ticker = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker)) return null;
  return ticker;
}
